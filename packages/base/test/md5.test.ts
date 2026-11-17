import { describe, expect, it } from "vitest";

import { md5Hex } from "../src/md5.js";

const encoder = new TextEncoder();

describe("browser-owned MD5", () => {
  it.each([
    ["", "d41d8cd98f00b204e9800998ecf8427e"],
    ["a", "0cc175b9c0f1b6a831c399e269772661"],
    ["abc", "900150983cd24fb0d6963f7d28e17f72"],
    ["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
    ["abcdefghijklmnopqrstuvwxyz", "c3fcd3d76192e4007dfb496cca67e13b"],
  ])("hashes the RFC vector %j", (source, expected) => {
    expect(md5Hex(encoder.encode(source))).toBe(expected);
  });
});
