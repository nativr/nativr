// SPDX-License-Identifier: Apache-2.0
// NativR export shim for the pinned CORE-MATH binary64 sources (RFC-0007).
//
// The CORE-MATH translation units are compiled unmodified. This file only declares their entry
// points, adds element-wise vector loops so callers cross the Wasm boundary once per vector, and
// defines a bump-reservation helper for linear memory. It must never contain numerical code.

#include <stddef.h>
#include <stdint.h>

#define UNARY(name) double cr_##name(double);
#define BINARY(name) double cr_##name(double, double);
#include "functions.h"
#undef UNARY
#undef BINARY

#define EXPORT(name) __attribute__((export_name(name)))

#define UNARY(name)                                                                     \
  EXPORT(#name) double nativr_##name(double x) { return cr_##name(x); }                \
  EXPORT("v_" #name) void nativr_v_##name(const double *x, double *out, uint32_t n) {    \
    for (uint32_t i = 0; i < n; i++) out[i] = cr_##name(x[i]);                         \
  }
#define BINARY(name)                                                                    \
  EXPORT(#name) double nativr_##name(double x, double y) { return cr_##name(x, y); }   \
  EXPORT("v_" #name) void nativr_v_##name(const double *x, const double *y, double *out, \
                                          uint32_t n) {                                \
    for (uint32_t i = 0; i < n; i++) out[i] = cr_##name(x[i], y[i]);                   \
  }
#include "functions.h"
#undef UNARY
#undef BINARY

extern unsigned char __heap_base;

// Returns the start of a scratch region of at least `bytes` bytes above the static data, growing
// linear memory when needed. The region is reused by every call; it is not an allocator.
EXPORT("reserve") void *nativr_reserve(uint32_t bytes) {
  uintptr_t start = ((uintptr_t)&__heap_base + 15u) & ~(uintptr_t)15u;
  uintptr_t end = start + bytes;
  uintptr_t have = __builtin_wasm_memory_size(0) * 65536u;
  if (end > have) {
    uintptr_t pages = (end - have + 65535u) / 65536u;
    if (__builtin_wasm_memory_grow(0, pages) == (size_t)-1) return 0;
  }
  return (void *)start;
}

// pow.c and atan2.c keep upstream diagnostics for input classes their authors believe unreachable;
// they call printf (which clang may lower to puts) and exit. Defining these here keeps libc's stdio
// and WASI process imports out of the module: reaching a diagnostic traps instead of printing.
int printf(const char *format, ...) {
  (void)format;
  __builtin_trap();
}

int puts(const char *text) {
  (void)text;
  __builtin_trap();
}

void exit(int status) {
  (void)status;
  __builtin_trap();
}
