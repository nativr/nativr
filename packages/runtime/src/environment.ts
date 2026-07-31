import { REvaluationError } from "./errors.js";
import type { AstNode } from "@nativr/ast";
import type { RBinding, REnvironment, RPromise, RValue } from "./values.js";

let nextEnvironmentId = 1;

/** Create one mutable lexical environment. */
export function createEnvironment(parent: REnvironment | null, hashed = false): REnvironment {
  return {
    type: "environment",
    id: nextEnvironmentId++,
    parent,
    hashed,
    bindings: new Map(),
  };
}

/** Install or replace a binding in one environment. */
export function setBinding(environment: REnvironment, name: string, value: RBinding): void {
  environment.bindings.set(name, value);
}

/** Resolve a binding through the lexical parent chain. */
export function lookupBinding(environment: REnvironment, name: string): RBinding | undefined {
  let current: REnvironment | null = environment;
  while (current !== null) {
    const value = current.bindings.get(name);
    if (value !== undefined) return value;
    current = current.parent;
  }
  return undefined;
}

/** Construct an unforced lazy promise, optionally recording an omitted defaulted argument. */
export function createPromise(
  expression: AstNode,
  environment: REnvironment,
  missing = false,
): RPromise {
  return {
    type: "promise",
    expression,
    environment,
    missing,
    state: "unforced",
    value: undefined,
  };
}

/** Construct an omitted argument with no default expression. */
export function createMissingPromise(environment: REnvironment): RPromise {
  return {
    type: "promise",
    expression: null,
    environment,
    missing: true,
    state: "unforced",
    value: undefined,
  };
}

/** Construct a promise that already contains a JavaScript-assigned runtime value. */
export function createForcedPromise(value: RValue, environment: REnvironment): RPromise {
  return {
    type: "promise",
    expression: null,
    environment,
    missing: false,
    state: "forced",
    value,
  };
}

/**
 * Force a promise exactly once, memoize success, and reject recursive self-forcing.
 */
export async function forcePromise(
  promise: RPromise,
  evaluate: (expression: AstNode, environment: REnvironment) => Promise<RValue>,
): Promise<RValue> {
  if (promise.state === "forced") {
    if (promise.value === undefined) {
      throw new REvaluationError("NRE2011", "A forced promise has no memoized value.");
    }
    return promise.value;
  }
  if (promise.state === "forcing") {
    throw new REvaluationError("NRE2010", "Promise is already under evaluation.");
  }
  if (promise.expression === null) {
    throw new REvaluationError("NRE2006", "Argument is missing, with no default.");
  }

  promise.state = "forcing";
  try {
    const value = await evaluate(promise.expression, promise.environment);
    promise.value = value;
    promise.state = "forced";
    return value;
  } catch (error) {
    promise.state = "unforced";
    throw error;
  }
}
