import { describe, expect, it } from "vitest";

// Intended maintained location: packages/base/test/printf-resource.test.ts.
import { formatFloatingMagnitude } from "../src/printf.js";

const byteLimit =
  (limit: number, failure = new Error("owned formatting budget exceeded")) =>
  (length: number): void => {
    if (!Number.isSafeInteger(length) || length < 0 || length > limit) throw failure;
  };

describe("bounded exact floating formatting", () => {
  // These expected values follow the exact terminating binary fraction 1/8, independently of
  // the formatter implementation. These tests never request native R allocations.
  it.each([1074, 1075, 1200])("retains all %i fixed fractional places", (precision) => {
    const expected = "0.125" + "0".repeat(precision - 3);
    expect(formatFloatingMagnitude(0.125, "f", precision, false, byteLimit(expected.length))).toBe(
      expected,
    );
  });

  it.each([
    [1074, "e"],
    [1075, "e"],
    [1200, "e"],
    [1074, "E"],
    [1075, "E"],
    [1200, "E"],
  ] as const)("retains %i significand decimals before the %s exponent", (precision, conversion) => {
    const expected = "1.25" + "0".repeat(precision - 2) + conversion + "-01";
    expect(
      formatFloatingMagnitude(0.125, conversion, precision, false, byteLimit(expected.length)),
    ).toBe(expected);
  });

  it.each([
    [0.125, "0.125" + "0".repeat(1197)],
    [1e20, "100000000000000000000." + "0".repeat(1179)],
    [2 ** -17, "7.62939453125" + "0".repeat(1188) + "e-06"],
  ] as const)("retains alternate-form significant zeros for %s", (value, expected) => {
    expect(formatFloatingMagnitude(value, "g", 1200, true, byteLimit(expected.length))).toBe(
      expected,
    );
  });

  it.each([
    [0, "g", "0"],
    [0.125, "g", "0.125"],
    [1e20, "g", "100000000000000000000"],
    [2 ** -17, "g", "7.62939453125e-06"],
    [2 ** -17, "G", "7.62939453125E-06"],
  ] as const)(
    "keeps high-precision %s/%s small without alternate form",
    (value, conversion, expected) => {
      // NativR-only resource invariant, not a claim about native huge format-field parsing.
      expect(
        formatFloatingMagnitude(value, conversion, 1e12, false, byteLimit(expected.length)),
      ).toBe(expected);
    },
  );

  it.each([
    [0.125, "f", 2, false, "0.12"],
    [0.375, "f", 2, false, "0.38"],
    [2.5, "f", 0, false, "2"],
    [3.5, "f", 0, false, "4"],
    [1.25, "e", 1, false, "1.2e+00"],
    [9.999, "g", 3, false, "10"],
    [9.999, "g", 3, true, "10.0"],
    [0.0001, "g", 4, false, "0.0001"],
    [0.00001, "g", 4, false, "1e-05"],
    [1, "g", 3, true, "1.00"],
    [1, "e", 0, true, "1.e+00"],
    [1, "f", 0, true, "1."],
  ] as const)(
    "preserves ordinary rounding/notation for %s/%s/%i/%s",
    (value, conversion, precision, alternate, expected) => {
      expect(
        formatFloatingMagnitude(
          value,
          conversion,
          precision,
          alternate,
          byteLimit(expected.length),
        ),
      ).toBe(expected);
    },
  );

  it.each(["f", "F", "e", "E", "g", "G"] as const)(
    "rejects an impossible finite %s expansion through the guard",
    (conversion) => {
      const failure = new Error("owned pre-allocation sentinel");
      expect(() =>
        formatFloatingMagnitude(1.25, conversion, 1e12, true, byteLimit(64, failure)),
      ).toThrow(failure);
    },
  );

  it("accepts an exact final-text budget and rejects a one-byte-short budget", () => {
    expect(formatFloatingMagnitude(1.25, "f", 2, false, byteLimit(4))).toBe("1.25");
    expect(() => formatFloatingMagnitude(1.25, "f", 2, false, byteLimit(3))).toThrow(
      "owned formatting budget exceeded",
    );
    // The budget applies after %g removes insignificant zeros, not to its bounded work buffer.
    expect(formatFloatingMagnitude(0.125, "g", 1200, false, byteLimit(5))).toBe("0.125");
    expect(() => formatFloatingMagnitude(0.125, "g", 1200, false, byteLimit(4))).toThrow(
      "owned formatting budget exceeded",
    );
  });

  it("keeps sign application with the caller, including negative zero", () => {
    expect(formatFloatingMagnitude(-0, "f", 2, false, byteLimit(4))).toBe("0.00");
    expect(formatFloatingMagnitude(-0, "e", 2, false, byteLimit(8))).toBe("0.00e+00");
    expect(formatFloatingMagnitude(-0, "g", 4, true, byteLimit(5))).toBe("0.000");
    expect(formatFloatingMagnitude(-0.125, "f", 3, false, byteLimit(5))).toBe("0.125");
  });
});
