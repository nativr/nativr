# SPDX-License-Identifier: Apache-2.0
# Independent high-precision reference for RFC-0007 (test-time only, never shipped).
#
# Usage: python -I mpmath-reference.py <mpmath-dir> <input.json> <output.json>
#
# The input is {"cases": [[function, [arg-bits, ...]], ...]} with each argument a 16-digit hex
# binary64 bit pattern. The output is {"mpmath": version, "results": [bits-or-"nan", ...]}: the
# round-to-nearest-even binary64 value of the exact mathematical result. Each value is evaluated
# at increasing working precision until two consecutive precisions round to the same binary64
# value (Ziv's strategy), so the answer does not depend on mpmath's last-bit accuracy. Results that
# are not real (domain errors) are reported as "nan". Signed zeros and infinite inputs are outside
# this tool's scope; the caller checks them against IEEE 754 directly.
import json
import struct
import sys

sys.path.insert(0, sys.argv[1])
import mpmath  # noqa: E402
from mpmath import mp  # noqa: E402

FIRST_PRECISION = 160
LAST_PRECISION = 20480


def from_bits(text):
    return mp.mpf(struct.unpack("<d", struct.pack("<Q", int(text, 16)))[0])


def cbrt(x):
    return -mp.cbrt(-x) if x < 0 else mp.cbrt(x)


FUNCTIONS = {
    "exp": mp.exp,
    "expm1": mp.expm1,
    "log": mp.log,
    "log1p": mp.log1p,
    "log2": lambda x: mp.log(x, 2),
    "log10": mp.log10,
    "pow": mp.power,
    "sin": mp.sin,
    "cos": mp.cos,
    "tan": mp.tan,
    "asin": mp.asin,
    "acos": mp.acos,
    "atan": mp.atan,
    "atan2": mp.atan2,
    "sinh": mp.sinh,
    "cosh": mp.cosh,
    "tanh": mp.tanh,
    "asinh": mp.asinh,
    "acosh": mp.acosh,
    "atanh": mp.atanh,
    "cbrt": cbrt,
    "hypot": mp.hypot,
}


def round_binary64(value):
    """Round a finite mpf to binary64 (ties to even) and return its bit pattern."""
    sign, man, exp, bc = value._mpf_
    if man == 0:
        return 0
    top = exp + bc - 1
    sign_bit = (1 << 63) if sign else 0
    if top < -1076:  # below half the smallest subnormal: rounds to zero
        return sign_bit
    if top > 1024:  # at least 2^1025: overflows
        return sign_bit | (0x7FF << 52)
    quantum = max(top - 52, -1074)
    if exp >= quantum:
        m = man << (exp - quantum)
    else:
        shift = quantum - exp
        m = man >> shift
        rest = man & ((1 << shift) - 1)
        half = 1 << (shift - 1)
        if rest > half or (rest == half and m & 1):
            m += 1
    if m == 1 << 53:
        m >>= 1
        quantum += 1
    if m >= 1 << 52:
        biased = quantum + 52 + 1023
        if biased >= 2047:
            return sign_bit | (0x7FF << 52)
        return sign_bit | (biased << 52) | (m - (1 << 52))
    return sign_bit | m


def evaluate(name, args):
    function = FUNCTIONS[name]
    previous = None
    precision = FIRST_PRECISION
    while precision <= LAST_PRECISION:
        mp.prec = precision
        try:
            value = function(*[from_bits(arg) for arg in args])
        except (ValueError, ZeroDivisionError):
            return "nan"
        if not isinstance(value, mpmath.mpf):
            if value.imag != 0:
                return "nan"
            value = value.real
        if not mp.isfinite(value):
            return "nan" if mp.isnan(value) else ("fff0000000000000" if value < 0 else "7ff0000000000000")
        bits = round_binary64(value)
        if bits == previous:
            return f"{bits:016x}"
        previous = bits
        precision *= 2
    raise RuntimeError(f"{name}{tuple(args)} did not converge by {LAST_PRECISION} bits")


def main():
    with open(sys.argv[2], encoding="utf8") as handle:
        cases = json.load(handle)["cases"]
    results = [evaluate(name, args) for name, args in cases]
    with open(sys.argv[3], "w", encoding="utf8") as handle:
        json.dump({"mpmath": mpmath.__version__, "results": results}, handle)


main()
