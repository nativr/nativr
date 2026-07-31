import {
  REvaluationError,
  RTypeMismatchError,
  R_NULL,
  characterVector,
  createForcedPromise,
  integerVector,
  isFactor,
  isMissing,
  isVector,
  listValue,
  lookupBinding,
  subsetVector,
  vectorDimensions,
  vectorNames,
  withAttribute,
  withDimensions,
  withoutAttribute,
} from "@nativr/runtime";
import type {
  BuiltinCallArgument,
  BuiltinInvocation,
  RList,
  RValue,
  RVector,
} from "@nativr/runtime";

import { matchBuiltinArguments } from "./arguments.js";

export interface OuterBuiltinSpec {
  readonly name: "outer" | "%o%";
  readonly parameters: readonly string[];
  readonly compatibility: "behavioral";
  readonly implementation: (invocation: BuiltinInvocation) => Promise<RValue>;
}

export const OUTER_BUILTIN_SPECS: readonly OuterBuiltinSpec[] = [
  {
    name: "outer",
    parameters: ["X", "Y", "FUN", "..."],
    compatibility: "behavioral",
    implementation: (invocation) => builtinOuter(invocation, false),
  },
  {
    name: "%o%",
    parameters: ["X", "Y"],
    compatibility: "behavioral",
    implementation: (invocation) => builtinOuter(invocation, true),
  },
];

interface OuterAxes {
  readonly dimensions: readonly number[];
  readonly values: readonly RValue[];
  readonly labels?: readonly string[];
  readonly present: boolean;
}

async function builtinOuter(
  invocation: BuiltinInvocation,
  multiplicationOperator: boolean,
): Promise<RValue> {
  const { matched, dots } = matchBuiltinArguments(
    invocation,
    multiplicationOperator ? ["X", "Y"] : ["X", "Y", "FUN", "..."],
  );
  const xArgument = requiredOuterArgument(matched.get("X"), "X");
  const yArgument = requiredOuterArgument(matched.get("Y"), "Y");
  const originalX = await invocation.force(xArgument.promise);
  const originalY = await invocation.force(yArgument.promise);
  const x = outerInput(originalX, "X");
  const y = outerInput(originalY, "Y");
  const funArgument = matched.get("FUN");
  const suppliedFun =
    funArgument === undefined ? undefined : await invocation.force(funArgument.promise);
  const callable = await outerCallable(invocation, suppliedFun);
  const multiplication =
    multiplicationOperator ||
    suppliedFun === undefined ||
    (suppliedFun.type === "character" &&
      suppliedFun.length === 1 &&
      !isMissing(suppliedFun, 0) &&
      suppliedFun.values[0] === "*") ||
    (callable.type === "builtin" && callable.definition.name === "*");
  if (multiplication) {
    requireOuterNumeric(originalX, "X");
    requireOuterNumeric(originalY, "Y");
  }

  const product = x.length * y.length;
  invocation.context.allocate(product);
  const xIndices = Array.from({ length: product }, (_, index) => {
    invocation.context.checkpoint();
    return (index % x.length) + 1;
  });
  const yIndices = Array.from({ length: product }, (_, index) => {
    invocation.context.checkpoint();
    return Math.floor(index / x.length) + 1;
  });
  const xValues = subsetVector(x, integerVector(xIndices), invocation.context);
  const yValues = subsetVector(y, integerVector(yIndices), invocation.context);
  const environment = invocation.currentEnvironment();
  const result = await invocation.invokeLazy(callable, [
    { promise: createForcedPromise(xValues, environment) },
    { promise: createForcedPromise(yValues, environment) },
    ...dots,
  ]);
  if (!isVector(result) || result.length !== product) {
    throw new RTypeMismatchError(
      "NRT3270",
      `outer() FUN must return a vector of length ${product}.`,
    );
  }

  const xAxes = outerAxes(originalX, x.length);
  const yAxes = outerAxes(originalY, y.length);
  let shaped = withoutAttribute(
    withoutAttribute(withoutAttribute(result, "names"), "dimnames"),
    "dim",
  );
  shaped = withDimensions(shaped, [...xAxes.dimensions, ...yAxes.dimensions]);
  if (xAxes.present || yAxes.present) {
    const values = [...xAxes.values, ...yAxes.values];
    const labels =
      xAxes.labels === undefined && yAxes.labels === undefined
        ? undefined
        : [
            ...(xAxes.labels ?? xAxes.dimensions.map(() => "")),
            ...(yAxes.labels ?? yAxes.dimensions.map(() => "")),
          ];
    shaped = withAttribute(
      shaped,
      "dimnames",
      labels === undefined ? listValue(values) : listValue(values, labels),
    );
  }
  return shaped;
}

