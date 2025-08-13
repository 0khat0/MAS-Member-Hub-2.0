import random

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # exclude I,O,0,1


def _gen(n: int) -> str:
    return "".join(random.choice(ALPHABET) for _ in range(n))


def gen_code_household(n: int = 5) -> str:
    """Generate a random 5-character household code (account number)."""
    return _gen(n)


