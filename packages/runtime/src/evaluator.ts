import { assertNever } from "@nativr/ast";
import type { AstNode, CallExpressionNode, ProgramNode, SourceSpan } from "@nativr/ast";

import { EvaluationContext, DEFAULT_RUNTIME_LIMITS } from "./context.js";
import {
  createEnvironment,
  createForcedPromise,
  createPromise,
  forcePromise,
  lookupBinding,
  setBinding,
} from "./environment.js";
import {
  REvaluationError,
  RResourceLimitError,
  RRuntimeDisposedError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
} from "./errors.js";
import {
  characterVector,
  doubleVector,
  integerVector,
  logicalVector,
  missingValue,
  R_NULL,
} from "./values.js";
import type {
  BuiltinDefinition,
  RBuiltin,
  RBinding,
  RClosure,
  REnvironment,
  RPromise,
  RuntimeLimits,
  RuntimeOperators,
  RValue,
  RWarning,
} from "./values.js";

/** Internal value and visibility returned by one expression. */
export interface EvaluationResult {
  readonly value: RValue;
  readonly visible: boolean;
}

/** Complete internal result for one source evaluation. */
export interface DetailedEvaluationResult extends EvaluationResult {
  readonly warnings: readonly RWarning[];
  readonly elapsedMs: number;
}

/** Runtime construction options. */
export interface EvaluatorOptions {
  readonly limits?: Partial<RuntimeLimits>;
}

/** One independent mutable R-like session. */
export class Evaluator {
  readonly #operators: RuntimeOperators;
  readonly #builtins: readonly BuiltinDefinition[];
  readonly #limits: RuntimeLimits;
  #emptyEnvironment: REnvironment;
  #baseEnvironment: REnvironment;
  #globalEnvironment: REnvironment;
  #disposed = false;
  #activeCancellation: { cancelled: boolean } | undefined;

  public constructor(
    operators: RuntimeOperators,
    builtins: readonly BuiltinDefinition[],
    options: EvaluatorOptions = {},
  ) {
    this.#operators = operators;
    this.#builtins = builtins;
    this.#limits = { ...DEFAULT_RUNTIME_LIMITS, ...options.limits };
    this.#emptyEnvironment = createEnvironment(null);
    this.#baseEnvironment = createEnvironment(this.#emptyEnvironment);
    this.#globalEnvironment = createEnvironment(this.#baseEnvironment);
    this.#installBuiltins();
  }

