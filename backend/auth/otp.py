import hashlib
import time
from typing import Dict, Tuple

_otp_buckets: Dict[str, Tuple[int, int]] = {}
# value schema: (last_sent_epoch_seconds, day_count_window)


def generate_otp() -> str:
    import random
    return f"{random.randint(0, 999999):06d}"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def mask_email(email: str) -> str:
    try:
        local, domain = email.split("@")
        masked_local = (local[0] + "***") if len(local) > 0 else "***"
        domain_main, *domain_rest = domain.split(".")
        masked_domain = (domain_main[0] + "***") if len(domain_main) > 0 else "***"
        tld = "." + ".".join(domain_rest) if domain_rest else ""
        return f"{masked_local}@{masked_domain}{tld}"
    except Exception:
        return "***@***"


def rate_limit_ok(key: str) -> bool:
    """Simple per-process rate limit: at most 1/min and 5/day for given key."""
    now = int(time.time())
    last, day_count = _otp_buckets.get(key, (0, 0))
    # 1 per minute
    if now - last < 60:
        return False
    # Reset daily window every 24h since last
    if now - last > 24 * 3600:
        day_count = 0
    if day_count >= 5:
        return False
    _otp_buckets[key] = (now, day_count + 1)
    return True


def is_valid_account_code(code: str) -> bool:
    """Validate account code format: exactly 5 characters from A-Z, 2-9 (exclude I,O,0,1)."""
    if not code or len(code) != 5:
        return False
    return all(c in "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" for c in code.upper())


