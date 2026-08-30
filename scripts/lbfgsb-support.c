/* Browser-only f2c runtime subset for the BSD-3-Clause L-BFGS-B 2.1 build. */
#include "f2c.h"
#include <string.h>

integer s_cmp(char *left, char *right, ftnlen left_length, ftnlen right_length) {
  ftnlen index;
  ftnlen length = left_length > right_length ? left_length : right_length;
  for (index = 0; index < length; ++index) {
    unsigned char left_value = index < left_length ? (unsigned char)left[index] : ' ';
    unsigned char right_value = index < right_length ? (unsigned char)right[index] : ' ';
    if (left_value != right_value) return left_value < right_value ? -1 : 1;
  }
  return 0;
}

int s_copy(char *target, char *source, ftnlen target_length, ftnlen source_length) {
  ftnlen index;
  ftnlen copied = target_length < source_length ? target_length : source_length;
  if (copied > 0) memmove(target, source, (size_t)copied);
  for (index = copied; index < target_length; ++index) target[index] = ' ';
  return 0;
}

integer f_open(olist *value) { (void)value; return 0; }
integer s_wsfe(cilist *value) { (void)value; return 0; }
integer do_fio(integer *count, char *value, ftnlen length) {
  (void)count; (void)value; (void)length; return 0;
}
integer e_wsfe(void) { return 0; }
integer s_wsle(cilist *value) { (void)value; return 0; }
integer do_lio(integer *type, integer *count, char *value, ftnlen length) {
  (void)type; (void)count; (void)value; (void)length; return 0;
}
integer e_wsle(void) { return 0; }
real etime_(real *values) { values[0] = 0; values[1] = 0; return 0; }
