/** Validate RFC 4648 canonical base64 in linear time and constant stack space. */
export function isCanonicalBase64(source: string): boolean {
  if (source.length % 4 !== 0) return false;
  const padding = source.endsWith("==") ? 2 : source.endsWith("=") ? 1 : 0;
  const contentLength = source.length - padding;
  for (let index = 0; index < contentLength; index += 1) {
    if (base64Value(source.charCodeAt(index)) < 0) return false;
  }
  for (let index = contentLength; index < source.length; index += 1) {
    if (source.charCodeAt(index) !== 0x3d) return false;
  }
  if (padding === 2) return (base64Value(source.charCodeAt(source.length - 3)) & 0x0f) === 0;
  if (padding === 1) return (base64Value(source.charCodeAt(source.length - 2)) & 0x03) === 0;
  return true;
}

function base64Value(code: number): number {
  if (code >= 0x41 && code <= 0x5a) return code - 0x41;
  if (code >= 0x61 && code <= 0x7a) return code - 0x61 + 26;
  if (code >= 0x30 && code <= 0x39) return code - 0x30 + 52;
  if (code === 0x2b) return 62;
  if (code === 0x2f) return 63;
  return -1;
}