  /** Evaluate a normalized program in the session global environment. */
  public async evaluate(program: ProgramNode): Promise<DetailedEvaluationResult> {
    this.#ensureActive();
    const cancellation = { cancelled: false };
    this.#activeCancellation = cancellation;
    const context = new EvaluationContext(this.#limits, cancellation);
    const start = Date.now();
    try {
      const result = await this.#evaluateNode(program, this.#globalEnvironment, context);
      const outputBytes = estimateOutputBytes(result.value);
      if (outputBytes > this.#limits.maxOutputBytes) {
        throw new RResourceLimitError("NRL4007", "Evaluation output size limit exceeded.", {
          details: { maxOutputBytes: this.#limits.maxOutputBytes, outputBytes },
        });
      }
      return { ...result, warnings: [...context.warnings], elapsedMs: Date.now() - start };
    } finally {
      this.#activeCancellation = undefined;
    }
  }

  /** Assign an already-converted runtime value in the global environment. */
  public assign(name: string, value: RValue): void {
    this.#ensureActive();
    validateBindingName(name);
    if (
      "length" in value &&
      typeof value.length === "number" &&
      value.length > this.#limits.maxVectorLength
    ) {
      throw new RResourceLimitError("NRL4002", "Assigned vector length limit exceeded.", {
        details: { maxVectorLength: this.#limits.maxVectorLength, requested: value.length },
      });
    }
    setBinding(this.#globalEnvironment, name, value);
  }

  /** Resolve and force a global binding. */
  public async get(name: string): Promise<RValue> {
    this.#ensureActive();
    const binding = lookupBinding(this.#globalEnvironment, name);
    if (binding === undefined) {
      throw new REvaluationError("NRE2001", `Object '${name}' not found.`, {
        details: { symbol: name },
      });
    }
    const context = new EvaluationContext(this.#limits, { cancelled: false });
    return this.#force(binding, context);
  }

  /** Call a named function with already-converted positional values. */
  public async call(name: string, values: readonly RValue[]): Promise<RValue> {
    this.#ensureActive();
    const binding = lookupBinding(this.#globalEnvironment, name);
    if (binding === undefined) {
      throw new REvaluationError("NRE2001", `Object '${name}' not found.`);
    }
    const context = new EvaluationContext(this.#limits, { cancelled: false });
    const callable = await this.#force(binding, context);
    const promises = values.map((value) => createForcedPromise(value, this.#globalEnvironment));
    return this.#invokeCallable(
      callable,
      promises.map((promise) => ({ promise })),
      context,
    );
  }

  /** Cooperatively interrupt the currently executing evaluator. */
  public interrupt(): void {
    if (this.#activeCancellation !== undefined) {
      this.#activeCancellation.cancelled = true;
    }
  }

  /** Replace user state with a fresh global environment while retaining base builtins. */
  public reset(): void {
    this.#ensureActive();
    this.#globalEnvironment = createEnvironment(this.#baseEnvironment);
  }

  /** Release this session and reject future operations. */
  public dispose(): void {
    if (!this.#disposed) {
      this.interrupt();
      this.#disposed = true;
      this.#globalEnvironment.bindings.clear();
      this.#baseEnvironment.bindings.clear();
      this.#emptyEnvironment.bindings.clear();
    }
  }

  readonly #evaluateNode = async (
    node: AstNode,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> => {
    context.checkpoint();
    switch (node.kind) {
      case "Program":
      case "Block":
        return this.#evaluateSequence(node.body, environment, context);
      case "DoubleLiteral":
        context.allocate(1);
        return { value: doubleVector([node.value]), visible: true };
      case "IntegerLiteral":
        context.allocate(1);
        return { value: integerVector([node.value]), visible: true };
      case "StringLiteral":
        context.allocate(1);
        return { value: characterVector([node.value]), visible: true };
      case "LogicalLiteral":
        context.allocate(1);
        return { value: logicalVector([node.value]), visible: true };
      case "NullLiteral":
        return { value: R_NULL, visible: true };
      case "MissingLiteral":
        if (node.declaredType === "complex") {
          throw unsupported("complex missing values", node.span);
        }
        context.allocate(1);
        return { value: missingValue(node.declaredType), visible: true };
      case "Identifier": {
        if (node.name === "...") throw unsupported("ellipsis arguments", node.span);
        const binding = lookupBinding(environment, node.name);
        if (binding === undefined) {
          throw new REvaluationError("NRE2001", `Object '${node.name}' not found.`, {
            span: node.span,
            details: { symbol: node.name },
          });
        }
        return { value: await this.#force(binding, context), visible: true };
      }
      case "UnaryExpression": {
        const operand = await this.#evaluateValue(node.operand, environment, context);
        return { value: this.#operators.unary(context, node.operator, operand), visible: true };
      }
      case "BinaryExpression": {
        const left = await this.#evaluateValue(node.left, environment, context);
        const right = await this.#evaluateValue(node.right, environment, context);
        return {
          value: this.#operators.binary(context, node.operator, left, right),
          visible: true,
        };
      }
      case "AssignmentExpression": {
        const value = await this.#evaluateValue(node.value, environment, context);
        setBinding(environment, node.target.name, value);
        return { value, visible: false };
      }
      case "CallExpression":
        return {
          value: await this.#evaluateCall(node, environment, context),
          visible: true,
        };
      case "FunctionExpression":
        return {
          value: {
            type: "closure",
            parameters: node.parameters,
            body: node.body,
            environment,
          },
          visible: true,
        };
      case "IfExpression":
        throw unsupported("if expressions", node.span);
      case "ForExpression":
        throw unsupported("for loops", node.span);
      case "WhileExpression":
        throw unsupported("while loops", node.span);
      case "ReturnExpression":
        throw unsupported("return expressions", node.span);
      case "SubsetExpression":
        throw unsupported(`subset operator ${node.operator}`, node.span);
      case "NamespaceExpression":
        throw unsupported(`namespace operator ${node.operator}`, node.span);
      case "FormulaExpression":
        throw unsupported("formulas", node.span);
      case "PipeExpression":
        throw unsupported("native pipe", node.span);
      case "UnsupportedExpression":
        throw unsupported(node.feature, node.span);
      default:
        return assertNever(node);
    }
  };

  async #evaluateSequence(
    body: readonly AstNode[],
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    let result: EvaluationResult = { value: R_NULL, visible: false };
    for (const expression of body) {
      result = await this.#evaluateNode(expression, environment, context);
    }
    return result;
  }

  async #evaluateValue(
    node: AstNode,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<RValue> {
    return (await this.#evaluateNode(node, environment, context)).value;
  }

  async #evaluateCall(
    node: CallExpressionNode,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<RValue> {
    const callable = await this.#evaluateValue(node.callee, environment, context);
    const argumentsWithPromises = node.arguments.map((argument) => ({
      ...(argument.name === undefined ? {} : { name: argument.name }),
      promise: createPromise(argument.value, environment),
      span: argument.span,
    }));
    return this.#invokeCallable(callable, argumentsWithPromises, context);
  }

  async #invokeCallable(
    callable: RValue,
    args: readonly {
      readonly name?: string;
      readonly promise: RPromise;
      readonly span?: SourceSpan;
    }[],
    context: EvaluationContext,
  ): Promise<RValue> {
    if (callable.type === "builtin") {
      return callable.definition.implementation({
        arguments: args.map(({ name, promise }) =>
          name === undefined ? { promise } : { name, promise },
        ),
        context,
        force: async (promise) => this.#force(promise, context),
      });
    }
    if (callable.type !== "closure") {
      throw new RTypeMismatchError("NRT3002", "Attempted to call a non-function value.", {
        details: { type: callable.type },
      });
    }
    return this.#invokeClosure(callable, args, context);
  }

  async #invokeClosure(
    closure: RClosure,
    args: readonly {
      readonly name?: string;
      readonly promise: RPromise;
      readonly span?: SourceSpan;
    }[],
    context: EvaluationContext,
  ): Promise<RValue> {
    context.enterCall();
    try {
      if (closure.parameters.some((parameter) => parameter.name === "...")) {
        throw unsupported("ellipsis parameters");
      }
      const frame = createEnvironment(closure.environment);
      const matched = new Map<string, RPromise>();

      for (const argument of args.filter((item) => item.name !== undefined)) {
        const name = argument.name ?? "";
        const parameter = closure.parameters.find((candidate) => candidate.name === name);
        if (parameter === undefined) {
          throw new REvaluationError(
            "NRE2005",
            `Unused argument '${name}'.`,
            argument.span === undefined ? {} : { span: argument.span },
          );
        }
        if (matched.has(name)) {
          throw new REvaluationError(
            "NRE2004",
            `Argument '${name}' matched more than once.`,
            argument.span === undefined ? {} : { span: argument.span },
          );
        }
        matched.set(name, argument.promise);
      }

      let positionalIndex = 0;
      for (const argument of args.filter((item) => item.name === undefined)) {
        while (
          positionalIndex < closure.parameters.length &&
          matched.has(closure.parameters[positionalIndex]?.name ?? "")
        ) {
          positionalIndex += 1;
        }
        const parameter = closure.parameters[positionalIndex];
        if (parameter === undefined) {
          throw new REvaluationError(
            "NRE2005",
            "Unused positional argument.",
            argument.span === undefined ? {} : { span: argument.span },
          );
        }
        matched.set(parameter.name, argument.promise);
        positionalIndex += 1;
      }

      for (const parameter of closure.parameters) {
        const supplied = matched.get(parameter.name);
        if (supplied !== undefined) {
          setBinding(frame, parameter.name, supplied);
        } else if (parameter.defaultValue !== undefined) {
          setBinding(frame, parameter.name, createPromise(parameter.defaultValue, frame));
        } else {
          throw new REvaluationError(
            "NRE2006",
            `Argument '${parameter.name}' is missing, with no default.`,
            { span: parameter.span },
          );
        }
      }
      return (await this.#evaluateNode(closure.body, frame, context)).value;
    } finally {
      context.leaveCall();
    }
  }

  async #force(binding: RBinding, context: EvaluationContext): Promise<RValue> {
    if (binding.type !== "promise") return binding;
    return forcePromise(binding, async (expression, environment) =>
      this.#evaluateValue(expression, environment, context),
    );
  }

  #installBuiltins(): void {
    for (const definition of this.#builtins) {
      const builtin: RBuiltin = { type: "builtin", definition };
      setBinding(this.#baseEnvironment, definition.name, builtin);
    }
  }

  #ensureActive(): void {
    if (this.#disposed) {
      throw new RRuntimeDisposedError("NRS5001", "The NativR runtime has been disposed.");
    }
  }
}

function unsupported(feature: string, span?: SourceSpan): RUnsupportedFeatureError {
  return new RUnsupportedFeatureError(
    "NRU6001",
    `The current NativR subset does not support ${feature}.`,
    span === undefined ? { details: { feature } } : { span, details: { feature } },
  );
}

function validateBindingName(name: string): void {
  if (!/^(?:[A-Za-z.]|[\u0080-\u{10ffff}])(?:[A-Za-z0-9._]|[\u0080-\u{10ffff}])*$/u.test(name)) {
    throw new REvaluationError("NRE2007", `Invalid binding name '${name}'.`);
  }
}

function estimateOutputBytes(value: RValue): number {
  switch (value.type) {
    case "null":
      return 0;
    case "logical":
      return value.values.byteLength + (value.missing?.byteLength ?? 0);
    case "integer":
    case "double":
      return value.values.byteLength + (value.missing?.byteLength ?? 0);
    case "character":
      return (
        value.values.reduce((bytes, item) => bytes + item.length * 2, 0) +
        (value.missing?.byteLength ?? 0)
      );
    case "list":
      return value.values.reduce((bytes, item) => bytes + estimateOutputBytes(item), 0);
    case "builtin":
    case "closure":
    case "environment":
      return 64;
  }
}
