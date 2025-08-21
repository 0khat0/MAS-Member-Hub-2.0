from fastapi import FastAPI, HTTPException, Depends, Body, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, date, timedelta, time
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import structlog
import uuid
import pytz
import json
import os
import models
from models import generate_barcode
from database import engine, SessionLocal
from typing import List, Dict, Optional
from auth.otp import is_valid_account_code

from pydantic import BaseModel
from starlette.middleware.gzip import GZipMiddleware
from time import perf_counter
from sqlalchemy import text
import jwt

# UUID validation function
def is_valid_uuid(uuid_string: str) -> bool:
    try:
        uuid.UUID(uuid_string)
        return True
    except ValueError:
        return False

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration')
CHECKIN_COUNT = Counter('checkins_total', 'Total check-ins')
MEMBER_COUNT = Counter('members_total', 'Total members')

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Muay Thai Gym Check-in System",
    description="A modern check-in system for gym members",
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENVIRONMENT") == "development" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT") == "development" else None,
)

# Gzip responses over 512 bytes
app.add_middleware(GZipMiddleware, minimum_size=512)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
)

# CORS middleware with production settings
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").strip()
extra_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
# Add a placeholder for prod if set
prod_origin = os.getenv("PROD_FRONTEND_ORIGIN", "").strip()
allowed_origins = [frontend_origin, *extra_origins, *( [prod_origin] if prod_origin else [] )]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Custom middleware for logging and metrics
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.now()
    t0 = perf_counter()
    
    # Log request
    logger.info(
        "Request started",
        method=request.method,
        url=str(request.url),
        client_ip=get_remote_address(request)
    )
    
    response = await call_next(request)
    
    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()
    # Server-Timing for quick measurement in DevTools
    try:
        response.headers["Server-Timing"] = f"app;dur={(perf_counter()-t0)*1000:.0f}"
    except Exception:
        pass
    
    # Update metrics
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    REQUEST_DURATION.observe(duration)
    
    # Log response
    logger.info(
        "Request completed",
        method=request.method,
        url=str(request.url),
        status_code=response.status_code,
        duration=duration
    )
    
    return response

