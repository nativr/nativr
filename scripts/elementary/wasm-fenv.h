// SPDX-License-Identifier: Apache-2.0
// Forced-include shim for compiling unmodified CORE-MATH sources to wasm32 (RFC-0007).
//
// WebAssembly has a single rounding mode (round to nearest, ties to even) and no floating-point
// exception flags, so wasi-libc defines only FE_TONEAREST and FE_ALL_EXCEPT (0). CORE-MATH names
// the other C99 macros to raise or save flags and to branch on fegetround(). The flag macros below
// are 0, which makes every flag operation a no-op, exactly what the target provides. The directed
// rounding modes get distinct values so `switch (fegetround())` compiles; wasi-libc's fegetround
// always returns FE_TONEAREST, so those branches are unreachable. With CORE_MATH_SUPPORT_ERRNO
// left undefined, no CORE-MATH result depends on a flag.
#pragma once
#include <fenv.h>

#ifndef FE_INVALID
#define FE_INVALID 0
#endif
#ifndef FE_DIVBYZERO
#define FE_DIVBYZERO 0
#endif
#ifndef FE_OVERFLOW
#define FE_OVERFLOW 0
#endif
#ifndef FE_UNDERFLOW
#define FE_UNDERFLOW 0
#endif
#ifndef FE_INEXACT
#define FE_INEXACT 0
#endif
#ifndef FE_DOWNWARD
#define FE_DOWNWARD 0x400
#endif
#ifndef FE_UPWARD
#define FE_UPWARD 0x800
#endif
#ifndef FE_TOWARDZERO
#define FE_TOWARDZERO 0xc00
#endif