function requiredOuterArgument(
  argument: BuiltinCallArgument | undefined,
  name: "X" | "Y",
): BuiltinCallArgument {
  if (argument === undefined || argument.promise.missing) {
    throw new REvaluationError("NRE2103", `Argument '${name}' is missing in outer().`);
  }
  return argument;
}

function outerInput(value: RValue, name: string): RVector {
  if (value.type === "null") return integerVector([]);
  if (!isVector(value)) {
    throw new RTypeMismatchError("NRT3270", `outer(${name}=) must be a vector or array.`);
  }
  return value;
}

function requireOuterNumeric(value: RValue, name: string): void {
  if (
    (value.type !== "logical" &&
      value.type !== "integer" &&
      value.type !== "double" &&
      value.type !== "complex") ||
    isFactor(value)
  ) {
    throw new RTypeMismatchError(
      "NRT3270",
      `outer(${name}=) must be numeric or complex for multiplication.`,
    );
  }
}

async function outerCallable(
  invocation: BuiltinInvocation,
  supplied: RValue | undefined,
): Promise<RValue> {
  if (supplied?.type === "closure" || supplied?.type === "builtin") return supplied;
  const name =
    supplied === undefined
      ? "*"
      : supplied.type === "character" && supplied.length === 1 && !isMissing(supplied, 0)
        ? (supplied.values[0] ?? "")
        : "";
  if (name.length === 0) {
    throw new RTypeMismatchError("NRT3270", "outer(FUN=) must identify a function.");
  }
  const binding = lookupBinding(invocation.currentEnvironment(), name);
  if (binding === undefined) {
    throw new REvaluationError("NRE2001", `Could not find function '${name}'.`);
  }
  const callable = binding.type === "promise" ? await invocation.force(binding) : binding;
  if (callable.type !== "closure" && callable.type !== "builtin") {
    throw new RTypeMismatchError("NRT3270", `outer(FUN='${name}') is not a function.`);
  }
  return callable;
}

function outerAxes(value: RValue, length: number): OuterAxes {
  if (value.type === "null") {
    return { dimensions: [0], values: [R_NULL], present: false };
  }
  if (!isVector(value)) {
    throw new RTypeMismatchError("NRT3270", "outer() dimensions require vector inputs.");
  }
  const dimensions = vectorDimensions(value);
  if (dimensions === undefined) {
    const names = vectorNames(value);
    return {
      dimensions: [length],
      values: [names === undefined ? R_NULL : characterVector(names)],
      present: names !== undefined,
    };
  }
  const dimnames = outerDimensionNames(value, dimensions);
  const labels = dimnames === undefined ? undefined : vectorNames(dimnames);
  return {
    dimensions,
    values: dimnames?.values ?? dimensions.map(() => R_NULL),
    ...(labels === undefined ? {} : { labels }),
    present: dimnames !== undefined,
  };
}

function outerDimensionNames(value: RVector, dimensions: readonly number[]): RList | undefined {
  const dimnames = value.attributes.get("dimnames");
  if (dimnames === undefined) return undefined;
  if (
    dimnames.type !== "list" ||
    dimnames.length !== dimensions.length ||
    dimnames.values.some(
      (axis, index) =>
        axis.type !== "null" && (axis.type !== "character" || axis.length !== dimensions[index]),
    )
  ) {
    throw new RTypeMismatchError("NRT3270", "outer() input dimnames are malformed.");
  }
  return dimnames;
}
