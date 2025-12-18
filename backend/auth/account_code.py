"""
Account-code utilities.

This app intentionally does NOT support OTP or email verification flows.
The only supported credential for returning users is the household account code.
"""


def is_valid_account_code(code: str) -> bool:
    """
    Validate account code format: exactly 5 characters from A-Z, 2-9
    (exclude I,O,0,1 to reduce confusion).
    """
    if not code or len(code) != 5:
        return False
    return all(c in "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" for c in code.upper())


