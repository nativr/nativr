import {
  REvaluationError,
  RTypeMismatchError,
  doubleVector,
  isMissing,
  listValue,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinDefinition,
  BuiltinInvocation,
  RValue,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";

const SPAN = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

const PARAMETERS = ["x", "y", "kernel", "bandwidth", "range.x", "n.points", "x.points"];

export const KERNEL_SMOOTH_BUILTIN_SPEC: {
  readonly name: "ksmooth";
  readonly parameters: readonly string[];
  readonly compatibility: "numeric";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
  readonly formals: NonNullable<BuiltinDefinition["formals"]>;
} = {
  name: "ksmooth",
  parameters: PARAMETERS,
  compatibility: "numeric",
  implementation: builtinKernelSmooth,
  formals: [
    { name: "x", span: SPAN },
    { name: "y", span: SPAN },
    {
      name: "kernel",
      defaultValue: {
        kind: "CallExpression",
        callee: { kind: "Identifier", name: "c", span: SPAN },
        arguments: [
          { value: { kind: "StringLiteral", value: "box", span: SPAN }, span: SPAN },
          { value: { kind: "StringLiteral", value: "normal", span: SPAN }, span: SPAN },
        ],
        span: SPAN,
      },
      span: SPAN,
    },
    {
      name: "bandwidth",
      defaultValue: { kind: "DoubleLiteral", value: 0.5, span: SPAN },
      span: SPAN,
    },
    {
      name: "range.x",
      defaultValue: {
        kind: "CallExpression",
        callee: { kind: "Identifier", name: "range", span: SPAN },
        arguments: [{ value: { kind: "Identifier", name: "x", span: SPAN }, span: SPAN }],
        span: SPAN,
      },
      span: SPAN,
    },
    {
      name: "n.points",
      defaultValue: {
        kind: "CallExpression",
        callee: { kind: "Identifier", name: "max", span: SPAN },
        arguments: [
          { value: { kind: "IntegerLiteral", value: 100, span: SPAN }, span: SPAN },
          {
            value: {
              kind: "CallExpression",
              callee: { kind: "Identifier", name: "length", span: SPAN },
              arguments: [{ value: { kind: "Identifier", name: "x", span: SPAN }, span: SPAN }],
              span: SPAN,
            },
            span: SPAN,
          },
        ],
        span: SPAN,
      },
      span: SPAN,
    },
    { name: "x.points", span: SPAN },
  ],
};

async function builtinKernelSmooth(invocation: BuiltinInvocation): Promise<RValue> {
  const { matched } = matchBuiltinArguments(invocation, PARAMETERS);
  const x = numericValues(await required(invocation, matched.get("x"), "x"), "x");
  const y = numericValues(await required(invocation, matched.get("y"), "y"), "y");
  const kernel = await kernelControl(invocation, matched.get("kernel"));
  const bandwidthValue = await optional(invocation, matched.get("bandwidth"));
  const bandwidth = bandwidthValue === undefined ? 0.5 : scalar(bandwidthValue, "bandwidth");

  const xPointsArgument = matched.get("x.points");
  let points: number[];
  if (xPointsArgument !== undefined && !xPointsArgument.promise.missing) {
    points = numericValues(await invocation.force(xPointsArgument.promise), "x.points");
  } else {
    const rangeValue = await optional(invocation, matched.get("range.x"));
    const range =
      rangeValue === undefined
        ? [Math.min(...x), Math.max(...x)]
        : numericValues(rangeValue, "range.x");
    const countValue = await optional(invocation, matched.get("n.points"));
    const count =
      countValue === undefined
        ? Math.max(100, x.length)
        : Math.trunc(scalar(countValue, "n.points"));
    if (range.length < 2 || !Number.isFinite(range[0]) || !Number.isFinite(range[1])) {
      throw new RTypeMismatchError("NRT3430", "'range.x' must contain two finite values");
    }
    if (!Number.isFinite(count) || count < 1) {
      throw new RTypeMismatchError("NRT3430", "'n.points' must be a positive finite number");
    }
    const start = range[0] ?? 0;
    const end = range[1] ?? 0;
    points = Array.from({ length: count }, (_unused, index) =>
      count === 1 ? start : start + ((end - start) * index) / (count - 1),
    );
  }
  points.sort((left, right) => left - right);

  const rows = x
    .map((coordinate, index) => ({ x: coordinate, y: y[index] ?? Number.NaN }))
    .sort((left, right) => left.x - right.x);
  const output = new Float64Array(points.length);
  const missing = new Uint8Array(points.length);
  const normalScale = bandwidth * 0.3706506;
  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    invocation.context.checkpoint();
    const point = points[pointIndex] ?? 0;
    let weightSum = 0;
    let weightedValue = 0;
    for (const row of rows) {
      const distance = Math.abs(row.x - point);
      let weight = 0;
      if (kernel === "box") {
        if (distance <= bandwidth / 2) weight = 1;
      } else if (normalScale > 0 && distance <= 4 * normalScale) {
        const standardized = distance / normalScale;
        weight = Math.exp(-0.5 * standardized * standardized);
      } else if (normalScale === 0 && distance === 0) weight = 1;
      if (weight === 0) continue;
      weightSum += weight;
      weightedValue += weight * row.y;
    }
    if (weightSum === 0 || Number.isNaN(weightedValue)) {
      missing[pointIndex] = 1;
    } else output[pointIndex] = weightedValue / weightSum;
  }
  invocation.context.allocate(points.length * 2 + 1);
  return listValue(
    [
      doubleVector(points),
      doubleVector(output, missing.some((value) => value === 1) ? missing : undefined),
    ],
    ["x", "y"],
  );
}

async function required(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
  name: string,
): Promise<RValue> {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing.`);
  }
  return invocation.force(argument.promise);
}

async function optional(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<RValue | undefined> {
  return argument === undefined || argument.promise.missing
    ? undefined
    : invocation.force(argument.promise);
}

function numericValues(value: RValue, name: string): number[] {
  if (value.type !== "logical" && value.type !== "integer" && value.type !== "double") {
    throw new RTypeMismatchError("NRT3430", `'${name}' must be numeric`);
  }
  return Array.from({ length: value.length }, (_unused, index) =>
    isMissing(value, index) ? Number.NaN : (value.values[index] ?? Number.NaN),
  );
}

function scalar(value: RValue, name: string): number {
  const values = numericValues(value, name);
  if (values.length === 0) throw new RTypeMismatchError("NRT3430", `'${name}' has length zero`);
  return values[0] ?? Number.NaN;
}

async function kernelControl(
  invocation: BuiltinInvocation,
  argument: BuiltinCallArgument | undefined,
): Promise<"box" | "normal"> {
  const value = await optional(invocation, argument);
  if (value === undefined) return "box";
  if (value.type !== "character" || value.length === 0 || isMissing(value, 0)) {
    throw new RTypeMismatchError("NRT3430", `'kernel' must select "box" or "normal"`);
  }
  const requested = value.values[0] ?? "";
  const matches = (["box", "normal"] as const).filter((candidate) =>
    candidate.startsWith(requested),
  );
  if (matches.length !== 1) {
    throw new RTypeMismatchError("NRT3430", `'arg' should be one of "box", "normal"`);
  }
  return matches[0] as "box" | "normal";
}
