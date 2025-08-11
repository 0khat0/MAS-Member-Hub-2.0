import random

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # exclude I,O,0,1


def _gen(n: int) -> str:
    return "".join(random.choice(ALPHABET) for _ in range(n))


def gen_code_member(n: int = 7) -> str:
    return _gen(n)


def gen_code_household(n: int = 7) -> str:
    return "MAS-" + _gen(n)


