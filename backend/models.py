import uuid
from datetime import datetime
import pytz
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy import event
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from database import Base
from datetime import timedelta


class Household(Base):
    __tablename__ = "households"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_email = Column(String, nullable=False, index=True)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    email_verification_token_hash = Column(Text, nullable=True)
    email_verification_expires_at = Column(DateTime(timezone=True), nullable=True)
    household_code = Column(String, nullable=True, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.UTC), index=True)

    members = relationship("Member", back_populates="household")

def generate_barcode():
    """Generate a unique 12-digit barcode for member identification"""
    import random
    # Generate a 12-digit number starting with 1 (to avoid leading zeros issues)
    return str(random.randint(100000000000, 999999999999))

class Member(Base):
    __tablename__ = "members"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, index=True)  # Removed unique=True to allow multiple members per email
    name = Column(String, nullable=False, index=True)
    barcode = Column(String, nullable=True, unique=True, index=True)  # Unique barcode for scanning
    active = Column(Boolean, default=True, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)  # Soft delete support
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.UTC), index=True)
    household_id = Column(UUID(as_uuid=True), ForeignKey("households.id", ondelete="SET NULL"), nullable=True, index=True)
    member_code = Column(String, nullable=True, unique=True, index=True)
    checkins = relationship("Checkin", back_populates="member")
    household = relationship("Household", back_populates="members")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_member_email_active', 'email', 'active'),
        Index('idx_member_created_active', 'created_at', 'active'),
        Index('idx_member_email_deleted', 'email', 'deleted_at'),  # For family queries
    )


# Code generation helpers on insert
try:
    from util.codes import gen_code_member, gen_code_household
except Exception:
    # Fallback to local generation if util not yet imported (e.g., during initial migrations)
    ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    def gen_code_member(n: int = 7):
        import random
        return "".join(random.choice(ALPHABET) for _ in range(n))
    def gen_code_household(n: int = 5):
        import random
        return "MAS-" + "".join(random.choice(ALPHABET) for _ in range(n))


@event.listens_for(Member, "before_insert")
def set_member_code(mapper, connection, target: "Member"):
    if not target.member_code:
        # Retry a few times to avoid rare collisions at DB unique constraint
        for _ in range(5):
            candidate = gen_code_member(7)
            target.member_code = candidate
            break


@event.listens_for(Household, "before_insert")
def set_household_code(mapper, connection, target: "Household"):
    if target.owner_email:
        target.owner_email = target.owner_email.strip().lower()
    if not target.household_code:
        target.household_code = gen_code_household(5)

class Checkin(Base):
    __tablename__ = "checkins"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id = Column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(pytz.UTC), index=True)
    member = relationship("Member", back_populates="checkins")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_checkin_member_timestamp', 'member_id', 'timestamp'),
        Index('idx_checkin_timestamp_desc', 'timestamp', postgresql_using='btree'),
        Index('idx_checkin_date', 'timestamp', postgresql_using='btree'),
    )

# Pydantic Schemas
class MemberBase(BaseModel):
    email: str
    name: str
    active: Optional[bool] = True

class MemberCreate(MemberBase):
    pass

class MemberUpdate(BaseModel):
    name: str
    email: str

class MemberOut(MemberBase):
    id: uuid.UUID
    barcode: Optional[str] = None
    created_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Family-specific schemas
class FamilyMemberCreate(BaseModel):
    name: str

class FamilyRegistration(BaseModel):
    email: str
    members: List[FamilyMemberCreate]

class FamilyCheckin(BaseModel):
    email: str
    member_names: List[str]  # Names of members to check in

class CheckinBase(BaseModel):
    email: str

class CheckinCreate(CheckinBase):
    pass

class CheckinOut(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    timestamp: datetime
    member: Optional[MemberOut]

    class Config:
        from_attributes = True 