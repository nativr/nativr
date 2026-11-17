const ROTATIONS = Object.freeze([
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]);

const CONSTANTS = Object.freeze(
  Array.from(
    { length: 64 },
    (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x1_0000_0000) >>> 0,
  ),
);

/** Compute an RFC 1321 MD5 digest without host crypto or Node built-ins. */
export function md5Hex(input: Uint8Array, checkpoint: () => void = () => undefined): string {
  const paddedLength = Math.ceil((input.byteLength + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.byteLength] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLengthLow = (input.byteLength * 8) >>> 0;
  const bitLengthHigh = Math.floor(input.byteLength / 0x2000_0000) >>> 0;
  view.setUint32(paddedLength - 8, bitLengthLow, true);
  view.setUint32(paddedLength - 4, bitLengthHigh, true);

  let a0 = 0x6745_2301;
  let b0 = 0xefcd_ab89;
  let c0 = 0x98ba_dcfe;
  let d0 = 0x1032_5476;

  for (let block = 0; block < paddedLength; block += 64) {
    checkpoint();
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let index = 0; index < 64; index += 1) {
      let mixed: number;
      let word: number;
      if (index < 16) {
        mixed = (b & c) | (~b & d);
        word = index;
      } else if (index < 32) {
        mixed = (d & b) | (~d & c);
        word = (5 * index + 1) % 16;
      } else if (index < 48) {
        mixed = b ^ c ^ d;
        word = (3 * index + 5) % 16;
      } else {
        mixed = c ^ (b | ~d);
        word = (7 * index) % 16;
      }
      const sum =
        (a + mixed + (CONSTANTS[index] ?? 0) + view.getUint32(block + word * 4, true)) >>> 0;
      const rotation = ROTATIONS[index] ?? 0;
      const rotated = ((sum << rotation) | (sum >>> (32 - rotation))) >>> 0;
      const previousD = d;
      d = c;
      c = b;
      b = (b + rotated) >>> 0;
      a = previousD;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0]
    .flatMap((word) => [word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, word >>> 24])
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
