import { REvaluationError } from "./errors.js";
import type { AstNode } from "@nativr/ast";
import type {
  RActiveBinding,
  RBinding,
  RBuiltin,
  RClosure,
  REnvironment,
  RPromise,
  RValue,
} from "./values.js";

let nextEnvironmentId = 1;

/** Create one mutable lexical environment. */
export function createEnvironment(parent: REnvironment | null, hashed = false): REnvironment {
  return {
    type: "environment",
    id: nextEnvironmentId++,
    parent,
    attributes: new Map(),
    hashed,
    locked: false,
    lockedBindings: new Set(),
    bindings: new Map(),
  };
}

/** Install or replace a binding in one environment. */
export function setBinding(environment: REnvironment, name: string, value: RBinding): void {
  if (environment.lockedBindings.has(name)) {
    throw new REvaluationError("NRE2012", `Cannot change locked binding '${name}'.`);
  }
  if (environment.locked && !environment.bindings.has(name)) {
    throw new REvaluationError("NRE2012", `Cannot add binding '${name}' to a locked environment.`);
  }
  environment.bindings.set(name, value);
}

/** Install or replace a function-backed active binding without invoking it. */
export function setActiveBinding(
  environment: REnvironment,
  name: string,
  callable: RClosure | RBuiltin,
): RActiveBinding {
  const existing = environment.bindings.get(name);
  if (existing !== undefined && existing.type !== "active-binding") {
    throw new REvaluationError("NRE2141", `Symbol '${name}' already has a regular binding.`);
  }
  const binding = { type: "active-binding", callable } satisfies RActiveBinding;
  setBinding(environment, name, binding);
  return binding;
}

/** Remove an unlocked binding while respecting environment and per-binding locks. */
export function removeBinding(environment: REnvironment, name: string): boolean {
  if (environment.lockedBindings.has(name)) {
    throw new REvaluationError("NRE2012", `Cannot remove locked binding '${name}'.`);
  }
  if (environment.locked) {
    throw new REvaluationError(
      "NRE2012",
      `Cannot remove binding '${name}' from a locked environment.`,
    );
  }
  return environment.bindings.delete(name);
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
