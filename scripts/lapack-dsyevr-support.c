/* NativR-owned browser support for the f2c-generated LAPACK DSYEVR closure. */
#include "f2c.h"
#include <float.h>
#include <math.h>

logical disnan_(doublereal *value) { return isnan(*value) ? TRUE_ : FALSE_; }
logical dlaisnan_(doublereal *left, doublereal *right) {
  return (*left != *right) ? TRUE_ : FALSE_;
}

doublereal dlamch_(char *cmach, ftnlen cmach_len) {
  (void)cmach_len;
  switch (*cmach >= 'a' && *cmach <= 'z' ? *cmach - ('a' - 'A') : *cmach) {
    case 'E': return DBL_EPSILON * 0.5;
    case 'S': return DBL_MIN;
    case 'B': return (doublereal)FLT_RADIX;
    case 'P': return DBL_EPSILON;
    case 'N': return (doublereal)DBL_MANT_DIG;
    case 'R': return 1.0;
    case 'M': return (doublereal)DBL_MIN_EXP;
    case 'U': return DBL_MIN;
    case 'L': return (doublereal)DBL_MAX_EXP;
    case 'O': return DBL_MAX;
    default: return 0.0;
  }
}

int xerbla_(char *name, integer *info, ftnlen name_len) {
  (void)name; (void)info; (void)name_len;
  return 0;
}

integer iparam2stage_(integer *ispec, char *name, char *opts, integer *ni,
                     integer *nbi, integer *ibi, integer *nxi,
                     ftnlen name_len, ftnlen opts_len) {
  (void)ispec; (void)name; (void)opts; (void)ni; (void)nbi; (void)ibi; (void)nxi;
  (void)name_len; (void)opts_len;
  return -1;
}

doublereal dnrm2_(integer *n, doublereal *x, integer *incx) {
  if (*n < 1 || *incx < 1) return 0.0;
  doublereal scale = 0.0, sumsq = 1.0;
  integer index = 0;
  for (integer count = 0; count < *n; ++count, index += *incx) {
    const doublereal value = fabs(x[index]);
    if (value == 0.0) continue;
    if (scale < value) {
      const doublereal ratio = scale / value;
      sumsq = 1.0 + sumsq * ratio * ratio;
      scale = value;
    } else {
      const doublereal ratio = value / scale;
      sumsq += ratio * ratio;
    }
  }
  return scale * sqrt(sumsq);
}

int dlassq_(integer *n, doublereal *x, integer *incx,
            doublereal *scale, doublereal *sumsq) {
  if (*n <= 0 || *incx <= 0) return 0;
  integer index = 0;
  for (integer count = 0; count < *n; ++count, index += *incx) {
    const doublereal value = fabs(x[index]);
    if (value == 0.0) continue;
    if (*scale < value) {
      const doublereal ratio = *scale / value;
      *sumsq = 1.0 + *sumsq * ratio * ratio;
      *scale = value;
    } else {
      const doublereal ratio = value / *scale;
      *sumsq += ratio * ratio;
    }
  }
  return 0;
}

doublereal d_sign(doublereal *a, doublereal *b) {
  const doublereal magnitude = fabs(*a);
  return *b >= 0.0 ? magnitude : -magnitude;
}

integer i_len(char *value, ftnlen length) {
  (void)value;
  return (integer)length;
}

int s_copy(char *target, char *source, ftnlen target_length, ftnlen source_length) {
  ftnlen index = 0;
  for (; index < target_length && index < source_length; ++index) target[index] = source[index];
  for (; index < target_length; ++index) target[index] = ' ';
  return 0;
}

integer s_cmp(char *left, char *right, ftnlen left_length, ftnlen right_length) {
  const ftnlen common = left_length < right_length ? left_length : right_length;
  for (ftnlen index = 0; index < common; ++index) {
    const unsigned char l = (unsigned char)left[index];
    const unsigned char r = (unsigned char)right[index];
    if (l != r) return (integer)l - (integer)r;
  }
  if (left_length > common) {
    for (ftnlen index = common; index < left_length; ++index) {
      if (left[index] != ' ') return (integer)(unsigned char)left[index] - (integer)' ';
    }
  } else {
    for (ftnlen index = common; index < right_length; ++index) {
      if (right[index] != ' ') return (integer)' ' - (integer)(unsigned char)right[index];
    }
  }
  return 0;
}

int s_cat(char *target, char **sources, integer *lengths, integer *count, ftnlen target_length) {
  ftnlen written = 0;
  for (integer source = 0; source < *count && written < target_length; ++source) {
    for (integer index = 0; index < lengths[source] && written < target_length; ++index) {
      target[written++] = sources[source][index];
    }
  }
  while (written < target_length) target[written++] = ' ';
  return 0;
}

doublereal pow_di(doublereal *base, integer *exponent) {
  integer power = *exponent;
  doublereal factor = *base, result = 1.0;
  if (power < 0) { factor = 1.0 / factor; power = -power; }
  while (power != 0) {
    if (power & 1) result *= factor;
    power >>= 1;
    if (power != 0) factor *= factor;
  }
  return result;
}

integer i_nint(real *value) {
  return (integer)(*value >= 0.0f ? floor((double)*value + 0.5) : -floor(0.5 - (double)*value));
}