# Create tables on startup
@app.on_event("startup")
async def startup_event():
    try:
        # Create all tables
        models.Base.metadata.create_all(bind=engine)
        # Ensure performance indexes (idempotent)
        with engine.connect() as conn:
            conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_member_name_lower_trim ON members (lower(trim(name)));
            CREATE INDEX IF NOT EXISTS idx_member_email_lower ON members (lower(email));
            CREATE INDEX IF NOT EXISTS idx_checkin_member_ts ON checkins (member_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_member_barcode ON members (barcode);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_households_email_unique ON households (lower(owner_email));
    
            CREATE UNIQUE INDEX IF NOT EXISTS idx_households_household_code ON households (household_code);
            """))
            conn.commit()
        logger.info("Database tables created successfully and indexes ensured")
    except Exception as e:
        logger.error("Failed to create database tables", error=str(e))
        raise e

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------- OTP Sessions --------------------
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = "HS256"
SESSION_COOKIE = "mh_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30


def _create_session_cookie(response: Response, household_id: str):
    token = jwt.encode({"household_id": household_id, "iat": int(datetime.utcnow().timestamp())}, JWT_SECRET, algorithm=JWT_ALG)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=os.getenv("ENVIRONMENT") == "production",  # required for iOS PWAs over HTTPS
        samesite=("none" if os.getenv("ENVIRONMENT") == "production" else "lax"),  # cross-origin + iOS
        path="/",
        max_age=SESSION_MAX_AGE,
    )
    return token


def _get_household_id_from_request(request: Request) -> Optional[str]:
    token = request.cookies.get(SESSION_COOKIE)
    # Allow temporary Authorization Bearer token for immediate post-verify calls (iOS PWA cookie race)
    if not token:
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth_header and isinstance(auth_header, str) and auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return payload.get("household_id")
    except Exception:
        return None

# Health check endpoint
@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        # Check database connection
        db.query(models.Member).first()
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "database": "ok",
            "version": "1.0.0"
        }
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "error": str(e)}
        )

# Debug endpoint to check barcode functionality
@app.get("/debug/barcode-test")
async def debug_barcode_test(db: Session = Depends(get_db)):
    try:
        # Test if barcode column exists
        result = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'barcode'"))
        barcode_exists = result.fetchone() is not None
        
        # Test barcode generation
        test_barcode = generate_barcode()
        
        # Check if any existing members have barcodes
        members_with_barcodes = db.query(models.Member).filter(models.Member.barcode.isnot(None)).count()
        total_members = db.query(models.Member).count()
        
        return {
            "barcode_column_exists": barcode_exists,
            "test_barcode_generated": test_barcode,
            "members_with_barcodes": members_with_barcodes,
            "total_members": total_members,
            "barcode_length": len(test_barcode) if test_barcode else 0
        }
    except Exception as e:
        logger.error("Barcode debug test failed", error=str(e))
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

# Debug endpoint to test email sending
@app.post("/debug/email-test")
async def debug_email_test(request: Request):
    try:
        body = await request.json()
        test_email = body.get("email", "test@example.com")
        
        from emails.sender import send_email
        
        # Test email send
        send_email(
            to=test_email,
            subject="Test Email from MAS Hub",
            html="<p>This is a test email to verify Resend configuration.</p>"
        )
        
        return {
            "message": "Test email sent",
            "to": test_email,
            "from": os.getenv("EMAIL_FROM", "Not set"),
            "resend_key_set": bool(os.getenv("RESEND_API_KEY"))
        }
    except Exception as e:
        logger.error("Email test failed", error=str(e))
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/metrics")
async def get_metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# -------------------- Auth & Households API (v1) --------------------
from fastapi import APIRouter
from pydantic import EmailStr
router = APIRouter(prefix="/v1")

# Lightweight session probe for app bootstrap
@router.get("/auth/session")
def auth_session(request: Request, db: Session = Depends(get_db)):
    from sqlalchemy import select
    from models import Household
    hid = _get_household_id_from_request(request)
    if not hid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    household = db.execute(select(Household).where(Household.id == uuid.UUID(hid))).scalar_one_or_none()
    if not household:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return JSONResponse({"ok": True, "householdId": str(household.id), "email": household.owner_email}, headers={"Cache-Control": "no-store"})


@router.post("/auth/reconcile-session")
def reconcile_session(request: Request, db: Session = Depends(get_db)):
    """Reconcile client-side session data with server-side session to prevent cross-contamination."""
    from sqlalchemy import select
    from models import Household, Member
    
    hid = _get_household_id_from_request(request)
    if not hid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Get the current household and its members
    household = db.execute(select(Household).where(Household.id == uuid.UUID(hid))).scalar_one_or_none()
    if not household:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    members = db.execute(select(Member).where(Member.household_id == household.id)).scalars().all()
    
    # Return the authoritative household data for client reconciliation
    return {
        "householdId": str(household.id),
        "ownerEmail": household.owner_email,
        "householdCode": household.household_code,
        "members": [
            {"id": str(m.id), "name": m.name, "email": m.email}
            for m in members
        ],
        "timestamp": datetime.now(pytz.UTC).isoformat()
    }


class StartAuthBody(BaseModel):
    email: EmailStr

class StartAuthAccountBody(BaseModel):
    accountNumber: str


@router.post("/auth/start")
def start_auth(body: StartAuthBody, request: Request, db: Session = Depends(get_db)):
    from sqlalchemy import select
    from models import Household
    from auth.otp import generate_otp, hash_token, mask_email, rate_limit_ok
    from emails.sender import send_email

    email = str(body.email).strip().lower()

    # Check if account already exists
    existing = db.execute(select(Household).where(Household.owner_email == email)).scalar_one_or_none()
    if existing:
        # Account exists - check if email is verified
        if existing.email_verified_at:
            raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in instead.")
        else:
            # Email not verified - allow them to continue with verification
            pass
    else:
        # New account - create household
        existing = Household(owner_email=email)
        db.add(existing)
        db.flush()

    rl_key = f"{request.client.host}:{email}"
    if not rate_limit_ok(rl_key):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait before retrying.")

    code = generate_otp()
    existing.email_verification_token_hash = hash_token(code)
    existing.email_verification_expires_at = datetime.now(pytz.UTC) + timedelta(hours=24)
    db.add(existing)
    db.commit()

    html = f"<p>Your MAS Hub verification code is <b>{code}</b>. It expires in 24 hours.</p>"
    send_email(to=email, subject="Your MAS verification code", html=html)

    return {"pendingId": str(existing.id), "to": mask_email(email)}


@router.post("/auth/start-account")
def start_auth_account(body: StartAuthAccountBody, request: Request, db: Session = Depends(get_db)):
    from sqlalchemy import select, func
    from models import Household
    from auth.otp import generate_otp, hash_token, mask_email, rate_limit_ok
    from emails.sender import send_email
    
    # Validate account number format
    account_number = body.accountNumber.strip().upper()
    if not is_valid_account_code(account_number):
        raise HTTPException(status_code=422, detail="Account number must be exactly 5 characters from A-Z and 2-9")
    
    # Find household by account number (case-insensitive)
    household = db.execute(
        select(Household).where(func.upper(Household.household_code) == account_number)
    ).scalar_one_or_none()
    
    # Always return 200 to avoid account enumeration
    if not household:
        return {"message": "If an account exists with this number, a verification code will be sent to the registered email."}
    
    email = household.owner_email
    
    # Rate limiting by IP + account
    rl_key = f"{request.client.host}:{account_number}"
    if not rate_limit_ok(rl_key):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait before retrying.")
    
    # Generate and send OTP
    code = generate_otp()
    household.email_verification_token_hash = hash_token(code)
    household.email_verification_expires_at = datetime.now(pytz.UTC) + timedelta(hours=24)
    db.add(household)
    db.commit()
    
    html = f"<p>Your MAS Hub verification code is <b>{code}</b>. It expires in 24 hours.</p>"
    send_email(to=email, subject="Your MAS verification code", html=html)
    
    return {"pendingId": str(household.id), "to": mask_email(email)}


@router.post("/auth/login-account")
def login_account(body: StartAuthAccountBody, response: Response, db: Session = Depends(get_db)):
    """Direct login with account code - no OTP required"""
    from sqlalchemy import select, func
    from models import Household, Member
    
    # Validate account number format
    account_number = body.accountNumber.strip().upper()
    if not is_valid_account_code(account_number):
        raise HTTPException(status_code=422, detail="Account number must be exactly 5 characters from A-Z and 2-9")
    
    # Find household by account number (case-insensitive)
    household = db.execute(
        select(Household).where(func.upper(Household.household_code) == account_number)
    ).scalar_one_or_none()
    
    if not household:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Create session directly
    token = _create_session_cookie(response, str(household.id))
    response.headers["Cache-Control"] = "no-store"
    
    # Get household members
    members = db.execute(select(Member).where(Member.household_id == household.id)).scalars().all()
    
    return JSONResponse(
        {
            "ok": True,
            "session_token": token,
            "householdId": str(household.id),
            "ownerEmail": household.owner_email,
            "members": [
                {"id": str(m.id), "name": m.name}
                for m in members
            ],
            "householdCode": household.household_code,
        },
        headers={"Cache-Control": "no-store"},
    )


@router.post("/auth/logout")
def logout_auth(response: Response):
    """Clear session cookie on logout"""
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        secure=os.getenv("ENVIRONMENT") == "production",
        samesite=("none" if os.getenv("ENVIRONMENT") == "production" else "lax")
    )
    return {"message": "Logged out successfully"}


class VerifyAuthBody(BaseModel):
    pendingId: str
    code: str


@router.post("/auth/verify")
def verify_auth(body: VerifyAuthBody, response: Response, db: Session = Depends(get_db)):
    from sqlalchemy import select
    from models import Household, Member
    if not is_valid_uuid(body.pendingId):
        raise HTTPException(status_code=400, detail="Invalid pendingId")

    household = db.execute(select(Household).where(Household.id == uuid.UUID(body.pendingId))).scalar_one_or_none()
    if not household:
        raise HTTPException(status_code=404, detail="Not found")
    if not household.email_verification_token_hash or not household.email_verification_expires_at:
        raise HTTPException(status_code=400, detail="No pending verification")
    if datetime.now(pytz.UTC) > household.email_verification_expires_at:
        raise HTTPException(status_code=400, detail="Code expired")

    from auth.otp import hash_token
    if hash_token(body.code.strip()) != household.email_verification_token_hash:
        raise HTTPException(status_code=401, detail="Invalid code")

    household.email_verified_at = datetime.now(pytz.UTC)
    household.email_verification_token_hash = None
    household.email_verification_expires_at = None
    db.add(household)
    db.commit()

    token = _create_session_cookie(response, str(household.id))
    # prevent caching; include a short-lived session_token echo for immediate use
    response.headers["Cache-Control"] = "no-store"
    members = db.execute(select(models.Member).where(models.Member.household_id == household.id)).scalars().all()
    return JSONResponse(
        {
            "ok": True,
            "session_token": token,
            "householdId": str(household.id),
            "ownerEmail": household.owner_email,
                    "members": [
            {"id": str(m.id), "name": m.name}
            for m in members
        ],
            "householdCode": household.household_code,
        },
        headers={"Cache-Control": "no-store"},
    )


@router.get("/households/me")
def households_me(request: Request, db: Session = Depends(get_db)):
    from sqlalchemy import select
    from models import Household, Member
    hid = _get_household_id_from_request(request)
    if not hid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    household = db.execute(select(Household).where(Household.id == uuid.UUID(hid))).scalar_one_or_none()
    if not household:
        raise HTTPException(status_code=401, detail="Unauthorized")
    members = db.execute(select(Member).where(Member.household_id == household.id)).scalars().all()
    return {
        "householdId": str(household.id),
        "ownerEmail": household.owner_email,
        "members": [
            {"id": str(m.id), "name": m.name}
            for m in members
        ],
        "householdCode": household.household_code,
    }


class NewMemberBody(BaseModel):
    name: str


@router.post("/households/members")
def households_create_member(body: NewMemberBody, request: Request, db: Session = Depends(get_db)):
    from sqlalchemy import select
    from models import Household, Member
    hid = _get_household_id_from_request(request)
    if not hid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    household = db.execute(select(Household).where(Household.id == uuid.UUID(hid))).scalar_one_or_none()
    if not household:
        raise HTTPException(status_code=401, detail="Unauthorized")
    # Generate unique barcode similar to legacy registration
    barcode = None
    try:
        for _ in range(10):
            candidate = generate_barcode()
            exists = db.execute(select(Member).where(Member.barcode == candidate)).scalar_one_or_none()
            if not exists:
                barcode = candidate
                break
        if not barcode:
            logger.error("Failed to generate unique barcode after 10 attempts")
            raise HTTPException(status_code=500, detail="Failed to generate unique barcode")
    except Exception as e:
        logger.error(f"Error generating barcode: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate barcode")
    
    m = Member(email=household.owner_email, name=body.name.strip(), household_id=household.id, barcode=barcode)
    db.add(m)
    db.commit()
    db.refresh(m)
    
    logger.info(f"Created household member with barcode", member_id=str(m.id), barcode=barcode, name=body.name)
    
    return {"id": str(m.id), "name": m.name, "barcode": m.barcode}


class AttachMemberBody(BaseModel):
    memberId: str  # Changed from memberCode to memberId
    householdCode: str


@router.post("/households/attach-member")
def households_attach_member(body: AttachMemberBody, request: Request, db: Session = Depends(get_db)):
    from sqlalchemy import select
    from models import Household, Member
    
    # Ensure user is authenticated and can only attach to their own household
    hid = _get_household_id_from_request(request)
    if not hid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Verify the member exists and belongs to the authenticated user's household
    member = db.execute(select(Member).where(Member.id == uuid.UUID(body.memberId))).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Verify the member belongs to the authenticated user's household
    if str(member.household_id) != hid:
        raise HTTPException(status_code=403, detail="Cannot attach member from another household")
    
    # Verify the target household code matches the authenticated user's household
    household = db.execute(select(Household).where(Household.id == uuid.UUID(hid))).scalar_one_or_none()
    if not household or household.household_code != body.householdCode.strip().upper():
        raise HTTPException(status_code=403, detail="Invalid household code")
    
    # No changes needed - member is already in the correct household
    return {"linked": True, "message": "Member is already in the correct household"}

app.include_router(router)

# Sample data insertion removed - no default members created

@app.get("/member/{email}", response_model=models.MemberOut)
@limiter.limit("10/minute")
async def get_member(request: Request, email: str, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.email == email).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    member_data = models.MemberOut.model_validate(member)
    
    return member_data

@app.post("/checkin")
@limiter.limit("5/minute")
async def check_in(request: Request, member_data: dict, db: Session = Depends(get_db)):
    """Handle member check-in (AM/PM logic)"""
    email = member_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    # Get member
    member = db.query(models.Member).filter(models.Member.email == email).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Get Eastern time
    eastern_tz = pytz.timezone('America/New_York')
    now = datetime.now(eastern_tz)
    today = now.date()
    hour = now.hour
    is_am = hour < 12

    # Define AM/PM period start/end
    if is_am:
        period_start = eastern_tz.localize(datetime.combine(today, time(0, 0, 0)))
        period_end = eastern_tz.localize(datetime.combine(today, time(11, 59, 59)))
    else:
        period_start = eastern_tz.localize(datetime.combine(today, time(12, 0, 0)))
        period_end = eastern_tz.localize(datetime.combine(today, time(23, 59, 59)))

    # Convert to UTC for DB query
    period_start_utc = period_start.astimezone(pytz.UTC)
    period_end_utc = period_end.astimezone(pytz.UTC)

    # Check if already checked in this period
    existing = db.query(models.Checkin).filter(
        models.Checkin.member_id == member.id,
        models.Checkin.timestamp >= period_start_utc,
        models.Checkin.timestamp <= period_end_utc
    ).first()
    if existing:
        return {
            "message": f"Already checked in this {'AM' if is_am else 'PM'}.",
            "member_id": member.id,
            "timestamp": existing.timestamp,
            "period": 'AM' if is_am else 'PM',
            "already_checked_in": True
        }

    # Create check-in
    checkin = models.Checkin(member_id=member.id)
    db.add(checkin)
    db.commit()
    db.refresh(checkin)

    # Update metrics
    CHECKIN_COUNT.inc()

    logger.info("Check-in successful", member_id=str(member.id), email=email)

    return {
        "message": "Check-in successful",
        "member_id": member.id,
        "timestamp": checkin.timestamp,
        "period": 'AM' if is_am else 'PM',
        "already_checked_in": False
    }

@app.post("/checkin/by-name")
@limiter.limit("5/minute")
async def check_in_by_name(request: Request, member_data: dict, db: Session = Depends(get_db)):
    """Handle member check-in by full name (case-insensitive, exact match)"""
    name = member_data.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    # Get member by case-insensitive exact match
    member = db.query(models.Member).filter(func.lower(models.Member.name) == name.strip().lower()).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Get Eastern time
    eastern_tz = pytz.timezone('America/New_York')
    now = datetime.now(eastern_tz)
    today = now.date()
    hour = now.hour
    is_am = hour < 12

    # Define AM/PM period start/end
    if is_am:
        period_start = eastern_tz.localize(datetime.combine(today, time(0, 0, 0)))
        period_end = eastern_tz.localize(datetime.combine(today, time(11, 59, 59)))
    else:
        period_start = eastern_tz.localize(datetime.combine(today, time(12, 0, 0)))
        period_end = eastern_tz.localize(datetime.combine(today, time(23, 59, 59)))

    # Convert to UTC for DB query
    period_start_utc = period_start.astimezone(pytz.UTC)
    period_end_utc = period_end.astimezone(pytz.UTC)

    # Check if already checked in this period
    existing = db.query(models.Checkin).filter(
        models.Checkin.member_id == member.id,
        models.Checkin.timestamp >= period_start_utc,
        models.Checkin.timestamp <= period_end_utc
    ).first()
    if existing:
        return {
            "message": f"Already checked in this {'AM' if is_am else 'PM' }.",
            "member_id": member.id,
            "email": member.email,
            "timestamp": existing.timestamp,
            "period": 'AM' if is_am else 'PM',
            "already_checked_in": True
        }

    # Create check-in
    checkin = models.Checkin(member_id=member.id)
    db.add(checkin)
    db.commit()
    db.refresh(checkin)

    # Update metrics
    CHECKIN_COUNT.inc()

    logger.info("Check-in by name successful", member_id=str(member.id), name=name)

    return {
        "message": "Check-in successful",
        "member_id": member.id,
        "email": member.email,
        "timestamp": checkin.timestamp,
        "period": 'AM' if is_am else 'PM',
        "already_checked_in": False
    }

@app.get("/admin/checkins/today")
@limiter.limit("30/minute")
async def get_today_checkins(request: Request, db: Session = Depends(get_db)):
    # Get Toronto timezone
    toronto_tz = pytz.timezone('America/Toronto')
    
    # Get today's date in Toronto
    today = datetime.now(toronto_tz).date()
    
    # Create start and end times in Toronto
    start = toronto_tz.localize(datetime.combine(today, datetime.min.time()))
    end = toronto_tz.localize(datetime.combine(today, datetime.max.time()))
    
    # Convert to UTC for database query
    start_utc = start.astimezone(pytz.UTC)
    end_utc = end.astimezone(pytz.UTC)
    
    # Use optimized query with joins, order by timestamp descending
    checkins = db.query(models.Checkin, models.Member).join(
        models.Member, models.Checkin.member_id == models.Member.id
    ).filter(
        models.Checkin.timestamp >= start_utc,
        models.Checkin.timestamp <= end_utc
    ).order_by(models.Checkin.timestamp.desc()).all()
    
    # Group check-ins by email to identify families
    family_groups = {}
    individual_checkins = []
    
    for checkin, member in checkins:
        email = member.email
        
        if email not in family_groups:
            family_groups[email] = {
                "email": email,
                "members": [],
                "checkin_ids": [],
                "timestamps": []
            }
        
        family_groups[email]["members"].append({
            "checkin_id": str(checkin.id),
            "name": member.name,
            "email": member.email,
            "timestamp": checkin.timestamp.isoformat() + 'Z',
            "member_id": str(member.id)
        })
        family_groups[email]["checkin_ids"].append(str(checkin.id))
        family_groups[email]["timestamps"].append(checkin.timestamp)
    
    result = []
    
    # OPTIMIZATION: Batch query all family members instead of N+1 queries
    if family_groups:
        # Get all unique emails that have check-ins today
        all_emails = list(family_groups.keys())
        
        # Single batch query to get all family members for all emails
        all_family_members = db.query(models.Member).filter(
            models.Member.email.in_(all_emails),
            models.Member.deleted_at.is_(None)
        ).all()
        
        # Group family members by email for fast lookup
        family_members_by_email = {}
        for member in all_family_members:
            if member.email not in family_members_by_email:
                family_members_by_email[member.email] = []
            family_members_by_email[member.email].append(member)
    
    for email, group_data in family_groups.items():
        # Check if this email has multiple family members in the database
        all_family_members = family_members_by_email.get(email, [])
        
        if len(all_family_members) > 1:
            # This is a family - always treat as family regardless of how many are checked in
            # Use the earliest timestamp as the family timestamp to maintain consistency
            family_timestamp = min(group_data["timestamps"])
            result.append({
                "checkin_id": group_data["checkin_ids"][0],  # Use first checkin ID as primary
                "email": email,
                "name": "Family",
                "timestamp": family_timestamp.isoformat() + 'Z',
                "is_family": True,
                "family_members": group_data["members"],
                "member_count": len(group_data["members"])
            })
        else:
            # This is an individual check-in
            individual_checkins.append(group_data["members"][0])
    
    # Add individual check-ins to result
    result.extend(individual_checkins)
    
    # Sort by timestamp (most recent first)
    result.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return result

@app.get("/admin/checkins/range")
@limiter.limit("20/minute")
async def get_checkins_by_range(
    request: Request,
    start_date: date,
    end_date: date,
    group_by: str = "day",  # Options: day, week, month, year
    db: Session = Depends(get_db)
):
    eastern_tz = pytz.timezone('America/New_York')
    
    # Convert dates to datetime with timezone
    start = eastern_tz.localize(datetime.combine(start_date, datetime.min.time()))
    end = eastern_tz.localize(datetime.combine(end_date, datetime.max.time()))
    
    # Convert to UTC for query
    start_utc = start.astimezone(pytz.UTC)
    end_utc = end.astimezone(pytz.UTC)
    
    # Get base query
    query = db.query(models.Checkin).filter(
        models.Checkin.timestamp >= start_utc,
        models.Checkin.timestamp <= end_utc
    )
    
    # Add aggregation based on group_by parameter
    # Convert timestamps to Toronto timezone first, then truncate
    if group_by == "day":
        # Group by day with count (convert to Eastern timezone first)
        results = db.query(
            func.date_trunc('day', func.timezone('America/New_York', models.Checkin.timestamp)).label('date'),
            func.count().label('count')
        ).filter(
            models.Checkin.timestamp >= start_utc,
            models.Checkin.timestamp <= end_utc
        ).group_by('date').order_by('date').all()
    elif group_by == "week":
        results = db.query(
            func.date_trunc('week', func.timezone('America/New_York', models.Checkin.timestamp)).label('date'),
            func.count().label('count')
        ).filter(
            models.Checkin.timestamp >= start_utc,
            models.Checkin.timestamp <= end_utc
        ).group_by('date').order_by('date').all()
    elif group_by == "month":
        results = db.query(
            func.date_trunc('month', func.timezone('America/New_York', models.Checkin.timestamp)).label('date'),
            func.count().label('count')
        ).filter(
            models.Checkin.timestamp >= start_utc,
            models.Checkin.timestamp <= end_utc
        ).group_by('date').order_by('date').all()
    elif group_by == "year":
        results = db.query(
            func.date_trunc('year', func.timezone('America/New_York', models.Checkin.timestamp)).label('date'),
            func.count().label('count')
        ).filter(
            models.Checkin.timestamp >= start_utc,
            models.Checkin.timestamp <= end_utc
        ).group_by('date').order_by('date').all()
    
    return [{
        "date": r.date.isoformat(),  # Already in Eastern timezone after func.timezone conversion
        "count": r.count
    } for r in results]

@app.get("/admin/checkins/stats")
@limiter.limit("20/minute")
async def get_checkin_stats(request: Request, db: Session = Depends(get_db)):
    eastern_tz = pytz.timezone('America/New_York')
    now = datetime.now(eastern_tz)
    today = now.date()
    start = eastern_tz.localize(datetime.combine(today, datetime.min.time()))
    end = eastern_tz.localize(datetime.combine(today, datetime.max.time()))
    start_utc = start.astimezone(pytz.UTC)
    end_utc = end.astimezone(pytz.UTC)
    checkins_today_count = db.query(models.Checkin).filter(
        models.Checkin.timestamp >= start_utc,
        models.Checkin.timestamp <= end_utc
    ).count()
    stats = {
        "total_members": db.query(models.Member).count(),
        "active_members": db.query(models.Member).filter(models.Member.active == True).count(),
        "total_checkins": db.query(models.Checkin).count(),
        "checkins_today": checkins_today_count,
        "checkins_this_week": db.query(models.Checkin).filter(
            models.Checkin.timestamp >= now - timedelta(days=7)
        ).count(),
        "checkins_this_month": db.query(models.Checkin).filter(
            models.Checkin.timestamp >= now - timedelta(days=30)
        ).count(),
    }
    return stats

@app.post("/member")
@limiter.limit("10/minute")
async def create_member(request: Request, member_data: dict, db: Session = Depends(get_db)):
    """Create a new member using the household system"""
    email = member_data.get("email")
    name = member_data.get("name")
    
    if not email or not name:
        raise HTTPException(status_code=400, detail="Email and name are required")
    
    # Capitalize the name before processing
    from util import capitalize_name
    capitalized_name = capitalize_name(name)
    
    # Check if household already exists for this email
    existing_household = db.query(models.Household).filter(models.Household.owner_email == email).first()
    
    if existing_household:
        # Check if member already exists in this household
        existing_member = db.query(models.Member).filter(
            models.Member.household_id == existing_household.id,
            models.Member.name == capitalized_name,
            models.Member.deleted_at.is_(None)
        ).first()
        
        if existing_member:
            raise HTTPException(status_code=409, detail="Member already exists in this household")
    else:
        # Create new household for this email
        existing_household = models.Household(owner_email=email)
        db.add(existing_household)
        db.flush()  # Get the ID without committing
    
    # Generate unique barcode
    while True:
        barcode = generate_barcode()
        # Check if barcode already exists
        existing_barcode = db.query(models.Member).filter(models.Member.barcode == barcode).first()
        if not existing_barcode:
            break
    
    # Create member associated with the household
    member = models.Member(
        email=email, 
        name=capitalized_name, 
        barcode=barcode,
        household_id=existing_household.id
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    
    # Update metrics
    MEMBER_COUNT.inc()
    
    logger.info("Member created with household", member_id=str(member.id), email=email, name=capitalized_name, household_id=str(existing_household.id))
    
    return models.MemberOut.model_validate(member)

@app.post("/member/register-only")
@limiter.limit("10/minute")
async def register_member_only(request: Request, member_data: dict, db: Session = Depends(get_db)):
    """Register a new member without checking them in using the household system"""
    email = member_data.get("email")
    name = member_data.get("name")
    
    if not email or not name:
        raise HTTPException(status_code=400, detail="Email and name are required")
    
    # Capitalize the name before processing
    from util import capitalize_name
    capitalized_name = capitalize_name(name)
    
    # Check if household already exists for this email
    existing_household = db.query(models.Household).filter(models.Household.owner_email == email).first()
    
    if existing_household:
        # Check if member already exists in this household
        existing_member = db.query(models.Member).filter(
            models.Member.household_id == existing_household.id,
            models.Member.name == capitalized_name,
            models.Member.deleted_at.is_(None)
        ).first()
        
        if existing_member:
            # Return existing member instead of error for better UX
            return {
                "message": "Welcome back! Redirecting to your profile.",
                "member": models.MemberOut.model_validate(existing_member),
                "is_existing": True
            }
    else:
        # Create new household for this email
        existing_household = models.Household(owner_email=email)
        db.add(existing_household)
        db.flush()  # Get the ID without committing
    
    # Generate unique barcode
    while True:
        barcode = generate_barcode()
        existing_barcode = db.query(models.Member).filter(models.Member.barcode == barcode).first()
        if not existing_barcode:
            break
    
    # Create member associated with the household
    member = models.Member(
        email=email, 
        name=capitalized_name, 
        barcode=barcode,
        household_id=existing_household.id
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    
    # Update metrics
    MEMBER_COUNT.inc()
    
    logger.info("Member registered with household (no check-in)", member_id=str(member.id), email=email, name=capitalized_name, household_id=str(existing_household.id))
    
    return {
        "message": "Registration successful! Welcome to MAS Academy.",
        "member": models.MemberOut.model_validate(member),
        "is_existing": False
    }

@app.post("/family/register")
@limiter.limit("10/minute")
async def register_family(request: Request, family_data: models.FamilyRegistration, db: Session = Depends(get_db)):
    """Register multiple family members with one email using the household system (no automatic check-in)"""
    email = family_data.email
    members = family_data.members
    
    if not email or not members:
        raise HTTPException(status_code=400, detail="Email and at least one member are required")
    
    # Check if household already exists for this email
    existing_household = db.query(models.Household).filter(models.Household.owner_email == email).first()
    
    if existing_household:
        # Check if any member already exists in this household
        existing_members = []
        for member_info in members:
            existing = db.query(models.Member).filter(
                models.Member.household_id == existing_household.id,
                models.Member.name == member_info.name,
                models.Member.deleted_at.is_(None)
            ).first()
            if existing:
                existing_members.append(member_info.name)
        
        if existing_members:
            raise HTTPException(status_code=409, detail=f"Members already exist in this household: {', '.join(existing_members)}")
    else:
        # Create new household for this email
        existing_household = models.Household(owner_email=email)
        db.add(existing_household)
        db.flush()  # Get the ID without committing
    
    # Create all family members
    created_members = []
    for member_info in members:
        # Capitalize the name before processing
        from util import capitalize_name
        capitalized_name = capitalize_name(member_info.name)
        
        # Generate unique barcode for each family member
        while True:
            barcode = generate_barcode()
            # Check if barcode already exists
            existing_barcode = db.query(models.Member).filter(models.Member.barcode == barcode).first()
            if not existing_barcode:
                break
        
        # Create member associated with the household
        member = models.Member(
            email=email, 
            name=capitalized_name, 
            barcode=barcode,
            household_id=existing_household.id
        )
        db.add(member)
        created_members.append(member)
    
    db.commit()
    
    logger.info("Family registered successfully with household", email=email, member_count=len(members), household_id=str(existing_household.id))
    
    return {
        "message": f"Family registered successfully. {len(members)} members added.",
        "members": [models.MemberOut.model_validate(m) for m in created_members],
        "member_ids": [str(m.id) for m in created_members],  # NEW: include member_ids for frontend
        "household_code": existing_household.household_code  # Include the account number
    }

@app.get("/family/members/{email}")
@limiter.limit("20/minute")
async def get_family_members(request: Request, email: str, db: Session = Depends(get_db)):
    """Get all family members by email using the household system"""
    # Find the first member with this email to get their household
    first_member = db.query(models.Member).filter(
        models.Member.email == email,
        models.Member.deleted_at.is_(None)
    ).first()
    
    if not first_member:
        raise HTTPException(status_code=404, detail="No family members found with this email")
    
    # If the member has a household, get all members from that household
    if first_member.household_id:
        members = db.query(models.Member).filter(
            models.Member.household_id == first_member.household_id,
            models.Member.deleted_at.is_(None)
        ).all()
    else:
        # Fallback to old email-based system for backward compatibility
        members = db.query(models.Member).filter(
            models.Member.email == email
        ).all()
    
    if not members:
        raise HTTPException(status_code=404, detail="No family members found with this email")
    
    return [models.MemberOut.model_validate(member) for member in members]

@app.post("/family/checkin")
@limiter.limit("5/minute")
async def family_checkin(request: Request, checkin_data: models.FamilyCheckin, db: Session = Depends(get_db)):
    """Check in selected family members using the household system"""
    email = checkin_data.email
    member_names = checkin_data.member_names
    
    if not email or not member_names:
        raise HTTPException(status_code=400, detail="Email and member names are required")
    
    # Find the first member with this email to get their household
    first_member = db.query(models.Member).filter(
        models.Member.email == email,
        models.Member.deleted_at.is_(None)
    ).first()
    
    if not first_member:
        raise HTTPException(status_code=404, detail="No family members found with this email")
    
    # Get Eastern time for AM/PM logic
    eastern_tz = pytz.timezone('America/New_York')
    now = datetime.now(eastern_tz)
    today = now.date()
    hour = now.hour
    is_am = hour < 12
    
    # Define AM/PM period
    if is_am:
        period_start = eastern_tz.localize(datetime.combine(today, time(0, 0, 0)))
        period_end = eastern_tz.localize(datetime.combine(today, time(11, 59, 59)))
    else:
        period_start = eastern_tz.localize(datetime.combine(today, time(12, 0, 0)))
        period_end = eastern_tz.localize(datetime.combine(today, time(23, 59, 59)))
    
    # Convert to UTC for DB query
    period_start_utc = period_start.astimezone(pytz.UTC)
    period_end_utc = period_end.astimezone(pytz.UTC)
    
    results = []
    for name in member_names:
        # Get member - try household first, fallback to email
        member = None
        if first_member.household_id:
            member = db.query(models.Member).filter(
                models.Member.household_id == first_member.household_id,
                models.Member.name == name,
                models.Member.deleted_at.is_(None)
            ).first()
        
        if not member:
            # Fallback to old email-based system
            member = db.query(models.Member).filter(
                models.Member.email == email,
                models.Member.name == name,
                models.Member.deleted_at.is_(None)
            ).first()
        
        if not member:
            results.append(f"{name}: Member not found")
            continue
        
        # Check if already checked in this period
        existing = db.query(models.Checkin).filter(
            models.Checkin.member_id == member.id,
            models.Checkin.timestamp >= period_start_utc,
            models.Checkin.timestamp <= period_end_utc
        ).first()
        
        if existing:
            results.append(f"{name}: Already checked in this {'AM' if is_am else 'PM'}")
            continue
        
        # Create check-in
        checkin = models.Checkin(member_id=member.id)
        db.add(checkin)
        CHECKIN_COUNT.inc()
        results.append(f"{name}: Check-in successful")
    
    db.commit()
    
    logger.info("Family check-in completed", email=email, members=member_names)
    
    return {
        "message": "Family check-in completed",
        "results": results
    }

@app.get("/family/checkin-status/{email}")
@limiter.limit("10/minute")
async def family_checkin_status(request: Request, email: str, db: Session = Depends(get_db)):
    """Return which family members have checked in and which have not for the current day and AM/PM period."""
    # Find the first member with this email to get their household
    first_member = db.query(models.Member).filter(
        models.Member.email == email,
        models.Member.deleted_at.is_(None)
    ).first()
    
    if not first_member:
        raise HTTPException(status_code=404, detail="No family members found with this email")
    
    # Get all active family members - try household first, fallback to email
    members = []
    if first_member.household_id:
        members = db.query(models.Member).filter(
            models.Member.household_id == first_member.household_id,
            models.Member.deleted_at.is_(None)
        ).all()
    
    if not members:
        # Fallback to old email-based system
        members = db.query(models.Member).filter(
            models.Member.email == email,
            models.Member.deleted_at.is_(None)
        ).all()
    
    if not members:
        raise HTTPException(status_code=404, detail="No family members found with this email")

    # Get Eastern time and AM/PM period
    eastern_tz = pytz.timezone('America/New_York')
    now = datetime.now(eastern_tz)
    today = now.date()
    hour = now.hour
    is_am = hour < 12
    if is_am:
        period_start = eastern_tz.localize(datetime.combine(today, time(0, 0, 0)))
        period_end = eastern_tz.localize(datetime.combine(today, time(11, 59, 59)))
    else:
        period_start = eastern_tz.localize(datetime.combine(today, time(12, 0, 0)))
        period_end = eastern_tz.localize(datetime.combine(today, time(23, 59, 59)))
    period_start_utc = period_start.astimezone(pytz.UTC)
    period_end_utc = period_end.astimezone(pytz.UTC)

    checked_in = []
    not_checked_in = []
    for member in members:
        existing = db.query(models.Checkin).filter(
            models.Checkin.member_id == member.id,
            models.Checkin.timestamp >= period_start_utc,
            models.Checkin.timestamp <= period_end_utc
        ).first()
        if existing:
            checked_in.append(member.name)
        else:
            not_checked_in.append(member.name)
    return {
        "checked_in": checked_in,
        "not_checked_in": not_checked_in,
        "period": "AM" if is_am else "PM",
        "date": today.isoformat()
    }

@app.get("/members")
@limiter.limit("20/minute")
async def get_members(request: Request, db: Session = Depends(get_db)):
    """Get all members ordered by join date with household account numbers"""
    from sqlalchemy.orm import joinedload
    
    # Join with household to get account number
    members = db.query(models.Member).options(
        joinedload(models.Member.household)
    ).order_by(models.Member.created_at.desc()).all()
    
    members_data = []
    for member in members:
        member_dict = models.MemberOut.model_validate(member).model_dump()
        # Add household_code (account number) if household exists
        if member.household:
            member_dict['household_code'] = member.household.household_code
        members_data.append(member_dict)
    
    return members_data

class MemberUpdate(BaseModel):
    name: str
    email: str

def calculate_streak(check_ins: List[datetime]) -> Dict:
    if not check_ins:
        return {"current_streak": 0, "highest_streak": 0}
    
    # Sort check-ins by date
    dates = sorted(set(c.date() for c in check_ins))
    
    current_streak = 0
    highest_streak = 0
    temp_streak = 0
    
    # Calculate streaks
    for i in range(len(dates)):
        if i == 0:
            temp_streak = 1
        else:
            # Check if dates are consecutive
            if (dates[i] - dates[i-1]).days == 1:
                temp_streak += 1
            else:
                temp_streak = 1
        
        highest_streak = max(highest_streak, temp_streak)
        
        # Check if we're in a current streak (continues to today)
        if i == len(dates) - 1:
            if (date.today() - dates[i]).days <= 1:
                current_streak = temp_streak
            else:
                current_streak = 0
    
    return {
        "current_streak": current_streak,
        "highest_streak": highest_streak
    }

@app.get("/member/{member_id}/stats")
@limiter.limit("30/minute")
async def get_member_stats(request: Request, member_id: str, db: Session = Depends(get_db)):
    """Get member statistics including monthly check-ins and streaks"""
    
    # Validate UUID format
    if not is_valid_uuid(member_id):
        raise HTTPException(status_code=400, detail="Invalid member ID format")
    
    # Get member
    member = db.query(models.Member).filter(models.Member.id == uuid.UUID(member_id)).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Get timezone
    tz = pytz.timezone('America/New_York')
    
    # Calculate start of current month
    now = datetime.now(tz)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get all check-ins for streak calculation
    all_check_ins = db.query(models.Checkin.timestamp)\
        .filter(models.Checkin.member_id == uuid.UUID(member_id))\
        .all()
    
    # Convert to list of datetime objects
    check_in_dates = [c.timestamp for c in all_check_ins]
    
    # Get monthly check-ins count
    monthly_check_ins = db.query(func.count(models.Checkin.id))\
        .filter(
            and_(
                models.Checkin.member_id == uuid.UUID(member_id),
                models.Checkin.timestamp >= start_of_month
            )
        ).scalar()
    
    # Calculate streaks
    streak_info = calculate_streak(check_in_dates)
    
    stats = {
        "monthly_check_ins": monthly_check_ins,
        "current_streak": streak_info["current_streak"],
        "highest_streak": streak_info["highest_streak"],
        "member_since": member.created_at.strftime("%B %Y"),
        "check_in_dates": [dt.isoformat() for dt in check_in_dates],
        "name": member.name,  # Always include name
        "email": member.email, # Always include email
        "barcode": member.barcode  # Include barcode for display
    }
    
    return stats 

@app.post("/member/lookup-by-name")
@limiter.limit("10/minute")
async def lookup_member_by_name(request: Request, data: dict = Body(...), db: Session = Depends(get_db)):
    """Look up a member by their name for check-in purposes"""
    
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Search for member by name (case-insensitive, trimmed)
    member = db.query(models.Member).filter(
        func.lower(func.trim(models.Member.name)) == func.lower(name),
        models.Member.deleted_at.is_(None)
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    logger.info("Member lookup by name", name=name, member_id=str(member.id), email=member.email)
    
    return {
        "id": str(member.id),
        "email": member.email,
        "name": member.name
    }

@app.put("/member/{member_id}")
@limiter.limit("5/minute")
async def update_member(request: Request, member_id: str, update: models.MemberUpdate, db: Session = Depends(get_db)):
    """Update member information"""
    # Validate UUID format
    if not is_valid_uuid(member_id):
        raise HTTPException(status_code=400, detail="Invalid member ID format")
    
    # Get member
    member = db.query(models.Member).filter(
        models.Member.id == uuid.UUID(member_id),
        models.Member.deleted_at.is_(None)
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Capitalize the name before updating
    from util import capitalize_name
    capitalized_name = capitalize_name(update.name)
    
    # Update fields
    setattr(member, 'name', capitalized_name)
    
    # If email is being changed, update all family members
    old_email = member.email
    new_email = update.email
    
    if old_email != new_email:
        # Update all family members with the same email
        family_members = db.query(models.Member).filter(
            models.Member.email == old_email,
            models.Member.deleted_at.is_(None)
        ).all()
        
        for family_member in family_members:
            setattr(family_member, 'email', new_email)
        
        logger.info("Family email updated", old_email=old_email, new_email=new_email, member_count=len(family_members))
    else:
        # Just update the name
        logger.info("Member name updated", member_id=str(member.id), old_name=member.name, new_name=update.name)
    
    db.commit()
    db.refresh(member)
    
    logger.info("Member updated", member_id=str(member.id))
    
    return models.MemberOut.model_validate(member)

@app.delete("/member/{member_id}")
@limiter.limit("5/minute")
async def delete_member(request: Request, member_id: str, db: Session = Depends(get_db)):
    """Hard delete a member"""
    # Validate UUID format
    if not is_valid_uuid(member_id):
        raise HTTPException(status_code=400, detail="Invalid member ID format")
    
    # Convert string to UUID object
    member_uuid = uuid.UUID(member_id)
    
    # Get member
    member = db.query(models.Member).filter(
        models.Member.id == member_uuid
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Delete all associated check-ins first
    checkins = db.query(models.Checkin).filter(
        models.Checkin.member_id == member_uuid
    ).all()
    
    for checkin in checkins:
        db.delete(checkin)
    
    # Now delete the member
    db.delete(member)
    db.commit()
    
    logger.info("Member hard deleted", member_id=str(member.id), name=member.name, email=member.email)
    
    return {"message": "Member deleted successfully"}

@app.delete("/family/{email}")
@limiter.limit("5/minute")
async def delete_family(request: Request, email: str, db: Session = Depends(get_db)):
    """Delete entire family account including household and all members"""
    # Find the household for this family
    household = db.query(models.Household).filter(
        models.Household.owner_email == email
    ).first()
    
    if not household:
        raise HTTPException(status_code=404, detail="Family not found")
    
    # Get all family members
    family_members = db.query(models.Member).filter(
        models.Member.household_id == household.id
    ).all()
    
    if not family_members:
        raise HTTPException(status_code=404, detail="No family members found")
    
    try:
        # Delete all check-ins for all family members
        for member in family_members:
            checkins = db.query(models.Checkin).filter(
                models.Checkin.member_id == member.id
            ).all()
            
            for checkin in checkins:
                db.delete(checkin)
        
        # Delete all family members
        for member in family_members:
            db.delete(member)
        
        # Delete the household (this will also delete the account number)
        db.delete(household)
        
        db.commit()
        
        logger.info("Family account deleted", 
                   household_id=str(household.id), 
                   household_code=household.household_code,
                   member_count=len(family_members),
                   email=email)
        
        return {
            "message": f"Family account deleted successfully. Removed {len(family_members)} members and account number {household.household_code}.",
            "deleted_members": len(family_members),
            "deleted_household_code": household.household_code
        }
        
    except Exception as e:
        db.rollback()
        logger.error("Failed to delete family account", error=str(e), email=email)
        raise HTTPException(status_code=500, detail="Failed to delete family account")

@app.post("/member/{member_id}/restore")
@limiter.limit("5/minute")
async def restore_member(request: Request, member_id: str, db: Session = Depends(get_db)):
    """Restore a soft-deleted member"""
    # Validate UUID format
    if not is_valid_uuid(member_id):
        raise HTTPException(status_code=400, detail="Invalid member ID format")
    
    # Get member
    member = db.query(models.Member).filter(
        models.Member.id == member_id,
        models.Member.deleted_at.is_not(None)
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Member not found or not deleted")
    
    # Restore
    setattr(member, 'deleted_at', None)
    db.commit()
    
    logger.info("Member restored", member_id=str(member.id), name=member.name, email=member.email)
    
    return models.MemberOut.model_validate(member)

@app.post("/family/add-members")
@limiter.limit("10/minute")
async def add_family_members(request: Request, add_data: dict, db: Session = Depends(get_db)):
    """Add new members to an existing family account using the household system"""
    email = add_data.get("email")
    new_members = add_data.get("new_members", [])
    
    if not email or not new_members:
        raise HTTPException(status_code=400, detail="Email and new members are required")
    
    # Find the existing member and their household
    existing_member = db.query(models.Member).filter(
        models.Member.email == email,
        models.Member.deleted_at.is_(None)
    ).first()
    
    if not existing_member:
        raise HTTPException(status_code=404, detail="Family not found")
    
    # Get the household for this family
    household = None
    if existing_member.household_id:
        household = db.query(models.Household).filter(models.Household.id == existing_member.household_id).first()
    
    if not household:
        raise HTTPException(status_code=404, detail="Household not found for this family")
    
    # Check if any new member already exists in this household
    existing_new_members = []
    for member_name in new_members:
        existing = db.query(models.Member).filter(
            models.Member.household_id == household.id,
            models.Member.name == member_name,
            models.Member.deleted_at.is_(None)
        ).first()
        if existing:
            existing_new_members.append(member_name)
    
    if existing_new_members:
        raise HTTPException(status_code=409, detail=f"Members already exist in this family: {', '.join(existing_new_members)}")
    
    # Add new family members to the same household
    created_members = []
    for member_name in new_members:
        # Generate unique barcode for each new family member
        while True:
            barcode = generate_barcode()
            # Check if barcode already exists
            existing_barcode = db.query(models.Member).filter(models.Member.barcode == barcode).first()
            if not existing_barcode:
                break
        
        # Create new member with the same household_id (same account code)
        member = models.Member(
            email=email, 
            name=member_name, 
            barcode=barcode,
            household_id=household.id  # This ensures they share the same account code
        )
        db.add(member)
        created_members.append(member)
        MEMBER_COUNT.inc()
    
    db.commit()
    
    # Get all family members after addition (from the same household)
    all_family_members = db.query(models.Member).filter(
        models.Member.household_id == household.id,
        models.Member.deleted_at.is_(None)
    ).all()
    
    logger.info("Members added to family", 
                household_id=str(household.id), 
                household_code=household.household_code,
                new_members=new_members, 
                total_family_size=len(all_family_members))
    
    return {
        "message": f"Added {len(created_members)} new members to family account {household.household_code}",
        "household_code": household.household_code,
        "new_members": [models.MemberOut.model_validate(m) for m in created_members],
        "all_family_members": [models.MemberOut.model_validate(m) for m in all_family_members]
    }

@app.get("/member/lookup-by-barcode/{barcode}")
@limiter.limit("50/minute")  # Higher limit for scanning operations
async def lookup_member_by_barcode(request: Request, barcode: str, db: Session = Depends(get_db)):
    """Look up a member by their barcode or email for scanning check-in"""
    if not barcode:
        raise HTTPException(status_code=400, detail="Barcode or email is required")
    
    # First try to find by barcode
    member = db.query(models.Member).filter(
        models.Member.barcode == barcode,
        models.Member.deleted_at.is_(None)
    ).first()
    
    if not member:
        # If not found by barcode, try by email (for family QR codes)
        member = db.query(models.Member).filter(
            models.Member.email == barcode,
            models.Member.deleted_at.is_(None)
        ).first()
        
        if not member:
            raise HTTPException(status_code=404, detail="Member not found with this barcode or email")
        
        # For family QR codes, return the first family member as representative
        logger.info("Family QR code scanned", email=barcode, member_id=str(member.id), member_name=member.name)
    else:
        logger.info("Individual barcode scanned", member_id=str(member.id), barcode=barcode, member_name=member.name)
    
    return models.MemberOut.model_validate(member)

@app.post("/checkin-by-barcode")
@limiter.limit("50/minute")  # Higher limit for scanning operations
async def checkin_by_barcode(request: Request, checkin_data: dict, db: Session = Depends(get_db)):
    """Check in a member using their barcode or email - automatically handles family check-ins"""
    barcode = checkin_data.get("barcode")
    
    if not barcode:
        raise HTTPException(status_code=400, detail="Barcode or email is required")
    
    # First try to find by barcode
    member = db.query(models.Member).filter(
        models.Member.barcode == barcode,
        models.Member.deleted_at.is_(None)
    ).first()
    
    if not member:
        # If not found by barcode, try by email (for family QR codes)
        member = db.query(models.Member).filter(
            models.Member.email == barcode,
            models.Member.deleted_at.is_(None)
        ).first()
        
        if not member:
            raise HTTPException(status_code=404, detail="Member not found with this barcode or email")
    
    # Get timezone for Eastern
    eastern_tz = pytz.timezone('America/New_York')
    now = datetime.now(eastern_tz)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    
    # Check if this member already checked in today
    existing_checkin = db.query(models.Checkin).filter(
        models.Checkin.member_id == member.id,
        models.Checkin.timestamp >= start_of_day,
        models.Checkin.timestamp < end_of_day
    ).first()
    
    if existing_checkin:
        raise HTTPException(status_code=409, detail=f"{member.name} has already checked in today")
    
    # Check if this is a family (multiple members with same email)
    family_members = db.query(models.Member).filter(
        models.Member.email == member.email,
        models.Member.deleted_at.is_(None)
    ).all()
    
    if len(family_members) > 1:
        # This is a family - check in all family members with the same timestamp
        checked_in_members = []
        family_timestamp = datetime.now(pytz.UTC)  # Use the same timestamp for all family members
        
        for family_member in family_members:
            # Check if this family member already checked in today
            existing_family_checkin = db.query(models.Checkin).filter(
                models.Checkin.member_id == family_member.id,
                models.Checkin.timestamp >= start_of_day,
                models.Checkin.timestamp < end_of_day
            ).first()
            
            if not existing_family_checkin:
                # Create check-in for this family member with the same timestamp
                family_checkin = models.Checkin(member_id=family_member.id, timestamp=family_timestamp)
                db.add(family_checkin)
                checked_in_members.append(family_member.name)
        
        db.commit()
        
        # Update metrics
        CHECKIN_COUNT.inc(len(checked_in_members))
        
        logger.info("Family checked in by barcode/email", 
                   primary_member_id=str(member.id), 
                   barcode=barcode, 
                   family_size=len(family_members),
                   checked_in_count=len(checked_in_members))
        
        return {
            "message": f"Family check-in successful! {len(checked_in_members)} members checked in.",
            "family_checkin": True,
            "member_count": len(checked_in_members),
            "family_size": len(family_members),
            "checked_in_members": checked_in_members,
            "primary_member": models.MemberOut.model_validate(member)
        }
    else:
        # Individual member
        checkin = models.Checkin(member_id=member.id)
        db.add(checkin)
        db.commit()
        db.refresh(checkin)
        
        # Update metrics
        CHECKIN_COUNT.inc()
        
        logger.info("Individual member checked in by barcode/email", 
                   member_id=str(member.id), 
                   barcode=barcode, 
                   checkin_id=str(checkin.id))
        
        return {
            "message": f"{member.name} checked in successfully!",
            "family_checkin": False,
            "member_name": member.name,
            "member": models.MemberOut.model_validate(member),
            "checkin_id": str(checkin.id),
            "timestamp": checkin.timestamp
        }

@app.post("/admin/checkin/member")
@limiter.limit("10/minute")
async def admin_checkin_member(request: Request, checkin_data: dict, db: Session = Depends(get_db)):
    """Admin endpoint to check in a specific family member"""
    member_id = checkin_data.get("member_id")
    timestamp_str = checkin_data.get("timestamp")  # Optional, defaults to now
    
    if not member_id:
        raise HTTPException(status_code=400, detail="Member ID is required")
    
    # Validate UUID format
    if not is_valid_uuid(member_id):
        raise HTTPException(status_code=400, detail="Invalid member ID format")
    
    # Get member
    member = db.query(models.Member).filter(
        models.Member.id == uuid.UUID(member_id),
        models.Member.deleted_at.is_(None)
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Use provided timestamp or current time
    if timestamp_str:
        try:
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid timestamp format")
    else:
        timestamp = datetime.now(pytz.UTC)
    
    # Check if already checked in at this timestamp (within 1 minute)
    start_time = timestamp - timedelta(minutes=1)
    end_time = timestamp + timedelta(minutes=1)
    
    existing = db.query(models.Checkin).filter(
        models.Checkin.member_id == uuid.UUID(member_id),
        models.Checkin.timestamp >= start_time,
        models.Checkin.timestamp <= end_time
    ).first()
    
    if existing:
        return {
            "message": "Member already checked in at this time",
            "checkin_id": str(existing.id),
            "already_checked_in": True
        }
    
    # Create check-in
    checkin = models.Checkin(member_id=uuid.UUID(member_id), timestamp=timestamp)
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    
    # Update metrics
    CHECKIN_COUNT.inc()
    
    logger.info("Admin check-in created", member_id=member_id, member_name=member.name, checkin_id=str(checkin.id))
    
    return {
        "message": f"{member.name} checked in successfully",
        "checkin_id": str(checkin.id),
        "member_name": member.name,
        "timestamp": checkin.timestamp.isoformat(),
        "already_checked_in": False
    }

@app.delete("/admin/checkin/{checkin_id}")
@limiter.limit("10/minute")
async def admin_delete_checkin(request: Request, checkin_id: str, db: Session = Depends(get_db)):
    """Admin endpoint to delete a specific check-in"""
    if not is_valid_uuid(checkin_id):
        raise HTTPException(status_code=400, detail="Invalid check-in ID format")
    
    # Get check-in
    checkin = db.query(models.Checkin).filter(models.Checkin.id == uuid.UUID(checkin_id)).first()
    
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in not found")
    
    # Get member name for logging
    member = db.query(models.Member).filter(models.Member.id == checkin.member_id).first()
    member_name = member.name if member else "Unknown"
    
    # Delete check-in
    db.delete(checkin)
    db.commit()
    
    logger.info("Admin check-in deleted", checkin_id=checkin_id, member_name=member_name)
    
    return {
        "message": f"Check-in for {member_name} deleted successfully",
        "deleted_checkin_id": checkin_id
    }

@app.get("/admin/household/{account_code}")
@limiter.limit("20/minute")
async def admin_get_household_by_code(request: Request, account_code: str, db: Session = Depends(get_db)):
    """Admin endpoint to find a household by account code and get its members for manual check-in"""
    # Validate account code format
    if not is_valid_account_code(account_code):
        raise HTTPException(status_code=400, detail="Invalid account code format")
    
    # Find household by code (case-insensitive)
    from sqlalchemy import func
    household = db.query(models.Household).filter(
        func.upper(models.Household.household_code) == account_code.strip().upper()
    ).first()
    
    if not household:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Get all members for this household
    members = db.query(models.Member).filter(
        models.Member.household_id == household.id,
        models.Member.deleted_at.is_(None)
    ).order_by(models.Member.name).all()
    
    # Check which members are already checked in today
    today_start = datetime.now(pytz.UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    member_data = []
    for member in members:
        # Check if member is already checked in today
        existing_checkin = db.query(models.Checkin).filter(
            models.Checkin.member_id == member.id,
            models.Checkin.timestamp >= today_start,
            models.Checkin.timestamp < today_end
        ).first()
        
        member_data.append({
            "id": str(member.id),
            "name": member.name,
            "email": member.email,
            "barcode": member.barcode,
            "already_checked_in": existing_checkin is not None,
            "checkin_id": str(existing_checkin.id) if existing_checkin else None,
            "checkin_time": existing_checkin.timestamp.isoformat() if existing_checkin else None
        })
    
    return {
        "household_id": str(household.id),
        "household_code": household.household_code,
        "owner_email": household.owner_email,
        "members": member_data,
        "member_count": len(member_data)
    }

# Admin authentication removed - admin routes are now open access 

# Lightweight session probe for app bootstrap
@router.get("/auth/session")
def auth_session(request: Request, db: Session = Depends(get_db)):
    from sqlalchemy import select
    from models import Household
    hid = _get_household_id_from_request(request)
    if not hid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    household = db.execute(select(Household).where(Household.id == uuid.UUID(hid))).scalar_one_or_none()
    if not household:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"ok": True, "householdId": str(household.id), "email": household.owner_email} 