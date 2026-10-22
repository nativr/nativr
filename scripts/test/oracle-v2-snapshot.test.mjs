import assert from "node:assert/strict";
import test from "node:test";
import { snapshotToPlain } from "../lib/oracle-v2-snapshot.mjs";
const string = (value) => ({ version: 1, type: "character", values: [value] });
const object = (fields) => ({
  version: 1,
  type: "list",
  names: Object.keys(fields),
  values: Object.values(fields),
});
test("decodes historical whole-NA token without reinterpretation", () => {
  assert.deepEqual(snapshotToPlain(object({ kind: string("complex-na") })), { kind: "complex-na" });
});
test("retains tagged mixed-NA component position and infinity sign", () => {
  const graph = object({
    kind: string("complex-components"),
    real: object({ kind: string("double-na") }),
    imaginary: object({ kind: string("double-negative-infinity") }),
  });
  assert.deepEqual(snapshotToPlain(graph), {
    kind: "complex-components",
    real: { kind: "double-na" },
    imaginary: { kind: "double-negative-infinity" },
  });
});
test("retains finite and negative-zero component tags in nested graph lists", () => {
  const token = object({
    kind: string("complex-components"),
    real: object({
      kind: string("double"),
      value: { version: 1, type: "double", values: new Float64Array([3.25]) },
    }),
    imaginary: object({ kind: string("double-negative-zero") }),
  });
  assert.deepEqual(snapshotToPlain({ version: 1, type: "list", values: [token] }), [
    {
      kind: "complex-components",
      real: { kind: "double", value: 3.25 },
      imaginary: { kind: "double-negative-zero" },
    },
  ]);
});
test("rejects raw complex snapshots before typed-array coercion or missingness loss", () => {
  for (const snapshot of [
    { version: 1, type: "complex", real: new Float64Array([]), imaginary: new Float64Array([]) },
    { version: 1, type: "complex", real: new Float64Array([1]), imaginary: new Float64Array([2]) },
    {
      version: 1,
      type: "complex",
      real: new Float64Array([0, NaN]),
      imaginary: new Float64Array([Infinity, 0]),
      missing: new Uint8Array([1, 0]),
    },
  ])
    assert.throws(() => snapshotToPlain(snapshot), /untagged complex snapshot/u);
});
test("rejects an untagged complex value nested in an otherwise tagged graph", () => {
  const nested = object({
    kind: string("complex-components"),
    real: {
      version: 1,
      type: "complex",
      real: new Float64Array([1]),
      imaginary: new Float64Array([2]),
    },
  });
  assert.throws(() => snapshotToPlain(nested), /untagged complex snapshot/u);
});
test("preserves unrelated list, scalar, missing and duplicate-name decoding", () => {
  assert.deepEqual(
    snapshotToPlain(
      object({
        yes: { version: 1, type: "logical", values: new Uint8Array([1]) },
        no: { version: 1, type: "null" },
        missing: {
          version: 1,
          type: "double",
          values: new Float64Array([0]),
          missing: new Uint8Array([1]),
        },
      }),
    ),
    { yes: true, no: null, missing: null },
  );
  assert.deepEqual(
    snapshotToPlain({
      version: 1,
      type: "list",
      names: ["x", "x"],
      values: [string("a"), string("b")],
    }),
    ["a", "b"],
  );
});
