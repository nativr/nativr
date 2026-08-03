import { assertNever } from "@nativr/ast";
import type {
  AstNode,
  CallArgument,
  CallExpressionNode,
  ProgramNode,
  SourceSpan,
  SubsetExpressionNode,
} from "@nativr/ast";

import { EvaluationContext, DEFAULT_RUNTIME_LIMITS } from "./context.js";
import { deparseAst } from "./language.js";
import { censusRuntimeMemory } from "./memory.js";
import {
  createEnvironment,
  createForcedPromise,
  createMissingPromise,
  createPromise,
  forcePromise,
  lookupBinding,
  setBinding,
} from "./environment.js";
import {
  NativRError,
  REvaluationError,
  RResourceLimitError,
  RRuntimeDisposedError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
} from "./errors.js";
import { decodeRBase64Resource, decodeRWorkspaceFile } from "./serialization.js";
import {
  characterVector,
  complexVector,
  doubleVector,
  functionDebugRegistry,
  integerVector,
  isAtomic,
  isDataFrame,
  isMissing,
  isVector,
  listValue,
  logicalVector,
  missingValue,
  objectClasses,
  NATIVR_PACKAGE_LIBRARY_PATH,
  NATIVR_SYSTEM_LIBRARY_PATH,
  R_NULL,
  vectorDimensions,
  withClasses,
  GLOBAL_CALLING_HANDLERS_STATE_KEY,
  runtimeOutputRouter,
} from "./values.js";
import {
  extractListMember,
  extractVectorElement,
  replaceCoordinateMatrix,
  replaceDimensions,
  replaceListMember,
  replaceVectorElement,
  replaceVectorSubset,
  subsetCoordinateMatrix,
  subsetDimensions,
  subsetVector,
} from "./subset.js";
import type {
  BuiltinCallArgument,
  BuiltinDefinition,
  RBuiltin,
  RBinding,
  RBrowseEvent,
  RClosure,
  REnvironment,
  RDataViewEvent,
  RLanguage,
  RNativeCallRequest,
  RNativeModuleDefinition,
  RGraphicsEvent,
  ROutput,
  RPromise,
  RSystemCommandRequest,
  RSystemCommandResult,
  RSocketRequest,
  RSocketResult,
  RUrlRequest,
  RUrlResult,
  RuntimeLimits,
  RuntimeMemoryStatistics,
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
  readonly output: readonly ROutput[];
  readonly dataViews: readonly RDataViewEvent[];
  readonly browseRequests: readonly RBrowseEvent[];
  readonly graphics: readonly RGraphicsEvent[];
  readonly elapsedMs: number;
}

/** Runtime construction options. */
export interface EvaluatorOptions {
  readonly limits?: Partial<RuntimeLimits>;
  readonly parseSource?: (source: string, maxExpressions?: number) => ProgramNode;
  readonly packages?: readonly RuntimePackageDefinition[];
  /** Positive session identity supplied by the embedding facade for Sys.getpid(). */
  readonly sessionProcessId?: number;
  /** Recreate evaluator-owned builtin state at construction and reset. */
  readonly initializeBuiltinState?: (state: Map<string, unknown>) => void;
  /** Explicit line-prompt capability. Undefined preserves non-interactive GNU R behavior. */
  readonly readline?: (prompt: string) => Promise<string> | string;
  /** Explicit URL-byte transport. Undefined means that URL connections cannot perform I/O. */
  readonly urlRequest?: (request: RUrlRequest) => Promise<RUrlResult> | RUrlResult;
  /** Explicit socket transport. Undefined means that socket connections cannot perform I/O. */
  readonly socketRequest?: (request: RSocketRequest) => Promise<RSocketResult> | RSocketResult;
  /** Explicit host capability. Undefined means that no operating-system command may run. */
  readonly systemCommand?: (
    request: RSystemCommandRequest,
  ) => Promise<RSystemCommandResult> | RSystemCommandResult;
  /** Declarative routines available through the explicit nativeCall adapter. */
  readonly nativeModules?: readonly RNativeModuleDefinition[];
  /** Explicit typed native/Wasm capability. Undefined means that .Call cannot execute. */
  readonly nativeCall?: (request: RNativeCallRequest) => Promise<RValue> | RValue;
}

/** One dependency imported by a normalized source-only package. */
export interface RuntimePackageImport {
  readonly package: string;
  /** Undefined imports the dependency's complete exported surface. */
  readonly names?: readonly string[];
}

/** One package requirement retained from DESCRIPTION. */
export interface RuntimePackageDependency {
  readonly package: string;
  readonly constraint?: {
    readonly operator: ">=" | "<=" | "==" | ">" | "<" | "!=";
    readonly version: string;
  };
}

/** One S3 registration parsed independently from NAMESPACE. */
export interface RuntimeS3Method {
  readonly generic: string;
  readonly genericPackage?: string;
  readonly class: string;
  readonly method: string;
}

/** One immutable package-relative resource retained in the browser package store. */
export interface RuntimePackageResource {
  readonly path: string;
  readonly data: string;
}

/** One immutable UTF-16 JavaScript string retained as a package-relative text file. */
export interface RuntimePackageTextResource {
  readonly path: string;
  readonly text: string;
}

/** Parser-independent package input accepted by the runtime. */
export interface RuntimePackageDefinition {
  readonly name: string;
  readonly version: string;
  readonly descriptionFields: readonly {
    readonly name: string;
    readonly value: string;
  }[];
  readonly resourceTextEncoding: "utf8" | "latin1";
  readonly dependencies: readonly RuntimePackageDependency[];
  readonly imports: readonly RuntimePackageImport[];
  readonly exports: readonly string[];
  readonly s3Methods: readonly RuntimeS3Method[];
  readonly programs: readonly ProgramNode[];
  readonly textResources: readonly RuntimePackageTextResource[];
  readonly resources: readonly RuntimePackageResource[];
}

interface RuntimePackageRecord {
  readonly definition: RuntimePackageDefinition;
  namespace: REnvironment | undefined;
  loading: boolean;
  attached: boolean;
}

function parsePackageVirtualPath(
  value: string,
): { readonly name: string; readonly resourcePath: string } | undefined {
  const prefix = "nativr://package/";
  if (!value.startsWith(prefix)) return undefined;
  const encodedParts = value.slice(prefix.length).split("/");
  if (encodedParts.length < 2 || encodedParts.some((part) => part.length === 0)) return undefined;
  try {
    const parts = encodedParts.map((part) => decodeURIComponent(part));
    if (
      parts.some(
        (part) =>
          part.length === 0 ||
          part === "." ||
          part === ".." ||
          part.includes("/") ||
          part.includes("\\"),
      )
    ) {
      return undefined;
    }
    return { name: parts[0] ?? "", resourcePath: parts.slice(1).join("/") };
  } catch {
    return undefined;
  }
}

const DEFAULT_SEARCH_PATH = Object.freeze([
  ".GlobalEnv",
  "package:stats",
  "package:graphics",
  "package:grDevices",
  "package:utils",
  "package:datasets",
  "package:methods",
  "Autoloads",
  "package:base",
]);

const DEFAULT_LIBRARY_PATHS = Object.freeze([
  NATIVR_PACKAGE_LIBRARY_PATH,
  NATIVR_SYSTEM_LIBRARY_PATH,
]);

interface ExitHandler {
  readonly expression: AstNode;
  readonly environment: REnvironment;
}

interface FunctionControlFrame {
  readonly kind: "function";
  readonly target: symbol;
  exitHandlers: ExitHandler[];
}

type ControlFrame = FunctionControlFrame | { readonly kind: "loop"; readonly target: symbol };

interface ClosureCallFrame {
  readonly arguments: readonly {
    readonly name?: string;
    readonly promise: RPromise;
    readonly span?: SourceSpan;
  }[];
  readonly environment: REnvironment;
  readonly callerEnvironment: REnvironment;
  readonly closure: RClosure;
  readonly matched: ReadonlyMap<string, RPromise>;
  readonly call?: CallExpressionNode;
}

interface S3DispatchFrame {
  readonly generic: string;
  readonly genericEnvironment: REnvironment;
  readonly classes: readonly string[];
  readonly classIndex: number;
  readonly arguments: ClosureCallFrame["arguments"];
}

type PreparedSubsetOperation =
  | {
      readonly operator: "$";
      readonly target: RValue;
      readonly member: string;
    }
  | {
      readonly operator: "[";
      readonly target: RValue;
      readonly index: RValue | undefined;
    }
  | {
      readonly operator: "[[";
      readonly target: RValue;
      readonly index: RValue;
      readonly exact: boolean | null;
    };

const REGISTERED_NAMESPACE_EXPORTS = new Map<string, ReadonlySet<string> | "all">([
  ["base", "all"],
  [
    "stats",
    new Set([
      "cor",
      "cov",
      "density",
      "density.default",
      "dbinom",
      "dcauchy",
      "family",
      "as.formula",
      "approx",
      "formula",
      "mean",
      "median",
      "lsfit",
      "mad",
      "nlm",
      "optim",
      "ppoints",
      "pnorm",
      "pcauchy",
      "quantile",
      "qbinom",
      "qcauchy",
      "qnorm",
      "rbeta",
      "rbinom",
      "rcauchy",
      "rchisq",
      "rexp",
      "rgamma",
      "rlnorm",
      "rnorm",
      "rpois",
      "rt",
      "runif",
      "sd",
      "set.seed",
      "as.ts",
      "cycle",
      "deltat",
      "embed",
      "filter",
      "frequency",
      "ts",
      "ts.plot",
      "update",
      "var",
      "weights",
      "weighted.mean",
      "weighted.mean.default",
      "window",
      "xtabs",
    ]),
  ],
  [
    "methods",
    new Set([
      "as",
      "new",
      "representation",
      "signature",
      "setAs",
      "setClass",
      "setGeneric",
      "setMethod",
      "setOldClass",
      "show",
      "showClass",
    ]),
  ],
  [
    "grDevices",
    new Set([
      "as.raster",
      "as.raster.array",
      "as.raster.character",
      "as.raster.logical",
      "as.raster.matrix",
      "as.raster.numeric",
      "as.raster.raw",
      "col2rgb",
      "colorRampPalette",
      "colors",
      "colours",
      "cm.colors",
      "dev.control",
      "dev.flush",
      "dev.hold",
      "dev.cur",
      "dev.list",
      "dev.off",
      "devAskNewPage",
      "gray",
      "gray.colors",
      "grey",
      "grey.colors",
      "graphics.off",
      "heat.colors",
      "hcl",
      "is.raster",
      "nclass.FD",
      "nclass.Sturges",
      "nclass.scott",
      "pdf",
      "png",
      "recordPlot",
      "rainbow",
      "replayPlot",
      "rgb",
      "terrain.colors",
      "topo.colors",
    ]),
  ],
  [
    "graphics",
    new Set([
      "abline",
      "axTicks",
      "axis",
      "barplot",
      "barplot.default",
      "box",
      "boxplot",
      "curve",
      "hist",
      "hist.default",
      "image",
      "image.default",
      "legend",
      "lines",
      "lines.default",
      "matplot",
      "pairs",
      "par",
      "persp",
      "points",
      "polygon",
      "plot.new",
      "plot.window",
      "rasterImage",
      "rect",
      "segments",
      "text",
      "title",
    ]),
  ],
  [
    "utils",
    new Set([
      "aspell",
      "as.roman",
      "available.packages",
      "browseVignettes",
      "browseURL",
      "capture.output",
      "compareVersion",
      "contrib.url",
      "data",
      "demo",
      "download.file",
      "example",
      "glob2rx",
      "getFromNamespace",
      "help",
      "object.size",
      "packageName",
      "packageDescription",
      "packageVersion",
      "read.csv",
      "read.csv2",
      "read.delim",
      "read.delim2",
      "read.table",
      "sessionInfo",
      "type.convert",
      "type.convert.data.frame",
      "type.convert.default",
      "type.convert.list",
      "URLdecode",
      "vignette",
      "View",
      "write.csv",
      "write.csv2",
      "write.table",
    ]),
  ],
  ["datasets", new Set()],
  ["R6", new Set(["R6Class"])],
  ["vctrs", new Set(["new_class", "new_vctr"])],
  ["tibble", new Set(["tibble", "tribble"])],
]);
const BASE_NAMESPACE_CONSTANTS = new Set([
  "pi",
  "letters",
  ".Machine",
  ".LC.categories",
  ".Library",
  ".Library.site",
]);
const CORE_R_PACKAGE_NAMES = new Set([
  "base",
  "stats",
  "graphics",
  "grDevices",
  "utils",
  "datasets",
  "methods",
]);

function corePackageDescriptionFields(
  name: string,
): readonly { readonly name: string; readonly value: string }[] {
  return Object.freeze([
    Object.freeze({ name: "Package", value: name }),
    Object.freeze({ name: "Version", value: "4.6.0" }),
    ...(CORE_R_PACKAGE_NAMES.has(name) ? [Object.freeze({ name: "Priority", value: "base" })] : []),
  ]);
}

class ReturnSignal extends Error {
  public constructor(
    public readonly target: symbol,
    public readonly result: EvaluationResult,
  ) {
    super("Internal return control signal.");
  }
}

class BreakSignal extends Error {
  public constructor(public readonly target: symbol) {
    super("Internal break control signal.");
  }
}

class NextSignal extends Error {
  public constructor(public readonly target: symbol) {
    super("Internal next control signal.");
  }
}

let nextRuntimeSessionProcessId = 1;

function allocateRuntimeSessionProcessId(): number {
  const processId = nextRuntimeSessionProcessId;
  nextRuntimeSessionProcessId = processId === 2_147_483_647 ? 1 : processId + 1;
  return processId;
}

/** One independent mutable R-like session. */
export class Evaluator {
  readonly #operators: RuntimeOperators;
  readonly #builtins: readonly BuiltinDefinition[];
  readonly #limits: RuntimeLimits;
  readonly #parseSource: EvaluatorOptions["parseSource"];
  readonly #initializeBuiltinState: EvaluatorOptions["initializeBuiltinState"];
  readonly #readline: EvaluatorOptions["readline"];
  readonly #urlRequest: EvaluatorOptions["urlRequest"];
  readonly #socketRequest: EvaluatorOptions["socketRequest"];
  readonly #systemCommand: EvaluatorOptions["systemCommand"];
  readonly #nativeModules: readonly RNativeModuleDefinition[];
  readonly #nativeCall: EvaluatorOptions["nativeCall"];
  readonly #sessionProcessId: number;
  #emptyEnvironment: REnvironment;
  #baseEnvironment: REnvironment;
  #attachedPackagesEnvironment: REnvironment;
  #globalEnvironment: REnvironment;
  readonly #controlFrames: ControlFrame[] = [];
  readonly #closureCallFrames: ClosureCallFrame[] = [];
  readonly #s3DispatchFrames: S3DispatchFrame[] = [];
  readonly #builtinState = new Map<string, unknown>();
  readonly #activeGlobalCallingHandlers = new Set<RValue>();
  readonly #packages = new Map<string, RuntimePackageRecord>();
  readonly #registeredS3Methods = new Map<string, RBinding>();
  readonly #s3RegistrationTransactions: Map<string, RBinding | undefined>[] = [];
  #searchPath = [...DEFAULT_SEARCH_PATH];
  #libraryPaths = [...DEFAULT_LIBRARY_PATHS];
  readonly #searchEnvironments = new Map<string, REnvironment>();
  readonly #searchEnvironmentNames = new Map<number, string>();
  #disposed = false;
  #activeCancellation: { cancelled: boolean } | undefined;
  #memoryMaxUsed = { nodeCells: 0, vectorCells: 0 };
  #memoryTrigger = { nodeCells: 0, vectorCells: 0 };
  #memoryCollections = 0;
  #memoryFullCollections = 0;

  public constructor(
    operators: RuntimeOperators,
    builtins: readonly BuiltinDefinition[],
    options: EvaluatorOptions = {},
  ) {
    this.#operators = operators;
    this.#builtins = builtins;
    this.#limits = { ...DEFAULT_RUNTIME_LIMITS, ...options.limits };
    this.#parseSource = options.parseSource;
    this.#initializeBuiltinState = options.initializeBuiltinState;
    this.#readline = options.readline;
    this.#urlRequest = options.urlRequest;
    this.#socketRequest = options.socketRequest;
    this.#systemCommand = options.systemCommand;
    this.#nativeModules = options.nativeModules ?? [];
    this.#nativeCall = options.nativeCall;
    this.#sessionProcessId = options.sessionProcessId ?? allocateRuntimeSessionProcessId();
    if (
      !Number.isInteger(this.#sessionProcessId) ||
      this.#sessionProcessId <= 0 ||
      this.#sessionProcessId > 2_147_483_647
    ) {
      throw new REvaluationError(
        "NRE2253",
        "The evaluator session process identity must be a positive 32-bit integer.",
      );
    }
    this.#initializeBuiltinState?.(this.#builtinState);
    this.#emptyEnvironment = createEnvironment(null, true);
    this.#baseEnvironment = createEnvironment(this.#emptyEnvironment, true);
    this.#attachedPackagesEnvironment = createEnvironment(this.#baseEnvironment, true);
    this.#globalEnvironment = createEnvironment(this.#attachedPackagesEnvironment, true);
    this.#installBuiltins();
    for (const definition of options.packages ?? []) {
      if (this.#packages.has(definition.name) || CORE_R_PACKAGE_NAMES.has(definition.name)) {
        throw new REvaluationError(
          "NRE2220",
          `Package namespace '${definition.name}' is already registered.`,
        );
      }
      this.#packages.set(definition.name, {
        definition,
        namespace: undefined,
        loading: false,
        attached: false,
      });
    }
  }

  /** Evaluate a normalized program in the session global environment. */
  public async evaluate(program: ProgramNode): Promise<DetailedEvaluationResult> {
    this.#ensureActive();
    const cancellation = { cancelled: false };
    this.#activeCancellation = cancellation;
    const context = new EvaluationContext(this.#limits, cancellation, () =>
      runtimeOutputRouter(this.#builtinState),
    );
    const start = Date.now();
    try {
      const result = await this.#evaluateNode(program, this.#globalEnvironment, context);
      const outputBytes = estimateOutputBytes(result.value) + context.outputBytes;
      if (outputBytes > this.#limits.maxOutputBytes) {
        throw new RResourceLimitError("NRL4007", "Evaluation output size limit exceeded.", {
          details: { maxOutputBytes: this.#limits.maxOutputBytes, outputBytes },
        });
      }
      return {
        ...result,
        warnings: [...context.warnings],
        output: [...context.output],
        dataViews: [...context.dataViews],
        browseRequests: [...context.browseRequests],
        graphics: [...context.graphics],
        elapsedMs: Date.now() - start,
      };
    } catch (error) {
      if (error instanceof NativRError && !(error instanceof RResourceLimitError)) {
        await this.#signalGlobalCondition(
          ["simpleError", "error", "condition"],
          withClasses(listValue([characterVector([error.message]), R_NULL], ["message", "call"]), [
            "simpleError",
            "error",
            "condition",
          ]),
          context,
        );
      }
      throw error;
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
    const context = new EvaluationContext(this.#limits, { cancelled: false }, () =>
      runtimeOutputRouter(this.#builtinState),
    );
    return this.#force(binding, context);
  }

  /** Call a named function with already-converted positional values. */
  public async call(name: string, values: readonly RValue[]): Promise<RValue> {
    this.#ensureActive();
    const binding = lookupBinding(this.#globalEnvironment, name);
    if (binding === undefined) {
      throw new REvaluationError("NRE2001", `Object '${name}' not found.`);
    }
    const context = new EvaluationContext(this.#limits, { cancelled: false }, () =>
      runtimeOutputRouter(this.#builtinState),
    );
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
    this.#attachedPackagesEnvironment = createEnvironment(this.#baseEnvironment, true);
    this.#globalEnvironment = createEnvironment(this.#attachedPackagesEnvironment, true);
    this.#builtinState.clear();
    this.#initializeBuiltinState?.(this.#builtinState);
    this.#registeredS3Methods.clear();
    this.#s3RegistrationTransactions.length = 0;
    for (const record of this.#packages.values()) {
      record.namespace?.bindings.clear();
      record.namespace = undefined;
      record.loading = false;
      record.attached = false;
    }
    this.#searchPath = [...DEFAULT_SEARCH_PATH];
    this.#libraryPaths = [...DEFAULT_LIBRARY_PATHS];
    this.#invalidateSearchEnvironments(true);
    this.#memoryMaxUsed = { nodeCells: 0, vectorCells: 0 };
    this.#memoryTrigger = { nodeCells: 0, vectorCells: 0 };
    this.#memoryCollections = 0;
    this.#memoryFullCollections = 0;
  }

  /** Release this session and reject future operations. */
  public dispose(): void {
    if (!this.#disposed) {
      this.interrupt();
      this.#disposed = true;
      this.#globalEnvironment.bindings.clear();
      this.#attachedPackagesEnvironment.bindings.clear();
      this.#baseEnvironment.bindings.clear();
      this.#emptyEnvironment.bindings.clear();
      this.#builtinState.clear();
      this.#registeredS3Methods.clear();
      this.#s3RegistrationTransactions.length = 0;
      this.#invalidateSearchEnvironments(true);
      for (const record of this.#packages.values()) record.namespace?.bindings.clear();
      this.#packages.clear();
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
      case "ComplexLiteral":
        context.allocate(1);
        return { value: complexVector([0], [node.imaginary]), visible: true };
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
        if (binding.type !== "promise" || binding.state === "forced") {
          return { value: await this.#force(binding, context), visible: true };
        }
        return this.#forceDetailed(binding, context);
      }
      case "UnaryExpression": {
        const operand = await this.#evaluateValue(node.operand, environment, context);
        return { value: this.#operators.unary(context, node.operator, operand), visible: true };
      }
      case "BinaryExpression": {
        const left = await this.#evaluateValue(node.left, environment, context);
        if (node.operator === "&&" || node.operator === "||") {
          const leftState = scalarLogicalState(left, node.operator);
          if (
            (node.operator === "&&" && leftState === false) ||
            (node.operator === "||" && leftState === true)
          ) {
            context.allocate(1);
            return { value: logicalVector([leftState]), visible: true };
          }
          const right = await this.#evaluateValue(node.right, environment, context);
          const rightState = scalarLogicalState(right, node.operator);
          const result =
            node.operator === "&&"
              ? rightState === false
                ? false
                : leftState === true && rightState === true
                  ? true
                  : undefined
              : rightState === true
                ? true
                : leftState === false && rightState === false
                  ? false
                  : undefined;
          context.allocate(1);
          return {
            value: result === undefined ? logicalVector([0], [1]) : logicalVector([result]),
            visible: true,
          };
        }
        const right = await this.#evaluateValue(node.right, environment, context);
        return {
          value: this.#operators.binary(context, node.operator, left, right),
          visible: true,
        };
      }
      case "AssignmentExpression": {
        const value = await this.#evaluateValue(node.value, environment, context);
        const targetEnvironment = this.#assignmentEnvironment(
          environment,
          node.target.name,
          node.operator === "<<-" || node.operator === "->>",
          node.span,
        );
        setBinding(targetEnvironment, node.target.name, value);
        return { value, visible: false };
      }
      case "ReplacementExpression": {
        if (node.target.kind === "CallExpression") {
          const replacement = await this.#evaluateCallReplacement(
            node.target,
            node.value,
            environment,
            context,
            node.operator === "<<-" || node.operator === "->>",
            node.span,
          );
          return { value: replacement, visible: false };
        }
        if (node.target.target.kind !== "Identifier") {
          const replacement = await this.#evaluateNestedSubsetReplacement(
            node.target,
            node.value,
            environment,
            context,
            node.operator === "<<-" || node.operator === "->>",
            node.span,
          );
          return { value: replacement, visible: false };
        }
        const name = node.target.target.name;
        const targetEnvironment = this.#assignmentEnvironment(
          environment,
          name,
          node.operator === "<<-" || node.operator === "->>",
          node.span,
        );
        const binding = lookupBinding(targetEnvironment, name);
        if (binding === undefined) {
          throw new REvaluationError("NRE2001", `Object '${name}' not found.`, {
            span: node.target.target.span,
            details: { symbol: name },
          });
        }
        const target = await this.#force(binding, context);
        const replacement = await this.#evaluateValue(node.value, environment, context);
        let updated: RValue;
        if (node.target.operator === "@") throw unsupported("slot replacement", node.span);
        if (node.target.operator === "$") {
          const member = node.target.arguments[0]?.value;
          if (member === undefined) {
            throw new REvaluationError("NRE2206", "The $ operator requires a member name.");
          }
          const memberName = staticName(member, "member");
          if (target.type === "environment") {
            setBinding(target, memberName, replacement);
            return { value: replacement, visible: false };
          }
          updated = replaceListMember(target, memberName, replacement, context);
        } else {
          if (target.type === "environment") {
            if (node.target.operator !== "[[") {
              throw new RTypeMismatchError("NRT3306", "Environment replacement requires [[ or $.");
            }
            const positional = node.target.arguments.filter(
              (argument) => argument.name === undefined,
            );
            if (positional.length !== 1 || positional[0]?.value === undefined) {
              throw new REvaluationError(
                "NRE2204",
                "Environment [[ replacement requires one subscript.",
              );
            }
            const index = await this.#evaluateValue(positional[0].value, environment, context);
            setBinding(target, environmentSubscriptName(index), replacement);
            return { value: replacement, visible: false };
          }
          if (!isVector(target) && target.type !== "pairlist") {
            throw new RTypeMismatchError(
              "NRT3306",
              "Replacement requires an atomic vector, list, or pairlist.",
              { details: { type: target.type } },
            );
          }
          const positional = node.target.arguments.filter(
            (argument) => argument.name === undefined,
          );
          if (
            node.target.operator === "[[" &&
            node.target.arguments.some((argument) => argument.name !== undefined)
          ) {
            throw new REvaluationError(
              "NRE2202",
              "[[ replacement does not accept named subscript arguments.",
            );
          }
          const targetDimensions = vectorDimensions(target);
          const dimensional =
            positional.length >= 2 ||
            (target.type !== "pairlist" &&
              targetDimensions?.length === 1 &&
              positional.length === 1);
          if (dimensional) {
            if (target.type === "pairlist") {
              throw unsupported("rectangular pairlist replacement", node.span);
            }
            const indices: (RValue | undefined)[] = [];
            for (const argument of positional) {
              indices.push(
                await this.#evaluateOptionalSubscript(argument.value, environment, context),
              );
            }
            const coordinateIndex =
              node.target.operator === "[" &&
              indices.length === 1 &&
              isCoordinateMatrixSubscript(target, indices[0]);
            if (node.target.operator === "[[") {
              const selected = subsetDimensions(target, indices, true, context);
              if (selected.length !== 1) {
                throw new REvaluationError(
                  "NRE2204",
                  "[[ replacement requires exactly one selected element.",
                );
              }
            }
            updated = coordinateIndex
              ? replaceCoordinateMatrix(target, indices[0] as RValue, replacement, context)
              : replaceDimensions(target, indices, replacement, context);
            setBinding(targetEnvironment, name, updated);
            return { value: replacement, visible: false };
          }
          const argument = positional[0]?.value;
          const missing =
            argument?.kind === "UnsupportedExpression" && argument.feature === "missing argument";
          if (node.target.operator === "[") {
            const index =
              argument === undefined || missing
                ? undefined
                : await this.#evaluateValue(argument, environment, context);
            if (isCoordinateMatrixSubscript(target, index)) {
              if (target.type === "pairlist") {
                throw unsupported("coordinate-matrix pairlist replacement", node.span);
              }
              updated = replaceCoordinateMatrix(target, index, replacement, context);
            } else {
              updated = replaceVectorSubset(target, index, replacement, context);
            }
          } else {
            if (argument === undefined || missing) {
              throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
            }
            const index = await this.#evaluateValue(argument, environment, context);
            updated = replaceVectorElement(target, index, replacement, context);
          }
        }
        setBinding(targetEnvironment, name, updated);
        return { value: replacement, visible: false };
      }
      case "CallExpression":
        return this.#evaluateCall(node, environment, context);
      case "FunctionExpression":
        return {
          value: {
            type: "closure",
            parameters: node.parameters,
            body: node.body,
            environment,
            attributes: new Map(),
          },
          visible: true,
        };
      case "IfExpression":
        if (
          conditionState(
            await this.#evaluateValue(node.condition, environment, context),
            "if",
            node.span,
          )
        ) {
          return this.#evaluateNode(node.consequence, environment, context);
        }
        return node.alternative === undefined
          ? { value: R_NULL, visible: false }
          : this.#evaluateNode(node.alternative, environment, context);
      case "ForExpression":
        return this.#evaluateFor(node, environment, context);
      case "WhileExpression":
        return this.#evaluateWhile(node, environment, context);
      case "RepeatExpression":
        return this.#evaluateRepeat(node.body, environment, context);
      case "BreakExpression":
        throw new BreakSignal(this.#nearestLoopTarget(node.span, "break"));
      case "NextExpression":
        throw new NextSignal(this.#nearestLoopTarget(node.span, "next"));
      case "ReturnExpression": {
        const target = this.#nearestFunctionTarget(node.span);
        const result =
          node.value === undefined
            ? { value: R_NULL, visible: false }
            : await this.#evaluateNode(node.value, environment, context);
        throw new ReturnSignal(target, result);
      }
      case "SubsetExpression": {
        const target = await this.#evaluateValue(node.target, environment, context);
        if (node.operator === "@") throw unsupported("slot extraction", node.span);
        if (node.operator === "$") {
          const member = node.arguments[0]?.value;
          if (member === undefined) {
            throw new REvaluationError("NRE2206", "The $ operator requires a member name.", {
              span: node.span,
            });
          }
          if (member.kind !== "Identifier" && member.kind !== "StringLiteral") {
            throw new RTypeMismatchError("NRT3305", "The $ member name must be an identifier.");
          }
          const name = member.kind === "Identifier" ? member.name : member.value;
          if (target.type === "environment") {
            const binding = target.bindings.get(name);
            return {
              value: binding === undefined ? R_NULL : await this.#force(binding, context),
              visible: true,
            };
          }
          return {
            value: extractListMember(target, name, context),
            visible: true,
          };
        }
        if (target.type === "environment") {
          if (node.operator !== "[[") {
            throw new RTypeMismatchError("NRT3306", "Environment extraction requires [[ or $.");
          }
          const positional = node.arguments.filter((argument) => argument.name === undefined);
          if (positional.length !== 1 || positional[0]?.value === undefined) {
            throw new REvaluationError(
              "NRE2204",
              "Environment [[ extraction requires one subscript.",
            );
          }
          const index = await this.#evaluateValue(positional[0].value, environment, context);
          const binding = target.bindings.get(environmentSubscriptName(index));
          return {
            value: binding === undefined ? R_NULL : await this.#force(binding, context),
            visible: true,
          };
        }
        if (!isVector(target) && target.type !== "pairlist") {
          throw new RTypeMismatchError(
            "NRT3306",
            "Subsetting requires an atomic vector, list, or pairlist.",
            {
              details: { type: target.type },
            },
          );
        }
        const positional = node.arguments.filter((argument) => argument.name === undefined);
        const dropArgument = node.arguments.find((argument) => argument.name === "drop");
        const exactArguments = node.arguments.filter((argument) => argument.name === "exact");
        if (exactArguments.length > 1) {
          throw new REvaluationError("NRE2102", "Argument 'exact' matched more than once.");
        }
        const exactArgument = exactArguments[0];
        const unknownNamed = node.arguments.find(
          (argument) =>
            argument.name !== undefined &&
            argument.name !== (node.operator === "[" ? "drop" : "exact"),
        );
        if (unknownNamed !== undefined) {
          throw unsupported(`named subscript '${unknownNamed.name ?? ""}'`, unknownNamed.span);
        }
        const targetDimensions = vectorDimensions(target);
        const dimensional =
          positional.length >= 2 || (targetDimensions?.length === 1 && positional.length === 1);
        if (dimensional) {
          const indices: (RValue | undefined)[] = [];
          for (const argument of positional) {
            indices.push(
              await this.#evaluateOptionalSubscript(argument.value, environment, context),
            );
          }
          const drop =
            dropArgument === undefined
              ? true
              : conditionState(
                  await this.#evaluateValue(dropArgument.value, environment, context),
                  "if",
                  dropArgument.span,
                );
          const selected =
            node.operator === "[" &&
            indices.length === 1 &&
            isCoordinateMatrixSubscript(target, indices[0])
              ? subsetCoordinateMatrix(target, indices[0], context)
              : subsetDimensions(target, indices, drop, context);
          if (node.operator === "[") return { value: selected, visible: true };
          if (selected.length !== 1) {
            throw new REvaluationError("NRE2204", "[[ requires exactly one selected element.");
          }
          return {
            value: extractVectorElement(selected, integerVector([1]), context),
            visible: true,
          };
        }
        const argument = positional[0]?.value;
        const missing =
          argument?.kind === "UnsupportedExpression" && argument.feature === "missing argument";
        if (node.operator === "[") {
          const index =
            argument === undefined || missing
              ? undefined
              : await this.#evaluateValue(argument, environment, context);
          return {
            value: isCoordinateMatrixSubscript(target, index)
              ? subsetCoordinateMatrix(target, index, context)
              : subsetVector(target, index, context),
            visible: true,
          };
        }
        if (argument === undefined || missing) {
          throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.", {
            span: node.span,
          });
        }
        const index = await this.#evaluateValue(argument, environment, context);
        const exact =
          exactArgument === undefined
            ? true
            : exactMatchState(
                await this.#evaluateValue(exactArgument.value, environment, context),
                exactArgument.span,
              );
        return { value: extractVectorElement(target, index, context, exact), visible: true };
      }
      case "NamespaceExpression": {
        const namespace = staticName(node.namespace, "namespace");
        const member = staticName(node.member, "namespace member");
        const exports = this.#staticNamespaceExports(namespace);
        if (exports !== undefined) {
          const binding = lookupBinding(this.#baseEnvironment, member);
          const internal = this.#staticNamespaceOwnsBinding(namespace, member);
          const exported = exports === "all" ? internal : exports.has(member);
          const accessible = node.operator === ":::" ? internal || exported : exported;
          if (binding === undefined || !accessible) {
            throw new REvaluationError(
              "NRE2211",
              `'${member}' is not a registered ${node.operator === ":::" ? "internal" : "exported"} binding in namespace '${namespace}'.`,
              { span: node.member.span, details: { namespace, member } },
            );
          }
          return { value: await this.#force(binding, context), visible: true };
        }
        const record = this.#packages.get(namespace);
        if (record === undefined) {
          throw new REvaluationError("NRE2210", `Namespace '${namespace}' is not registered.`, {
            span: node.namespace.span,
            details: { namespace },
          });
        }
        const loaded = await this.#loadPackage(namespace, false, context);
        const exported = loaded.record.definition.exports.includes(member);
        const binding =
          node.operator === "::" && exported
            ? lookupBinding(loaded.namespace, member)
            : loaded.namespace.bindings.get(member);
        if (binding === undefined || (node.operator === "::" && !exported)) {
          throw new REvaluationError(
            "NRE2211",
            `'${member}' is not a registered ${node.operator === ":::" ? "internal" : "exported"} binding in namespace '${namespace}'.`,
            { span: node.member.span, details: { namespace, member } },
          );
        }
        return { value: await this.#force(binding, context), visible: true };
      }
      case "FormulaExpression":
        return {
          value: normalizeFormula(node, environment),
          visible: true,
        };
      case "PipeExpression":
        return this.#evaluatePipe(node, environment, context);
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

  async #evaluateFor(
    node: Extract<AstNode, { readonly kind: "ForExpression" }>,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const sequence = await this.#evaluateValue(node.sequence, environment, context);
    if (sequence.type === "null") return { value: R_NULL, visible: false };
    if (!isVector(sequence)) {
      throw new RTypeMismatchError("NRT3115", "A for-loop sequence must be a vector or list.", {
        span: node.sequence.span,
        details: { type: sequence.type },
      });
    }
    const target = Symbol("for");
    this.#controlFrames.push({ kind: "loop", target });
    try {
      for (let index = 0; index < sequence.length; index += 1) {
        const value =
          sequence.type === "list"
            ? (sequence.values[index] ?? R_NULL)
            : extractVectorElement(sequence, integerVector([index + 1]), context);
        setBinding(environment, node.variable.name, value);
        try {
          await this.#evaluateNode(node.body, environment, context);
        } catch (error) {
          if (error instanceof BreakSignal && error.target === target) break;
          if (error instanceof NextSignal && error.target === target) continue;
          throw error;
        }
      }
    } finally {
      this.#controlFrames.pop();
    }
    return { value: R_NULL, visible: false };
  }

  async #evaluateWhile(
    node: Extract<AstNode, { readonly kind: "WhileExpression" }>,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const target = Symbol("while");
    this.#controlFrames.push({ kind: "loop", target });
    try {
      while (
        conditionState(
          await this.#evaluateValue(node.condition, environment, context),
          "while",
          node.condition.span,
        )
      ) {
        try {
          await this.#evaluateNode(node.body, environment, context);
        } catch (error) {
          if (error instanceof BreakSignal && error.target === target) break;
          if (error instanceof NextSignal && error.target === target) continue;
          throw error;
        }
      }
    } finally {
      this.#controlFrames.pop();
    }
    return { value: R_NULL, visible: false };
  }

  async #evaluateRepeat(
    body: AstNode,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const target = Symbol("repeat");
    this.#controlFrames.push({ kind: "loop", target });
    try {
      while (true) {
        try {
          await this.#evaluateNode(body, environment, context);
        } catch (error) {
          if (error instanceof BreakSignal && error.target === target) break;
          if (error instanceof NextSignal && error.target === target) continue;
          throw error;
        }
      }
    } finally {
      this.#controlFrames.pop();
    }
    return { value: R_NULL, visible: false };
  }

  async #evaluateValue(
    node: AstNode,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<RValue> {
    return (await this.#evaluateNode(node, environment, context)).value;
  }

  async #evaluateOptionalSubscript(
    node: AstNode | undefined,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<RValue | undefined> {
    const missing = node?.kind === "UnsupportedExpression" && node.feature === "missing argument";
    return node === undefined || missing
      ? undefined
      : this.#evaluateValue(node, environment, context);
  }

  async #evaluateNestedSubsetReplacement(
    target: SubsetExpressionNode,
    replacementNode: AstNode,
    environment: REnvironment,
    context: EvaluationContext,
    nonLocal: boolean,
    span: SourceSpan,
  ): Promise<RValue> {
    const path: SubsetExpressionNode[] = [];
    let root: AstNode = target;
    while (root.kind === "SubsetExpression") {
      path.unshift(root);
      root = root.target;
    }
    if (root.kind !== "Identifier" && root.kind !== "CallExpression") {
      throw unsupported("replacement paths without an identifier root", span);
    }
    let targetEnvironment: REnvironment | undefined;
    let current: RValue;
    if (root.kind === "Identifier") {
      targetEnvironment = this.#assignmentEnvironment(environment, root.name, nonLocal, span);
      const binding = lookupBinding(targetEnvironment, root.name);
      if (binding === undefined) {
        throw new REvaluationError("NRE2001", `Object '${root.name}' not found.`, {
          span: root.span,
          details: { symbol: root.name },
        });
      }
      current = await this.#force(binding, context);
    } else {
      current = await this.#evaluateValue(root, environment, context);
    }
    const replacement = await this.#evaluateValue(replacementNode, environment, context);
    const operations: PreparedSubsetOperation[] = [];
    for (let offset = 0; offset < path.length; offset += 1) {
      const operation = await this.#prepareNestedSubsetOperation(
        current,
        path[offset] as SubsetExpressionNode,
        environment,
        context,
      );
      operations.push(operation);
      if (offset < path.length - 1) {
        current = await this.#extractPreparedSubset(operation, context);
      }
    }
    let updated = replacement;
    for (let offset = operations.length - 1; offset >= 0; offset -= 1) {
      const operation =
        offset < operations.length - 1
          ? await this.#prepareNestedSubsetOperation(
              (operations[offset] as PreparedSubsetOperation).target,
              path[offset] as SubsetExpressionNode,
              environment,
              context,
            )
          : (operations[offset] as PreparedSubsetOperation);
      updated = this.#applyPreparedSubsetReplacement(operation, updated, context);
    }
    if (root.kind === "Identifier") {
      setBinding(targetEnvironment as REnvironment, root.name, updated);
    } else {
      await this.#applyCallReplacement(root, updated, environment, context, nonLocal, span);
    }
    return replacement;
  }

  async #prepareNestedSubsetOperation(
    target: RValue,
    node: SubsetExpressionNode,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<PreparedSubsetOperation> {
    if (node.operator === "@") throw unsupported("slot replacement", node.span);
    if (node.operator === "$") {
      const member = node.arguments[0]?.value;
      if (member === undefined) {
        throw new REvaluationError("NRE2206", "The $ operator requires a member name.");
      }
      return { operator: "$", target, member: staticName(member, "member") };
    }
    const positional = node.arguments.filter((argument) => argument.name === undefined);
    if (positional.length !== 1) {
      throw unsupported("multidimensional nested replacement", node.span);
    }
    const argument = positional[0]?.value;
    const missing =
      argument?.kind === "UnsupportedExpression" && argument.feature === "missing argument";
    if (node.operator === "[") {
      return {
        operator: "[",
        target,
        index:
          argument === undefined || missing
            ? undefined
            : await this.#evaluateValue(argument, environment, context),
      };
    }
    if (argument === undefined || missing) {
      throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
    }
    const exactArguments = node.arguments.filter((entry) => entry.name === "exact");
    if (exactArguments.length > 1) {
      throw new REvaluationError("NRE2102", "Argument 'exact' matched more than once.");
    }
    if (exactArguments.length > 0) {
      throw new REvaluationError(
        "NRE2202",
        "[[ replacement does not accept named subscript arguments.",
      );
    }
    const exactArgument = exactArguments[0];
    return {
      operator: "[[",
      target,
      index: await this.#evaluateValue(argument, environment, context),
      exact:
        exactArgument === undefined
          ? true
          : exactMatchState(
              await this.#evaluateValue(exactArgument.value, environment, context),
              exactArgument.span,
            ),
    };
  }

  async #extractPreparedSubset(
    operation: PreparedSubsetOperation,
    context: EvaluationContext,
  ): Promise<RValue> {
    if (operation.operator === "$") {
      if (operation.target.type === "environment") {
        const binding = operation.target.bindings.get(operation.member);
        return binding === undefined ? R_NULL : this.#force(binding, context);
      }
      return extractListMember(operation.target, operation.member, context);
    }
    if (operation.target.type === "environment") {
      if (operation.operator !== "[[") {
        throw new RTypeMismatchError("NRT3306", "Environment extraction requires [[ or $.");
      }
      const binding = operation.target.bindings.get(environmentSubscriptName(operation.index));
      return binding === undefined ? R_NULL : this.#force(binding, context);
    }
    if (!isVector(operation.target) && operation.target.type !== "pairlist") {
      throw new RTypeMismatchError(
        "NRT3306",
        "Nested subsetting requires an atomic vector, list, or pairlist.",
        { details: { type: operation.target.type } },
      );
    }
    return operation.operator === "["
      ? subsetVector(operation.target, operation.index, context)
      : extractVectorElement(operation.target, operation.index, context, operation.exact);
  }

  #applyPreparedSubsetReplacement(
    operation: PreparedSubsetOperation,
    replacement: RValue,
    context: EvaluationContext,
  ): RValue {
    if (operation.operator === "$") {
      if (operation.target.type === "environment") {
        setBinding(operation.target, operation.member, replacement);
        return operation.target;
      }
      if (operation.target.type === "null") {
        return replacement.type === "null" ? R_NULL : listValue([replacement], [operation.member]);
      }
      return replaceListMember(operation.target, operation.member, replacement, context);
    }
    if (operation.target.type === "environment") {
      if (operation.operator !== "[[") {
        throw new RTypeMismatchError("NRT3306", "Environment replacement requires [[ or $.");
      }
      setBinding(operation.target, environmentSubscriptName(operation.index), replacement);
      return operation.target;
    }
    if (!isVector(operation.target) && operation.target.type !== "pairlist") {
      throw new RTypeMismatchError(
        "NRT3306",
        "Nested replacement requires an atomic vector, list, or pairlist.",
        { details: { type: operation.target.type } },
      );
    }
    return operation.operator === "["
      ? replaceVectorSubset(operation.target, operation.index, replacement, context)
      : replaceVectorElement(operation.target, operation.index, replacement, context);
  }

  async #evaluateCallReplacement(
    target: CallExpressionNode,
    replacementNode: AstNode,
    environment: REnvironment,
    context: EvaluationContext,
    nonLocal: boolean,
    span: SourceSpan,
  ): Promise<RValue> {
    const replacement = await this.#evaluateValue(replacementNode, environment, context);
    await this.#applyCallReplacement(target, replacement, environment, context, nonLocal, span);
    return replacement;
  }

  async #applyCallReplacement(
    target: CallExpressionNode,
    replacement: RValue,
    environment: REnvironment,
    context: EvaluationContext,
    nonLocal: boolean,
    span: SourceSpan,
  ): Promise<void> {
    if (target.callee.kind !== "Identifier") {
      throw unsupported("non-identifier replacement functions", target.callee.span);
    }
    const objectArgument = target.arguments[0];
    if (objectArgument?.value.kind === "SubsetExpression") {
      await this.#applyCallReplacementToSubset(
        target,
        objectArgument,
        replacement,
        environment,
        context,
        nonLocal,
        span,
      );
      return;
    }
    if (objectArgument?.value.kind !== "Identifier") {
      throw unsupported("nested replacement assignment", span);
    }
    const objectName = objectArgument.value.name;
    const targetEnvironment = this.#assignmentEnvironment(environment, objectName, nonLocal, span);
    const binding = lookupBinding(targetEnvironment, objectName);
    if (binding === undefined) {
      throw new REvaluationError("NRE2001", `Object '${objectName}' not found.`, {
        span: objectArgument.value.span,
        details: { symbol: objectName },
      });
    }
    const object = await this.#force(binding, context);
    const updated = await this.#invokeReplacementFunction(
      target,
      objectArgument,
      object,
      replacement,
      environment,
      context,
      span,
    );
    setBinding(targetEnvironment, objectName, updated);
  }

  async #applyCallReplacementToSubset(
    target: CallExpressionNode,
    objectArgument: CallExpressionNode["arguments"][number],
    replacement: RValue,
    environment: REnvironment,
    context: EvaluationContext,
    nonLocal: boolean,
    span: SourceSpan,
  ): Promise<void> {
    const subset = objectArgument.value as SubsetExpressionNode;
    const path: SubsetExpressionNode[] = [];
    let root: AstNode = subset;
    while (root.kind === "SubsetExpression") {
      path.unshift(root);
      root = root.target;
    }
    if (root.kind !== "Identifier" && root.kind !== "CallExpression") {
      throw unsupported("replacement paths without an identifier root", span);
    }
    let targetEnvironment: REnvironment | undefined;
    let current: RValue;
    if (root.kind === "Identifier") {
      targetEnvironment = this.#assignmentEnvironment(environment, root.name, nonLocal, span);
      const binding = lookupBinding(targetEnvironment, root.name);
      if (binding === undefined) {
        throw new REvaluationError("NRE2001", `Object '${root.name}' not found.`, {
          span: root.span,
          details: { symbol: root.name },
        });
      }
      current = await this.#force(binding, context);
    } else {
      current = await this.#evaluateValue(root, environment, context);
    }
    const operations: PreparedSubsetOperation[] = [];
    for (const node of path) {
      const operation = await this.#prepareNestedSubsetOperation(
        current,
        node,
        environment,
        context,
      );
      operations.push(operation);
      current = await this.#extractPreparedSubset(operation, context);
    }
    let updated = await this.#invokeReplacementFunction(
      target,
      objectArgument,
      current,
      replacement,
      environment,
      context,
      span,
    );
    for (let offset = operations.length - 1; offset >= 0; offset -= 1) {
      const operation = await this.#prepareNestedSubsetOperation(
        (operations[offset] as PreparedSubsetOperation).target,
        path[offset] as SubsetExpressionNode,
        environment,
        context,
      );
      updated = this.#applyPreparedSubsetReplacement(operation, updated, context);
    }
    if (root.kind === "Identifier") {
      setBinding(targetEnvironment as REnvironment, root.name, updated);
    } else {
      await this.#applyCallReplacement(root, updated, environment, context, nonLocal, span);
    }
  }

  async #invokeReplacementFunction(
    target: CallExpressionNode,
    objectArgument: CallExpressionNode["arguments"][number],
    object: RValue,
    replacement: RValue,
    environment: REnvironment,
    context: EvaluationContext,
    span: SourceSpan,
  ): Promise<RValue> {
    if (target.callee.kind !== "Identifier") {
      throw unsupported("non-identifier replacement functions", target.callee.span);
    }
    const replacementName = `${target.callee.name}<-`;
    const callableBinding = lookupBinding(environment, replacementName);
    if (callableBinding === undefined) {
      throw new REvaluationError(
        "NRE2001",
        `Replacement function '${replacementName}' not found.`,
        {
          span: target.callee.span,
          details: { symbol: replacementName },
        },
      );
    }
    const callable = await this.#force(callableBinding, context);
    const firstArgument = {
      ...(objectArgument.name === undefined ? {} : { name: objectArgument.name }),
      promise: createForcedPromise(object, environment),
      span: objectArgument.span,
    };
    return this.#invokeCallable(
      callable,
      [
        firstArgument,
        ...this.#prepareArguments(target.arguments.slice(1), environment),
        {
          name: "value",
          promise: createForcedPromise(replacement, environment),
          span,
        },
      ],
      context,
    );
  }

  async #evaluateCall(
    node: CallExpressionNode,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const callable = await this.#evaluateCallable(node.callee, environment, context);
    return this.#invokeCallableResult(
      callable,
      this.#prepareArguments(
        node.arguments,
        environment,
        callable.type !== "builtin" || callable.definition.kind !== "special",
      ),
      context,
      node,
      environment,
    );
  }

  async #evaluatePipe(
    node: Extract<AstNode, { readonly kind: "PipeExpression" }>,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const left = await this.#evaluateValue(node.left, environment, context);
    if (node.operator === "%>%" && node.right.kind !== "CallExpression") {
      const callable = await this.#evaluateCallable(node.right, environment, context);
      return this.#invokeCallableResult(
        callable,
        [{ promise: createForcedPromise(left, environment), span: node.left.span }],
        context,
      );
    }
    if (node.right.kind !== "CallExpression") {
      throw unsupported("native pipe targets other than a function call", node.right.span);
    }
    if (
      node.operator === "|>" &&
      node.right.arguments.some(
        (argument) => argument.value.kind === "Identifier" && argument.value.name === "_",
      )
    ) {
      throw unsupported("native pipe placeholder", node.right.span);
    }
    const callable = await this.#evaluateCallable(node.right.callee, environment, context);
    if (node.operator === "%>%") {
      const prepared: {
        readonly name?: string;
        readonly promise: RPromise;
        readonly span?: SourceSpan;
      }[] = [];
      let inserted = false;
      for (const argument of node.right.arguments) {
        if (argument.value.kind === "Identifier" && argument.value.name === ".") {
          prepared.push({
            ...(argument.name === undefined ? {} : { name: argument.name }),
            promise: createForcedPromise(left, environment),
            span: argument.span,
          });
          inserted = true;
        } else {
          prepared.push(...this.#prepareArguments([argument], environment));
        }
      }
      if (!inserted) {
        prepared.unshift({
          promise: createForcedPromise(left, environment),
          span: node.left.span,
        });
      }
      return this.#invokeCallableResult(callable, prepared, context);
    }
    return this.#invokeCallableResult(
      callable,
      [
        { promise: createForcedPromise(left, environment), span: node.left.span },
        ...this.#prepareArguments(node.right.arguments, environment),
      ],
      context,
    );
  }

  async #evaluateCallable(
    node: AstNode,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<RValue> {
    if (node.kind !== "Identifier") return this.#evaluateValue(node, environment, context);
    let current: REnvironment | null = environment;
    let firstNonCallable: RValue | undefined;
    while (current !== null) {
      const binding = current.bindings.get(node.name);
      if (binding !== undefined && binding.type !== "dots") {
        const value = await this.#force(binding, context);
        if (value.type === "closure" || value.type === "builtin") return value;
        firstNonCallable ??= value;
      }
      current = current.parent;
    }
    if (firstNonCallable !== undefined) return firstNonCallable;
    return this.#evaluateValue(node, environment, context);
  }

  #prepareArguments(
    arguments_: CallExpressionNode["arguments"],
    environment: REnvironment,
    expandDots = true,
  ): {
    readonly name?: string;
    readonly promise: RPromise;
    readonly span?: SourceSpan;
  }[] {
    const argumentsWithPromises: {
      readonly name?: string;
      readonly promise: RPromise;
      readonly span?: SourceSpan;
    }[] = [];
    for (const argument of arguments_) {
      if (
        (expandDots && argument.value.kind === "Identifier" && argument.value.name === "...") ||
        (expandDots &&
          argument.value.kind === "UnsupportedExpression" &&
          argument.value.feature === "dots")
      ) {
        const dots = lookupBinding(environment, "...");
        if (dots === undefined || dots.type !== "dots") {
          throw new REvaluationError("NRE2011", "'...' used outside an ellipsis function.", {
            span: argument.span,
          });
        }
        argumentsWithPromises.push(...dots.arguments);
      } else {
        const missing =
          argument.value.kind === "UnsupportedExpression" &&
          argument.value.feature === "missing argument";
        argumentsWithPromises.push({
          ...(argument.name === undefined ? {} : { name: argument.name }),
          promise: missing
            ? createMissingPromise(environment)
            : createPromise(argument.value, environment),
          span: argument.span,
        });
      }
    }
    return argumentsWithPromises;
  }

  async #invokeCallable(
    callable: RValue,
    args: readonly {
      readonly name?: string;
      readonly promise: RPromise;
      readonly span?: SourceSpan;
    }[],
    context: EvaluationContext,
    call?: CallExpressionNode,
    callerEnvironment?: REnvironment,
  ): Promise<RValue> {
    return (await this.#invokeCallableResult(callable, args, context, call, callerEnvironment))
      .value;
  }

  async #invokeCallableResult(
    callable: RValue,
    args: readonly {
      readonly name?: string;
      readonly promise: RPromise;
      readonly span?: SourceSpan;
    }[],
    context: EvaluationContext,
    call?: CallExpressionNode,
    callerEnvironment?: REnvironment,
  ): Promise<EvaluationResult> {
    const debugStep =
      callable.type === "builtin" || callable.type === "closure"
        ? await this.#enterFunctionDebug(callable, call, context)
        : false;
    if (callable.type === "builtin") {
      let resultVisibility = callable.definition.resultVisibility ?? "visible";
      const value = await callable.definition.implementation({
        arguments: args.map(({ name, promise }) =>
          name === undefined ? { promise } : { name, promise },
        ),
        context,
        state: this.#builtinState,
        sessionProcessId: this.#sessionProcessId,
        memoryStatistics: (reset, full) => this.#memoryStatistics(reset, full, context),
        setResultVisibility: (visibility) => {
          resultVisibility = visibility;
        },
        force: async (promise) => this.#force(promise, context),
        forceDetailed: async (promise) => this.#forceDetailed(promise, context),
        invoke: async (target, arguments_) =>
          this.#invokeCallable(
            target,
            arguments_.map((argument) => ({
              ...(argument.name === undefined ? {} : { name: argument.name }),
              promise: createForcedPromise(argument.value, this.#globalEnvironment),
            })),
            context,
          ),
        invokeDetailed: async (target, arguments_) =>
          this.#invokeCallableResult(
            target,
            arguments_.map((argument) => ({
              ...(argument.name === undefined ? {} : { name: argument.name }),
              promise: createForcedPromise(argument.value, this.#globalEnvironment),
            })),
            context,
          ),
        invokeLazy: async (target, arguments_) =>
          this.#invokeCallable(
            target,
            arguments_.map((argument) =>
              argument.name === undefined
                ? { promise: argument.promise }
                : { name: argument.name, promise: argument.promise },
            ),
            context,
          ),
        parse: (source, maxExpressions) => {
          if (this.#parseSource === undefined) {
            throw new RUnsupportedFeatureError(
              "NRU6132",
              "Dynamic parsing is unavailable in this evaluator host.",
            );
          }
          return this.#parseSource(source, maxExpressions);
        },
        evaluate: async (value, environment) =>
          this.#evaluateLanguageValue(value, environment, context),
        evaluateDetailed: async (value, environment) =>
          this.#evaluateLanguageValueResult(value, environment, context),
        signalCondition: async (classes, condition) =>
          this.#signalGlobalCondition(classes, condition, context),
        configureOnExit: (expression, environment, add, after) => {
          this.#configureOnExit(expression, environment, add, after);
        },
        isGlobalEnvironment: (environment) => environment === this.#globalEnvironment,
        currentEnvironment: () =>
          callerEnvironment ?? args[0]?.promise.environment ?? this.#globalEnvironment,
        parentFrame: (offset) => {
          const index = this.#closureCallFrames.length - offset;
          return index >= 0
            ? (this.#closureCallFrames[index]?.callerEnvironment ?? this.#globalEnvironment)
            : this.#globalEnvironment;
        },
        currentCall: () => (call === undefined ? R_NULL : { type: "language", expression: call }),
        systemCall: (which) => this.#systemCall(which),
        isInteractive: () => this.#readline !== undefined,
        hasSocketCapability: () => this.#socketRequest !== undefined,
        readline: async (prompt) => (this.#readline === undefined ? "" : this.#readline(prompt)),
        urlRequest: async (request) => {
          if (this.#urlRequest === undefined) {
            throw new RUnsupportedFeatureError(
              "NRU6196",
              "url() I/O requires an explicit createR({ url }) host capability.",
            );
          }
          return this.#urlRequest(request);
        },
        socketRequest: async (request) => {
          if (this.#socketRequest === undefined) {
            throw new RUnsupportedFeatureError(
              "NRU6207",
              "socketConnection() I/O requires an explicit createR({ socket }) host capability.",
            );
          }
          return this.#socketRequest(request);
        },
        systemCommand: async (request) => {
          if (this.#systemCommand === undefined) {
            throw new RUnsupportedFeatureError(
              "NRU6194",
              "system()/system2()/pipe() requires an explicit createR({ systemCommand }) host capability.",
            );
          }
          return this.#systemCommand(request);
        },
        nativeModules: () => this.#nativeModules,
        nativeCall: async (request) => {
          if (this.#nativeCall === undefined) {
            throw new RUnsupportedFeatureError(
              "NRU6210",
              ".Call() requires an explicit createR({ nativeCall }) typed native/Wasm capability.",
            );
          }
          return this.#nativeCall(request);
        },
        searchPath: () => Object.freeze([...this.#searchPath]),
        libraryPaths: () => Object.freeze([...this.#libraryPaths]),
        setLibraryPaths: (paths) => {
          this.#libraryPaths = [...paths];
        },
        searchEnvironment: (identifier) => this.#searchEnvironment(identifier),
        environmentName: (environment) => this.#environmentName(environment),
        loadPackage: async (name, attach, libraryPaths) =>
          this.#loadPackage(name, attach, context, libraryPaths),
        installedPackageVersion: (name, libraryPaths) =>
          this.#installedPackageVersion(name, libraryPaths),
        installedPackageDescription: (name, libraryPaths) =>
          this.#installedPackageDescription(name, libraryPaths),
        installedPackageNames: (libraryPaths) => this.#installedPackageNames(libraryPaths),
        isNamespaceLoaded: (name) =>
          this.#packages.has(name)
            ? this.#packages.get(name)?.namespace !== undefined
            : REGISTERED_NAMESPACE_EXPORTS.has(name),
        loadedNamespaces: () =>
          Object.freeze([
            ...this.#staticNamespaceNames(),
            ...[...this.#packages]
              .filter(([, record]) => record.namespace !== undefined)
              .map(([name]) => name),
          ]),
        namespaceExports: async (name) => this.#namespaceExports(name, context),
        namespaceName: (environment) => this.#namespaceName(environment),
        namespaceBinding: async (name, binding) => this.#namespaceBinding(name, binding, context),
        packageResourcePath: (name, path, libraryPaths) =>
          this.#packageResourcePath(name, path, libraryPaths),
        packageResourcePaths: (name, prefix) => {
          const paths = this.#packageResourcePaths(name, prefix);
          if (paths !== undefined) context.allocate(paths.length);
          return paths;
        },
        packageFile: (path) => this.#packageFile(path),
        packageName: (environment) => this.#packageName(environment),
        globalEnvironment: () => this.#globalEnvironment,
        baseEnvironment: () => this.#baseEnvironment,
        emptyEnvironment: () => this.#emptyEnvironment,
        matchCall: (expandDots) => this.#matchCurrentCall(expandDots),
        callerFormalDefault: async (name) => this.#callerFormalDefault(name, context),
        define: (name, value) => {
          validateBindingName(name);
          setBinding(this.#globalEnvironment, name, value);
        },
        registerS3Method: async (generic, className, method, environment) =>
          this.#registerS3Method(generic, className, method, environment, context),
        dispatchS3: async (generic, object) => this.#dispatchS3(generic, object, context),
        dispatchS3IfPresent: async (generic, object, arguments_, includeDefault) => {
          const result = await this.#dispatchS3IfPresentResult(
            generic,
            object,
            arguments_,
            context,
            includeDefault,
          );
          if (result === undefined) return undefined;
          resultVisibility = result.visible ? "visible" : "invisible";
          return result.value;
        },
        nextMethod: async (generic) => this.#nextS3Method(generic, context),
      });
      return {
        value,
        visible: resultVisibility !== "invisible",
      };
    }
    if (callable.type !== "closure") {
      throw new RTypeMismatchError("NRT3002", "Attempted to call a non-function value.", {
        details: { type: callable.type },
      });
    }
    return this.#invokeClosure(callable, args, context, call, callerEnvironment, debugStep);
  }

  async #enterFunctionDebug(
    callable: RClosure | RBuiltin,
    call: CallExpressionNode | undefined,
    context: EvaluationContext,
  ): Promise<boolean> {
    const registry = functionDebugRegistry(this.#builtinState);
    const persistent = registry.persistent.get(callable);
    const once = registry.once.get(callable);
    if (persistent === undefined && once === undefined) return false;
    if (once !== undefined) registry.once.delete(callable);

    const callLabel =
      call === undefined
        ? callable.type === "builtin"
          ? `${callable.definition.name}()`
          : "function()"
        : deparseAst(call);
    context.writeOutput({ stream: "stdout", text: `debugging in: ${callLabel}\n` });
    if (this.#readline === undefined) return false;
    if (callable.type === "builtin") {
      context.writeOutput({
        stream: "stdout",
        text: `debug: <${callable.definition.package}::${callable.definition.name}>\n`,
      });
      await this.#readDebugCommand(context);
      return false;
    }
    return true;
  }

  async #readDebugCommand(context: EvaluationContext): Promise<"step" | "continue"> {
    context.writeOutput({ stream: "stdout", text: "Browse[1]> " });
    const command = (await this.#readline?.("Browse[1]> "))?.trim() ?? "c";
    switch (command) {
      case "":
      case "n":
      case "next":
      case "s":
      case "step":
        return "step";
      case "c":
      case "cont":
      case "continue":
      case "f":
      case "finish":
        return "continue";
      case "Q":
        throw new REvaluationError("NRE2256", "Evaluation aborted from the debug browser.");
      default:
        throw new RUnsupportedFeatureError(
          "NRU6205",
          `Debug-browser command '${command}' is outside the current next/continue/finish/Q subset.`,
        );
    }
  }

  async #evaluateDebuggedBody(
    body: AstNode,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const statements = body.kind === "Block" ? body.body : [body];
    let result: EvaluationResult = { value: R_NULL, visible: false };
    let stepping = true;
    for (const statement of statements) {
      if (stepping) {
        context.writeOutput({ stream: "stdout", text: `debug: ${deparseAst(statement)}\n` });
        stepping = (await this.#readDebugCommand(context)) === "step";
      }
      result = await this.#evaluateNode(statement, environment, context);
    }
    return result;
  }

  async #signalGlobalCondition(
    classes: readonly string[],
    condition: RValue,
    context: EvaluationContext,
  ): Promise<void> {
    const stored = this.#builtinState.get(GLOBAL_CALLING_HANDLERS_STATE_KEY);
    if (!(stored instanceof Map)) return;
    const handlers = [...stored.entries()] as readonly (readonly [unknown, unknown])[];
    for (const [name, handler] of handlers) {
      if (
        typeof name !== "string" ||
        !classes.includes(name) ||
        !isCallableValue(handler) ||
        this.#activeGlobalCallingHandlers.has(handler)
      ) {
        continue;
      }
      this.#activeGlobalCallingHandlers.add(handler);
      try {
        await this.#invokeCallable(
          handler,
          [{ promise: createForcedPromise(condition, this.#globalEnvironment) }],
          context,
        );
      } finally {
        this.#activeGlobalCallingHandlers.delete(handler);
      }
    }
  }

  async #invokeClosure(
    closure: RClosure,
    args: readonly {
      readonly name?: string;
      readonly promise: RPromise;
      readonly span?: SourceSpan;
    }[],
    context: EvaluationContext,
    call?: CallExpressionNode,
    callerEnvironment?: REnvironment,
    debugStep = false,
  ): Promise<EvaluationResult> {
    context.enterCall();
    const functionTarget = Symbol("function");
    const functionFrame: FunctionControlFrame = {
      kind: "function",
      target: functionTarget,
      exitHandlers: [],
    };
    this.#controlFrames.push(functionFrame);
    try {
      const dotsIndex = closure.parameters.findIndex((parameter) => parameter.name === "...");
      const hasDots = dotsIndex >= 0;
      const regularParameters = closure.parameters.filter((parameter) => parameter.name !== "...");
      const positionalParameters = hasDots
        ? closure.parameters.slice(0, dotsIndex)
        : regularParameters;
      const frame = createEnvironment(closure.environment);
      const matched = new Map<string, RPromise>();
      const matchedArgumentIndexes = new Set<number>();

      for (const [argumentIndex, argument] of args.entries()) {
        if (argument.name === undefined) continue;
        const name = argument.name ?? "";
        const parameter = regularParameters.find((candidate) => candidate.name === name);
        if (parameter === undefined) continue;
        if (matched.has(name)) {
          throw new REvaluationError(
            "NRE2004",
            `Argument '${name}' matched more than once.`,
            argument.span === undefined ? {} : { span: argument.span },
          );
        }
        matched.set(name, argument.promise);
        matchedArgumentIndexes.add(argumentIndex);
      }

      const partialParameters = hasDots
        ? closure.parameters.slice(0, dotsIndex)
        : regularParameters;
      for (const [argumentIndex, argument] of args.entries()) {
        if (argument.name === undefined || matchedArgumentIndexes.has(argumentIndex)) continue;
        const name = argument.name;
        const candidates = partialParameters.filter((parameter) => parameter.name.startsWith(name));
        if (candidates.length > 1) {
          throw new REvaluationError(
            "NRE2007",
            `Argument '${name}' matches multiple formal arguments.`,
            argument.span === undefined ? {} : { span: argument.span },
          );
        }
        const parameter = candidates[0];
        if (parameter === undefined) continue;
        if (matched.has(parameter.name)) {
          throw new REvaluationError(
            "NRE2004",
            `Argument '${parameter.name}' matched more than once.`,
            argument.span === undefined ? {} : { span: argument.span },
          );
        }
        matched.set(parameter.name, argument.promise);
        matchedArgumentIndexes.add(argumentIndex);
      }

      let positionalIndex = 0;
      for (const [argumentIndex, argument] of args.entries()) {
        if (argument.name !== undefined) continue;
        while (
          positionalIndex < positionalParameters.length &&
          matched.has(positionalParameters[positionalIndex]?.name ?? "")
        ) {
          positionalIndex += 1;
        }
        const parameter = positionalParameters[positionalIndex];
        if (parameter === undefined) {
          if (hasDots) continue;
          throw new REvaluationError(
            "NRE2005",
            "Unused positional argument.",
            argument.span === undefined ? {} : { span: argument.span },
          );
        }
        matched.set(parameter.name, argument.promise);
        matchedArgumentIndexes.add(argumentIndex);
        positionalIndex += 1;
      }

      if (!hasDots) {
        const unused = args.find(
          (argument, argumentIndex) =>
            argument.name !== undefined && !matchedArgumentIndexes.has(argumentIndex),
        );
        if (unused !== undefined) {
          throw new REvaluationError(
            "NRE2005",
            `Unused argument '${unused.name ?? ""}'.`,
            unused.span === undefined ? {} : { span: unused.span },
          );
        }
      }

      for (const parameter of regularParameters) {
        const supplied = matched.get(parameter.name);
        if (supplied !== undefined) {
          setBinding(frame, parameter.name, supplied);
        } else if (parameter.defaultValue !== undefined) {
          setBinding(frame, parameter.name, createPromise(parameter.defaultValue, frame, true));
        } else {
          setBinding(frame, parameter.name, createMissingPromise(frame));
        }
      }
      if (hasDots) {
        const dotsArguments = args.flatMap((argument, argumentIndex) => {
          if (matchedArgumentIndexes.has(argumentIndex)) return [];
          return [
            argument.name === undefined
              ? { promise: argument.promise }
              : { name: argument.name, promise: argument.promise },
          ];
        });
        setBinding(frame, "...", { type: "dots", arguments: dotsArguments });
      }
      this.#closureCallFrames.push({
        arguments: args,
        environment: frame,
        callerEnvironment:
          callerEnvironment ??
          this.#closureCallFrames.at(-1)?.environment ??
          this.#globalEnvironment,
        closure,
        matched,
        ...(call === undefined ? {} : { call }),
      });
      try {
        let result: EvaluationResult | undefined;
        let failed = false;
        let failure: unknown;
        try {
          result = debugStep
            ? await this.#evaluateDebuggedBody(closure.body, frame, context)
            : await this.#evaluateNode(closure.body, frame, context);
        } catch (error) {
          if (error instanceof ReturnSignal && error.target === functionTarget) {
            result = error.result;
          } else {
            failed = true;
            failure = error;
          }
        }
        try {
          for (const handler of functionFrame.exitHandlers) {
            await this.#evaluateNode(handler.expression, handler.environment, context);
          }
        } catch (error) {
          failed = true;
          failure = error;
        }
        if (failed) throw failure;
        if (result === undefined) {
          throw new REvaluationError("NRE2140", "A function call completed without a result.");
        }
        return result;
      } finally {
        this.#closureCallFrames.pop();
      }
    } finally {
      this.#controlFrames.pop();
      context.leaveCall();
    }
  }

  #configureOnExit(
    expression: AstNode | null,
    environment: REnvironment,
    add: boolean,
    after: boolean,
  ): void {
    const frame = this.#nearestFunctionFrame();
    if (frame === undefined) return;
    if (expression === null || expression.kind === "NullLiteral") {
      if (!add) frame.exitHandlers = [];
      return;
    }
    const handler = { expression, environment } satisfies ExitHandler;
    if (!add) {
      frame.exitHandlers = [handler];
    } else if (after) {
      frame.exitHandlers.push(handler);
    } else {
      frame.exitHandlers.unshift(handler);
    }
  }

  #nearestFunctionFrame(): FunctionControlFrame | undefined {
    for (let index = this.#controlFrames.length - 1; index >= 0; index -= 1) {
      const frame = this.#controlFrames[index];
      if (frame?.kind === "function") return frame;
    }
    return undefined;
  }

  #matchCurrentCall(expandDots: boolean): RLanguage {
    const frame = this.#closureCallFrames.at(-1);
    if (frame?.call === undefined) {
      throw new REvaluationError(
        "NRE2217",
        "match.call() requires an active closure call originating from R syntax.",
      );
    }
    const arguments_: CallArgument[] = [];
    for (const parameter of frame.closure.parameters) {
      if (parameter.name !== "...") {
        const promise = frame.matched.get(parameter.name);
        if (promise === undefined) continue;
        const value = promiseCallAst(promise, frame.call.span);
        arguments_.push({
          name: parameter.name,
          value,
          span: value.span,
        });
        continue;
      }

      const dots = frame.environment.bindings.get("...");
      if (dots?.type !== "dots" || dots.arguments.length === 0) continue;
      if (expandDots) {
        for (const argument of dots.arguments) {
          const value = promiseCallAst(argument.promise, frame.call.span);
          arguments_.push({
            ...(argument.name === undefined ? {} : { name: argument.name }),
            value,
            span: value.span,
          });
        }
      } else {
        const entries = dots.arguments.map((argument): CallArgument => {
          const value = promiseCallAst(argument.promise, frame.call?.span ?? parameter.span);
          return {
            ...(argument.name === undefined ? {} : { name: argument.name }),
            value,
            span: value.span,
          };
        });
        arguments_.push({
          name: "...",
          value: {
            kind: "CallExpression",
            callee: { kind: "Identifier", name: "pairlist", span: parameter.span },
            arguments: entries,
            span: parameter.span,
          },
          span: parameter.span,
        });
      }
    }
    return {
      type: "language",
      expression: {
        ...frame.call,
        arguments: Object.freeze(arguments_),
      },
    };
  }

  async #callerFormalDefault(
    name: string,
    context: EvaluationContext,
  ): Promise<RValue | undefined> {
    const frame = this.#closureCallFrames.at(-1);
    if (frame === undefined) return undefined;
    const parameter = frame.closure.parameters.find((candidate) => candidate.name === name);
    if (parameter === undefined) return undefined;
    if (parameter.defaultValue === undefined) {
      throw new REvaluationError("NRE2219", `Formal argument '${name}' has no default value.`);
    }
    return this.#evaluateValue(parameter.defaultValue, frame.environment, context);
  }

  #systemCall(which: number): RLanguage | typeof R_NULL {
    const frameCount = this.#closureCallFrames.length;
    const position = which === 0 ? frameCount : which > 0 ? which : frameCount + which;
    if (position === 0) return R_NULL;
    if (position < 0 || position > frameCount) {
      throw new REvaluationError("NRE2218", "Not that many frames on the stack.");
    }
    const call = this.#closureCallFrames[position - 1]?.call;
    return call === undefined ? R_NULL : { type: "language", expression: call };
  }

  #s3RegistrationKey(environment: REnvironment, generic: string, className: string): string {
    return `${environment.id}:${generic}.${className}`;
  }

  #setRegisteredS3Method(key: string, method: RBinding): void {
    const transaction = this.#s3RegistrationTransactions.at(-1);
    if (transaction !== undefined && !transaction.has(key)) {
      transaction.set(key, this.#registeredS3Methods.get(key));
    }
    this.#registeredS3Methods.set(key, method);
  }

  async #registerS3Method(
    generic: string,
    className: string,
    method: RBinding,
    environment: REnvironment,
    context: EvaluationContext,
    genericPackage?: string,
  ): Promise<void> {
    const genericValue =
      genericPackage === undefined
        ? await (async () => {
            const genericBinding = lookupBinding(environment, generic);
            if (genericBinding === undefined) {
              throw new REvaluationError("NRE2001", `object '${generic}' not found`);
            }
            return this.#force(genericBinding, context);
          })()
        : await this.#namespaceBinding(genericPackage, generic, context);
    if (genericValue === undefined) {
      throw new REvaluationError(
        "NRE2001",
        `object '${genericPackage === undefined ? generic : `${genericPackage}::${generic}`}' not found`,
      );
    }
    const genericEnvironment =
      genericValue.type === "closure"
        ? genericValue.environment
        : genericValue.type === "builtin"
          ? this.#baseEnvironment
          : environment;
    this.#setRegisteredS3Method(
      this.#s3RegistrationKey(genericEnvironment, generic, className),
      method,
    );
  }

  async #dispatchS3(
    generic: string,
    object: RValue | undefined,
    context: EvaluationContext,
  ): Promise<RValue> {
    if (generic.length === 0) {
      throw new REvaluationError("NRE2213", "UseMethod() generic name must be non-empty.");
    }
    const callFrame = this.#closureCallFrames.at(-1);
    let arguments_ = callFrame?.arguments ?? [];
    let dispatchObject = object;
    if (dispatchObject === undefined) {
      const first = arguments_[0];
      if (first === undefined) {
        throw new REvaluationError(
          "NRE2214",
          "UseMethod() requires an object or a generic call argument.",
        );
      }
      dispatchObject = await this.#force(first.promise, context);
    } else if (arguments_.length === 0) {
      arguments_ = [
        {
          promise: createForcedPromise(dispatchObject, this.#globalEnvironment),
        },
      ];
    } else {
      arguments_ = [
        {
          ...arguments_[0],
          promise: createForcedPromise(dispatchObject, this.#globalEnvironment),
        },
        ...arguments_.slice(1),
      ];
    }
    return this.#invokeS3Method(
      generic,
      callFrame?.closure.environment ?? this.#baseEnvironment,
      runtimeClassNames(dispatchObject),
      0,
      arguments_,
      context,
    );
  }

  async #loadPackage(
    name: string,
    attach: boolean,
    context: EvaluationContext,
    libraryPaths?: readonly string[],
  ): Promise<{
    readonly name: string;
    readonly version: string;
    readonly namespace: REnvironment;
    readonly record: RuntimePackageRecord;
  }> {
    const record = this.#packages.get(name);
    if (record === undefined) {
      if (REGISTERED_NAMESPACE_EXPORTS.has(name)) {
        return {
          name,
          version: "4.6.0",
          namespace: this.#baseEnvironment,
          record: {
            definition: {
              name,
              version: "4.6.0",
              descriptionFields: corePackageDescriptionFields(name),
              resourceTextEncoding: "utf8",
              dependencies: [],
              imports: [],
              exports: await this.#namespaceExports(name, context),
              s3Methods: [],
              programs: [],
              textResources: [],
              resources: [],
            },
            namespace: this.#baseEnvironment,
            loading: false,
            attached: true,
          },
        };
      }
      throw new REvaluationError("NRE2221", `There is no installed package called '${name}'.`, {
        details: { package: name },
      });
    }
    if (
      record.namespace === undefined &&
      !(libraryPaths ?? this.#libraryPaths).includes(NATIVR_PACKAGE_LIBRARY_PATH)
    ) {
      throw new REvaluationError("NRE2221", `There is no installed package called '${name}'.`, {
        details: { package: name, libraryPaths: libraryPaths ?? this.#libraryPaths },
      });
    }
    if (record.loading) {
      throw new REvaluationError("NRE2222", `Package dependency cycle while loading '${name}'.`, {
        details: { package: name },
      });
    }
    if (record.namespace === undefined) {
      record.loading = true;
      const replacedMethods = new Map<string, RBinding | undefined>();
      let loadFailed = false;
      let loadError: unknown;
      let registrationStackInvariantFailed: boolean;
      this.#s3RegistrationTransactions.push(replacedMethods);
      try {
        for (const dependency of record.definition.dependencies) {
          context.checkpoint();
          const loadedDependency = await this.#loadPackage(
            dependency.package,
            false,
            context,
            libraryPaths,
          );
          if (!runtimePackageDependencySatisfied(loadedDependency.version, dependency)) {
            const constraint = dependency.constraint;
            throw new REvaluationError(
              "NRE2235",
              `Package '${name}' requires '${dependency.package}' ${constraint?.operator ?? ""} ${constraint?.version ?? ""}, but ${loadedDependency.version} is installed.`.replaceAll(
                /\s+/gu,
                " ",
              ),
            );
          }
        }
        const importsEnvironment = createEnvironment(this.#baseEnvironment, true);
        for (const import_ of record.definition.imports) {
          context.checkpoint();
          const dependency = await this.#loadPackage(import_.package, false, context, libraryPaths);
          const names = import_.names ?? (await this.#namespaceExports(import_.package, context));
          context.allocate(names.length);
          for (const importedName of names) {
            const binding = lookupBinding(dependency.namespace, importedName);
            if (binding === undefined) {
              throw new REvaluationError(
                "NRE2223",
                `Package '${name}' imports missing binding '${importedName}' from '${import_.package}'.`,
              );
            }
            setBinding(importsEnvironment, importedName, binding);
          }
        }
        const namespace = createEnvironment(importsEnvironment, true);
        record.namespace = namespace;
        await this.#loadPackageSysdata(record, namespace, context);
        for (const program of record.definition.programs) {
          await this.#evaluateNode(program, namespace, context);
        }
        for (const exportedName of record.definition.exports) {
          if (lookupBinding(namespace, exportedName) === undefined) {
            throw new REvaluationError(
              "NRE2224",
              `Package '${name}' exports missing binding '${exportedName}'.`,
            );
          }
        }
        for (const method of record.definition.s3Methods) {
          const binding = lookupBinding(namespace, method.method);
          if (binding === undefined) {
            throw new REvaluationError(
              "NRE2225",
              `Package '${name}' registers missing S3 method '${method.method}'.`,
            );
          }
          await this.#registerS3Method(
            method.generic,
            method.class,
            binding,
            namespace,
            context,
            method.genericPackage,
          );
        }
        await this.#invokePackageHook(record, ".onLoad", context);
      } catch (error) {
        for (const [key, previous] of replacedMethods) {
          if (previous === undefined) this.#registeredS3Methods.delete(key);
          else this.#registeredS3Methods.set(key, previous);
        }
        record.namespace?.bindings.clear();
        record.namespace = undefined;
        loadFailed = true;
        loadError = error;
      } finally {
        registrationStackInvariantFailed =
          this.#s3RegistrationTransactions.pop() !== replacedMethods;
        record.loading = false;
      }
      if (registrationStackInvariantFailed) {
        throw new Error("Internal S3 registration transaction stack invariant failed.");
      }
      if (loadFailed) throw loadError;
    }
    const namespace = record.namespace;
    if (namespace === undefined) {
      throw new REvaluationError("NRE2226", `Package '${name}' did not create a namespace.`);
    }
    if (attach && !record.attached) {
      await this.#invokePackageHook(record, ".onAttach", context);
      context.allocate(record.definition.exports.length);
      for (const exportedName of record.definition.exports) {
        const binding = lookupBinding(namespace, exportedName);
        if (binding !== undefined)
          setBinding(this.#attachedPackagesEnvironment, exportedName, binding);
      }
      this.#searchPath = [
        this.#searchPath[0] ?? ".GlobalEnv",
        `package:${name}`,
        ...this.#searchPath.slice(1).filter((entry) => entry !== `package:${name}`),
      ];
      this.#attachSearchEnvironment(name);
      record.attached = true;
    }
    return { name, version: record.definition.version, namespace, record };
  }

  async #loadPackageSysdata(
    record: RuntimePackageRecord,
    namespace: REnvironment,
    context: EvaluationContext,
  ): Promise<void> {
    const archives = record.definition.resources.filter((resource) =>
      /^R\/(?:.*\/)?sysdata\.(?:rda|rdata)$/iu.test(resource.path),
    );
    if (archives.length > 1) {
      throw new REvaluationError(
        "NRE2249",
        `Package '${record.definition.name}' contains multiple internal sysdata archives.`,
      );
    }
    const archive = archives[0];
    if (archive === undefined) return;
    const bytes = decodeRBase64Resource(archive.data, context);
    const workspace = await decodeRWorkspaceFile(bytes, context, {
      global: this.#globalEnvironment,
      base: this.#baseEnvironment,
      baseNamespace: this.#baseEnvironment,
      empty: this.#emptyEnvironment,
    });
    for (const entry of workspace.entries) {
      context.checkpoint();
      setBinding(namespace, entry.name, entry.value);
    }
  }

  async #invokePackageHook(
    record: RuntimePackageRecord,
    hookName: ".onLoad" | ".onAttach",
    context: EvaluationContext,
  ): Promise<void> {
    const namespace = record.namespace;
    const binding = namespace?.bindings.get(hookName);
    if (binding === undefined) return;
    const callable = await this.#force(binding, context);
    await this.#invokeCallable(
      callable,
      [
        {
          promise: createForcedPromise(
            characterVector([NATIVR_PACKAGE_LIBRARY_PATH]),
            this.#globalEnvironment,
          ),
        },
        {
          promise: createForcedPromise(
            characterVector([record.definition.name]),
            this.#globalEnvironment,
          ),
        },
      ],
      context,
    );
  }

  async #namespaceExports(name: string, context: EvaluationContext): Promise<readonly string[]> {
    const staticExports = this.#staticNamespaceExports(name);
    if (staticExports !== undefined) {
      const names = this.#registeredNamespaceExportNames(name, staticExports);
      context.allocate(names.length);
      return Object.freeze(names.sort());
    }
    const record = this.#packages.get(name);
    if (record === undefined) {
      throw new REvaluationError("NRE2221", `There is no installed package called '${name}'.`);
    }
    if (record.namespace === undefined && !record.loading) {
      await this.#loadPackage(name, false, context);
    }
    context.allocate(record.definition.exports.length);
    return Object.freeze([...record.definition.exports]);
  }

  #namespaceName(environment: REnvironment): string | undefined {
    if (environment === this.#baseEnvironment) return "base";
    for (const [name, record] of this.#packages) {
      if (record.namespace === environment) return name;
    }
    return undefined;
  }

  async #namespaceBinding(
    name: string,
    bindingName: string,
    context: EvaluationContext,
  ): Promise<RValue | undefined> {
    const staticExports = this.#staticNamespaceExports(name);
    if (staticExports !== undefined) {
      if (!this.#staticNamespaceOwnsBinding(name, bindingName)) return undefined;
      const binding = this.#baseEnvironment.bindings.get(bindingName);
      if (binding === undefined) return undefined;
      return binding.type === "promise" ? this.#force(binding, context) : binding;
    }

    const record = this.#packages.get(name);
    if (record === undefined) {
      throw new REvaluationError("NRE2221", `There is no installed package called '${name}'.`, {
        details: { package: name },
      });
    }
    if (record.namespace === undefined) await this.#loadPackage(name, false, context);
    const binding = record.namespace?.bindings.get(bindingName);
    if (binding === undefined) return undefined;
    return binding.type === "promise" ? this.#force(binding, context) : binding;
  }

  #installedPackageVersion(name: string, libraryPaths?: readonly string[]): string | undefined {
    const effectivePaths = libraryPaths ?? this.#libraryPaths;
    if (this.#staticNamespaceExports(name) !== undefined) {
      return effectivePaths.includes(NATIVR_SYSTEM_LIBRARY_PATH) ? "4.6.0" : undefined;
    }
    const record = this.#packages.get(name);
    if (record === undefined) return undefined;
    if (
      (libraryPaths !== undefined || record.namespace === undefined) &&
      !effectivePaths.includes(NATIVR_PACKAGE_LIBRARY_PATH)
    ) {
      return undefined;
    }
    return record.definition.version;
  }

  #installedPackageDescription(
    name: string,
    libraryPaths?: readonly string[],
  ):
    | {
        readonly fields: readonly { readonly name: string; readonly value: string }[];
        readonly file: string;
      }
    | undefined {
    const effectivePaths = libraryPaths ?? this.#libraryPaths;
    if (this.#staticNamespaceExports(name) !== undefined) {
      if (!effectivePaths.includes(NATIVR_SYSTEM_LIBRARY_PATH)) return undefined;
      return {
        fields: corePackageDescriptionFields(name),
        file: `${NATIVR_SYSTEM_LIBRARY_PATH}/${encodeURIComponent(name)}/DESCRIPTION`,
      };
    }
    const record = this.#packages.get(name);
    if (record === undefined) return undefined;
    if (
      (libraryPaths !== undefined || record.namespace === undefined) &&
      !effectivePaths.includes(NATIVR_PACKAGE_LIBRARY_PATH)
    ) {
      return undefined;
    }
    return {
      fields: record.definition.descriptionFields,
      file: `${NATIVR_PACKAGE_LIBRARY_PATH}/${encodeURIComponent(name)}/DESCRIPTION`,
    };
  }

  #installedPackageNames(libraryPaths?: readonly string[]): readonly string[] {
    const effectivePaths = libraryPaths ?? this.#libraryPaths;
    const names: string[] = [];
    if (effectivePaths.includes(NATIVR_SYSTEM_LIBRARY_PATH)) {
      names.push(...this.#staticNamespaceNames());
    }
    if (effectivePaths.includes(NATIVR_PACKAGE_LIBRARY_PATH)) names.push(...this.#packages.keys());
    return Object.freeze([...new Set(names)].sort());
  }

  #packageResourcePath(
    name: string,
    resourcePath: string,
    libraryPaths?: readonly string[],
  ): string | undefined {
    const normalizedPath = resourcePath.replace(/^\/+|\/+$/gu, "");
    if (this.#staticNamespaceExports(name) !== undefined) {
      if (!(libraryPaths ?? this.#libraryPaths).includes(NATIVR_SYSTEM_LIBRARY_PATH))
        return undefined;
      return normalizedPath.length === 0
        ? `nativr://package/${encodeURIComponent(name)}`
        : undefined;
    }
    const record = this.#packages.get(name);
    if (record === undefined) return undefined;
    if (
      (libraryPaths !== undefined || record.namespace === undefined) &&
      !(libraryPaths ?? this.#libraryPaths).includes(NATIVR_PACKAGE_LIBRARY_PATH)
    ) {
      return undefined;
    }
    if (
      normalizedPath.length > 0 &&
      !record.definition.textResources.some(
        (resource) =>
          resource.path === normalizedPath || resource.path.startsWith(`${normalizedPath}/`),
      ) &&
      !record.definition.resources.some(
        (resource) =>
          resource.path === normalizedPath || resource.path.startsWith(`${normalizedPath}/`),
      )
    ) {
      return undefined;
    }
    const encodedPath = normalizedPath
      .split("/")
      .filter((part) => part.length > 0)
      .map((part) => encodeURIComponent(part))
      .join("/");
    const root = `nativr://package/${encodeURIComponent(name)}`;
    return encodedPath.length === 0 ? root : `${root}/${encodedPath}`;
  }

  #packageResourcePaths(name: string, prefix: string): readonly string[] | undefined {
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/gu, "");
    if (this.#staticNamespaceExports(name) !== undefined) return Object.freeze([]);
    const record = this.#packages.get(name);
    if (record === undefined) return undefined;
    const paths = [
      ...record.definition.textResources.map((resource) => resource.path),
      ...record.definition.resources.map((resource) => resource.path),
    ]
      .filter(
        (path) =>
          normalizedPrefix.length === 0 ||
          path === normalizedPrefix ||
          path.startsWith(`${normalizedPrefix}/`),
      )
      .sort();
    return Object.freeze(paths);
  }

  #packageFile(path: string):
    | {
        readonly encoding: "text" | "base64";
        readonly data: string;
        readonly textEncoding: "utf8" | "latin1";
      }
    | undefined {
    const resolved = parsePackageVirtualPath(path);
    if (resolved === undefined || resolved.resourcePath.length === 0) return undefined;
    const record = this.#packages.get(resolved.name);
    if (record === undefined) return undefined;
    const text = record.definition.textResources.find(
      (resource) => resource.path === resolved.resourcePath,
    );
    if (text !== undefined) {
      return { encoding: "text", data: text.text, textEncoding: "utf8" };
    }
    const binary = record.definition.resources.find(
      (resource) => resource.path === resolved.resourcePath,
    );
    return binary === undefined
      ? undefined
      : {
          encoding: "base64",
          data: binary.data,
          textEncoding: record.definition.resourceTextEncoding,
        };
  }

  #packageName(environment: REnvironment): string | undefined {
    let current: REnvironment | null = environment;
    while (current !== null) {
      if (current === this.#globalEnvironment || current === this.#attachedPackagesEnvironment) {
        return undefined;
      }
      for (const [name, record] of this.#packages) {
        if (record.namespace === current) return name;
      }
      const searchName = this.#searchEnvironmentNames.get(current.id);
      if (searchName?.startsWith("package:")) return searchName.slice("package:".length);
      if (current === this.#baseEnvironment) return "base";
      current = current.parent;
    }
    return undefined;
  }

  #registeredNamespaceExportNames(name: string, exports: ReadonlySet<string> | "all"): string[] {
    if (exports !== "all") return [...exports];
    const names = this.#builtins
      .filter((definition) => definition.metadata.package === name)
      .map((definition) => definition.name);
    if (name === "base") {
      names.push("pi", "letters", ".Machine", ".LC.categories", ".Library", ".Library.site");
    }
    return [...new Set(names)];
  }

  #staticNamespaceExports(name: string): ReadonlySet<string> | "all" | undefined {
    return this.#packages.has(name) ? undefined : REGISTERED_NAMESPACE_EXPORTS.get(name);
  }

  #staticNamespaceOwnsBinding(name: string, bindingName: string): boolean {
    return (
      this.#builtins.some(
        (definition) => definition.package === name && definition.name === bindingName,
      ) ||
      (name === "base" && BASE_NAMESPACE_CONSTANTS.has(bindingName))
    );
  }

  #staticNamespaceNames(): readonly string[] {
    return [...REGISTERED_NAMESPACE_EXPORTS.keys()].filter((name) => !this.#packages.has(name));
  }

  #invalidateSearchEnvironments(clearNames = false): void {
    this.#searchEnvironments.clear();
    if (clearNames) this.#searchEnvironmentNames.clear();
  }

  #attachSearchEnvironment(name: string): void {
    if (this.#searchEnvironments.size === 0) return;
    const parentEntry = this.#searchPath[2];
    const parent =
      parentEntry === undefined
        ? this.#baseEnvironment
        : (this.#searchEnvironments.get(parentEntry) ?? this.#baseEnvironment);
    const environment = createEnvironment(parent, true);
    const record = this.#packages.get(name);
    if (record?.namespace !== undefined) {
      for (const exportedName of record.definition.exports) {
        const binding = record.namespace.bindings.get(exportedName);
        if (binding !== undefined) setBinding(environment, exportedName, binding);
      }
    }
    const entry = `package:${name}`;
    this.#searchEnvironments.set(entry, environment);
    this.#searchEnvironmentNames.set(environment.id, entry);
  }

  #searchEnvironment(identifier: number | string): REnvironment | undefined {
    let entry: string | undefined;
    if (typeof identifier === "number") {
      const position = Math.trunc(identifier);
      if (!Number.isFinite(position) || position < 1 || position > this.#searchPath.length) {
        return undefined;
      }
      entry = this.#searchPath[position - 1];
    } else {
      entry = this.#searchPath.includes(identifier) ? identifier : undefined;
    }
    if (entry === undefined) return undefined;
    if (entry === ".GlobalEnv") return this.#globalEnvironment;
    this.#ensureSearchEnvironments();
    return this.#searchEnvironments.get(entry);
  }

  #environmentName(environment: REnvironment): string | undefined {
    if (environment === this.#globalEnvironment) return "R_GlobalEnv";
    if (environment === this.#baseEnvironment) return "base";
    if (environment === this.#emptyEnvironment) return "R_EmptyEnv";
    this.#ensureSearchEnvironments();
    return this.#searchEnvironmentNames.get(environment.id);
  }

  #ensureSearchEnvironments(): void {
    if (this.#searchEnvironments.size > 0) return;
    let parent = this.#emptyEnvironment;
    for (let index = this.#searchPath.length - 1; index >= 1; index -= 1) {
      const entry = this.#searchPath[index];
      if (entry === undefined) continue;
      if (entry === "package:base") {
        this.#searchEnvironments.set(entry, this.#baseEnvironment);
        this.#searchEnvironmentNames.set(this.#baseEnvironment.id, "base");
        parent = this.#baseEnvironment;
        continue;
      }
      const environment = createEnvironment(parent, true);
      if (entry.startsWith("package:")) {
        const name = entry.slice("package:".length);
        const staticExports = this.#staticNamespaceExports(name);
        const record = this.#packages.get(name);
        const source = staticExports === undefined ? record?.namespace : this.#baseEnvironment;
        const exports =
          staticExports === undefined
            ? (record?.definition.exports ?? [])
            : this.#registeredNamespaceExportNames(name, staticExports);
        if (source !== undefined) {
          for (const exportedName of exports) {
            const binding = source.bindings.get(exportedName);
            if (binding !== undefined) setBinding(environment, exportedName, binding);
          }
        }
      }
      this.#searchEnvironments.set(entry, environment);
      this.#searchEnvironmentNames.set(environment.id, entry === "package:base" ? "base" : entry);
      parent = environment;
    }
  }

  async #dispatchS3IfPresentResult(
    generic: string,
    object: RValue,
    arguments_: readonly BuiltinCallArgument[],
    context: EvaluationContext,
    includeDefault = true,
  ): Promise<EvaluationResult | undefined> {
    if (generic.length === 0) {
      throw new REvaluationError("NRE2213", "UseMethod() generic name must be non-empty.");
    }
    const methodArguments: ClosureCallFrame["arguments"] =
      arguments_.length === 0
        ? [
            {
              promise: createForcedPromise(object, this.#globalEnvironment),
            },
          ]
        : [
            {
              ...arguments_[0],
              promise: createForcedPromise(object, this.#globalEnvironment),
            },
            ...arguments_.slice(1),
          ];
    return this.#invokeS3MethodIfPresentResult(
      generic,
      this.#baseEnvironment,
      runtimeClassNames(object),
      0,
      methodArguments,
      context,
      includeDefault,
    );
  }

  async #nextS3Method(generic: string | undefined, context: EvaluationContext): Promise<RValue> {
    const frame = this.#s3DispatchFrames.at(-1);
    if (frame === undefined) {
      throw new REvaluationError("NRE2215", "NextMethod() used outside S3 method dispatch.");
    }
    return this.#invokeS3Method(
      generic ?? frame.generic,
      frame.genericEnvironment,
      frame.classes,
      frame.classIndex + 1,
      frame.arguments,
      context,
    );
  }

  async #invokeS3Method(
    generic: string,
    genericEnvironment: REnvironment,
    classes: readonly string[],
    startIndex: number,
    arguments_: ClosureCallFrame["arguments"],
    context: EvaluationContext,
  ): Promise<RValue> {
    const result = await this.#invokeS3MethodIfPresent(
      generic,
      genericEnvironment,
      classes,
      startIndex,
      arguments_,
      context,
    );
    if (result !== undefined) return result;
    throw new REvaluationError(
      "NRE2216",
      `No applicable method for '${generic}' and classes ${classes.join(", ")}.`,
    );
  }

  async #invokeS3MethodIfPresent(
    generic: string,
    genericEnvironment: REnvironment,
    classes: readonly string[],
    startIndex: number,
    arguments_: ClosureCallFrame["arguments"],
    context: EvaluationContext,
    includeDefault = true,
  ): Promise<RValue | undefined> {
    return (
      await this.#invokeS3MethodIfPresentResult(
        generic,
        genericEnvironment,
        classes,
        startIndex,
        arguments_,
        context,
        includeDefault,
      )
    )?.value;
  }

  async #invokeS3MethodIfPresentResult(
    generic: string,
    genericEnvironment: REnvironment,
    classes: readonly string[],
    startIndex: number,
    arguments_: ClosureCallFrame["arguments"],
    context: EvaluationContext,
    includeDefault = true,
  ): Promise<EvaluationResult | undefined> {
    const end = includeDefault ? classes.length : classes.length - 1;
    for (let index = startIndex; index <= end; index += 1) {
      const className = classes[index];
      const methodName = className === undefined ? `${generic}.default` : `${generic}.${className}`;
      const binding =
        lookupBinding(this.#globalEnvironment, methodName) ??
        this.#registeredS3Methods.get(
          this.#s3RegistrationKey(genericEnvironment, generic, className ?? "default"),
        );
      if (binding === undefined) continue;
      const callable = await this.#force(binding, context);
      const dispatchFrame: S3DispatchFrame = {
        generic,
        genericEnvironment,
        classes,
        classIndex: index,
        arguments: arguments_,
      };
      this.#s3DispatchFrames.push(dispatchFrame);
      try {
        return await this.#invokeCallableResult(callable, arguments_, context);
      } finally {
        this.#s3DispatchFrames.pop();
      }
    }
    return undefined;
  }

  async #force(binding: RBinding, context: EvaluationContext): Promise<RValue> {
    if (binding.type !== "promise") return binding;
    return forcePromise(binding, async (expression, environment) =>
      this.#evaluateValue(expression, environment, context),
    );
  }

  async #forceDetailed(promise: RPromise, context: EvaluationContext): Promise<EvaluationResult> {
    if (promise.state === "forced") {
      if (promise.value === undefined) {
        throw new REvaluationError("NRE2011", "A forced promise has no memoized value.");
      }
      return { value: promise.value, visible: true };
    }
    if (promise.state === "forcing") {
      throw new REvaluationError("NRE2010", "Promise is already under evaluation.");
    }
    if (promise.expression === null) {
      throw new REvaluationError("NRE2006", "Argument is missing, with no default.");
    }

    promise.state = "forcing";
    try {
      const result = await this.#evaluateNode(promise.expression, promise.environment, context);
      promise.value = result.value;
      promise.state = "forced";
      return result;
    } catch (error) {
      promise.state = "unforced";
      throw error;
    }
  }

  async #evaluateLanguageValue(
    value: RValue,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<RValue> {
    return (await this.#evaluateLanguageValueResult(value, environment, context)).value;
  }

  async #evaluateLanguageValueResult(
    value: RValue,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    if (value.type === "language") {
      return this.#evaluateNode(value.expression, environment, context);
    }
    if (value.type === "expression") {
      let result: EvaluationResult = { value: R_NULL, visible: false };
      for (const expression of value.values) {
        result = await this.#evaluateNode(expression, environment, context);
      }
      return result;
    }
    if (value.type === "symbol") {
      const binding = lookupBinding(environment, value.name);
      if (binding === undefined) {
        throw new REvaluationError("NRE2001", `Object '${value.name}' not found.`, {
          details: { symbol: value.name },
        });
      }
      return { value: await this.#force(binding, context), visible: true };
    }
    return { value, visible: true };
  }

  #assignmentEnvironment(
    environment: REnvironment,
    name: string,
    nonLocal: boolean,
    span: SourceSpan,
  ): REnvironment {
    if (!nonLocal) return environment;

    let current: REnvironment | null =
      environment === this.#globalEnvironment ? environment : environment.parent;
    while (current !== null) {
      if (current.bindings.has(name)) {
        if (current === this.#baseEnvironment || current === this.#emptyEnvironment) {
          throw new REvaluationError(
            "NRE2012",
            `Cannot change locked built-in binding '${name}'.`,
            { span, details: { symbol: name } },
          );
        }
        return current;
      }
      current = current.parent;
    }
    return this.#globalEnvironment;
  }

  #memoryStatistics(
    reset: boolean,
    full: boolean,
    context: EvaluationContext,
  ): RuntimeMemoryStatistics {
    const census = censusRuntimeMemory(
      [
        this.#globalEnvironment,
        this.#builtinState,
        this.#controlFrames,
        this.#closureCallFrames,
        this.#activeGlobalCallingHandlers,
        this.#registeredS3Methods,
        ...[...this.#packages.values()].map((record) => record.namespace),
      ],
      () => context.checkpoint(),
    );
    this.#memoryCollections += 1;
    if (full) this.#memoryFullCollections += 1;
    this.#memoryMaxUsed = reset
      ? { ...census }
      : {
          nodeCells: Math.max(this.#memoryMaxUsed.nodeCells, census.nodeCells),
          vectorCells: Math.max(this.#memoryMaxUsed.vectorCells, census.vectorCells),
        };
    this.#memoryTrigger = {
      nodeCells: memoryReportingTrigger(census.nodeCells, this.#memoryTrigger.nodeCells),
      vectorCells: memoryReportingTrigger(census.vectorCells, this.#memoryTrigger.vectorCells),
    };
    return Object.freeze({
      nodeCells: Object.freeze({
        used: census.nodeCells,
        trigger: this.#memoryTrigger.nodeCells,
        maxUsed: this.#memoryMaxUsed.nodeCells,
      }),
      vectorCells: Object.freeze({
        used: census.vectorCells,
        trigger: this.#memoryTrigger.vectorCells,
        maxUsed: this.#memoryMaxUsed.vectorCells,
      }),
      collection: this.#memoryCollections,
      fullCollections: this.#memoryFullCollections,
      level: full ? 2 : 0,
    });
  }

  #installBuiltins(): void {
    for (const definition of this.#builtins) {
      const builtin: RBuiltin = { type: "builtin", definition };
      setBinding(this.#baseEnvironment, definition.name, builtin);
    }
    const colors = this.#baseEnvironment.bindings.get("colors");
    if (colors !== undefined) setBinding(this.#baseEnvironment, "colours", colors);
    const listObjects = this.#baseEnvironment.bindings.get("ls");
    if (listObjects !== undefined) setBinding(this.#baseEnvironment, "objects", listObjects);
    setBinding(this.#baseEnvironment, "pi", doubleVector([Math.PI]));
    setBinding(
      this.#baseEnvironment,
      "letters",
      characterVector(Array.from({ length: 26 }, (_, index) => String.fromCharCode(97 + index))),
    );
    setBinding(this.#baseEnvironment, ".Machine", machineConstants());
    setBinding(this.#baseEnvironment, ".Library", characterVector([NATIVR_SYSTEM_LIBRARY_PATH]));
    setBinding(this.#baseEnvironment, ".Library.site", characterVector([]));
    setBinding(
      this.#baseEnvironment,
      ".LC.categories",
      characterVector([
        "LC_ALL",
        "LC_COLLATE",
        "LC_CTYPE",
        "LC_MONETARY",
        "LC_NUMERIC",
        "LC_TIME",
        "LC_MESSAGES",
        "LC_PAPER",
        "LC_MEASUREMENT",
      ]),
    );
  }

  #nearestLoopTarget(span: SourceSpan, keyword: "break" | "next"): symbol {
    for (let index = this.#controlFrames.length - 1; index >= 0; index -= 1) {
      const frame = this.#controlFrames[index];
      if (frame?.kind === "loop") return frame.target;
      if (frame?.kind === "function") break;
    }
    throw new REvaluationError("NRE2208", `No loop is available for '${keyword}'.`, { span });
  }

  #nearestFunctionTarget(span: SourceSpan): symbol {
    for (let index = this.#controlFrames.length - 1; index >= 0; index -= 1) {
      const frame = this.#controlFrames[index];
      if (frame?.kind === "function") return frame.target;
    }
    throw new REvaluationError("NRE2209", "No function is available to return from.", { span });
  }

  #ensureActive(): void {
    if (this.#disposed) {
      throw new RRuntimeDisposedError("NRS5001", "The NativR runtime has been disposed.");
    }
  }
}

function runtimePackageDependencySatisfied(
  version: string,
  dependency: RuntimePackageDependency,
): boolean {
  const constraint = dependency.constraint;
  if (constraint === undefined) return true;
  const comparison = compareRuntimePackageVersions(version, constraint.version);
  switch (constraint.operator) {
    case ">=":
      return comparison >= 0;
    case "<=":
      return comparison <= 0;
    case "==":
      return comparison === 0;
    case ">":
      return comparison > 0;
    case "<":
      return comparison < 0;
    case "!=":
      return comparison !== 0;
  }
}

function compareRuntimePackageVersions(left: string, right: string): number {
  const leftParts = runtimePackageVersionParts(left);
  const rightParts = runtimePackageVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0n;
    const rightPart = rightParts[index] ?? 0n;
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }
  return 0;
}

function runtimePackageVersionParts(value: string): readonly bigint[] {
  if (!/^[0-9]+(?:[.-][0-9]+)*$/u.test(value)) {
    throw new REvaluationError("NRE2229", `Invalid package version '${value}'.`);
  }
  return value.split(/[.-]/u).map((part) => BigInt(part));
}

function machineConstants(): RValue {
  const entries: readonly [string, RValue][] = [
    ["double.eps", doubleVector([Number.EPSILON])],
    ["double.neg.eps", doubleVector([Number.EPSILON / 2])],
    ["double.xmin", doubleVector([2.2250738585072014e-308])],
    ["double.xmax", doubleVector([Number.MAX_VALUE])],
    ["double.base", integerVector([2])],
    ["double.digits", integerVector([53])],
    ["double.rounding", integerVector([5])],
    ["double.guard", integerVector([0])],
    ["double.ulp.digits", integerVector([-52])],
    ["double.neg.ulp.digits", integerVector([-53])],
    ["double.exponent", integerVector([11])],
    ["double.min.exp", integerVector([-1022])],
    ["double.max.exp", integerVector([1024])],
    ["integer.max", integerVector([2_147_483_647])],
    ["sizeof.long", integerVector([4])],
    ["sizeof.longlong", integerVector([8])],
    ["sizeof.longdouble", integerVector([16])],
    ["sizeof.pointer", integerVector([8])],
    ["sizeof.time_t", integerVector([8])],
    ["longdouble.eps", doubleVector([1.0842021724855044e-19])],
    ["longdouble.neg.eps", doubleVector([5.421010862427522e-20])],
    ["longdouble.digits", integerVector([64])],
    ["longdouble.rounding", integerVector([5])],
    ["longdouble.guard", integerVector([0])],
    ["longdouble.ulp.digits", integerVector([-63])],
    ["longdouble.neg.ulp.digits", integerVector([-64])],
    ["longdouble.exponent", integerVector([15])],
    ["longdouble.min.exp", integerVector([-16382])],
    ["longdouble.max.exp", integerVector([16384])],
  ];
  return listValue(
    entries.map(([, value]) => value),
    entries.map(([name]) => name),
  );
}

function promiseCallAst(promise: RPromise, fallbackSpan: SourceSpan): AstNode {
  if (promise.expression !== null) return promise.expression;
  if (promise.missing) {
    return {
      kind: "UnsupportedExpression",
      feature: "missing argument",
      span: fallbackSpan,
    };
  }
  throw new RUnsupportedFeatureError(
    "NRU6130",
    "match.call() cannot yet reconstruct a call argument supplied only as a host runtime value.",
    { span: fallbackSpan },
  );
}

function unsupported(feature: string, span?: SourceSpan): RUnsupportedFeatureError {
  return new RUnsupportedFeatureError(
    "NRU6001",
    `The current NativR subset does not support ${feature}.`,
    span === undefined ? { details: { feature } } : { span, details: { feature } },
  );
}

function runtimeClassNames(value: RValue): readonly string[] {
  if (value.type === "formula") return ["formula"];
  if (value.type === "symbol") return ["name"];
  if (value.type === "language") return ["call"];
  if (value.type === "expression") return ["expression"];
  if (value.type === "null") return ["NULL"];
  const explicit = objectClasses(value);
  if (explicit !== undefined) return explicit;
  if (!isVector(value) && value.type !== "pairlist") {
    return [value.type === "closure" || value.type === "builtin" ? "function" : value.type];
  }
  const dimensions = vectorDimensions(value);
  if (dimensions !== undefined) return dimensions.length === 2 ? ["matrix", "array"] : ["array"];
  if (value.type === "pairlist") return ["pairlist"];
  return [value.type === "double" ? "numeric" : value.type];
}

function isCoordinateMatrixSubscript(target: RValue, index: RValue | undefined): index is RValue {
  if (
    index === undefined ||
    (target.type !== "pairlist" && !isVector(target)) ||
    (index.type !== "integer" && index.type !== "double" && index.type !== "character")
  ) {
    return false;
  }
  return (
    (isDataFrame(target) || vectorDimensions(target) !== undefined) &&
    vectorDimensions(index)?.length === 2
  );
}

function validateBindingName(name: string): void {
  if (!/^(?:[A-Za-z.]|[\u0080-\u{10ffff}])(?:[A-Za-z0-9._]|[\u0080-\u{10ffff}])*$/u.test(name)) {
    throw new REvaluationError("NRE2007", `Invalid binding name '${name}'.`);
  }
}

function staticName(node: AstNode, role: string): string {
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "StringLiteral") return node.value;
  throw new RTypeMismatchError("NRT3116", `A ${role} must be a static name.`, { span: node.span });
}

function environmentSubscriptName(value: RValue): string {
  if (
    value.type !== "character" ||
    value.length !== 1 ||
    isMissing(value, 0) ||
    (value.values[0] ?? "").length === 0
  ) {
    throw new RTypeMismatchError(
      "NRT3305",
      "An environment subscript must be one non-missing character name.",
    );
  }
  return value.values[0] ?? "";
}

function scalarLogicalState(value: RValue, operator: string): boolean | undefined {
  if (!isAtomic(value) || value.type === "character" || value.length !== 1) {
    throw new RTypeMismatchError(
      "NRT3113",
      `Operator '${operator}' requires one logical or numeric value on each side.`,
      { details: { type: value.type, ...("length" in value ? { length: value.length } : {}) } },
    );
  }
  if (isMissing(value, 0)) return undefined;
  if (value.type === "complex") {
    const real = value.real[0] ?? 0;
    const imaginary = value.imaginary[0] ?? 0;
    if (Number.isNaN(real) || Number.isNaN(imaginary)) return undefined;
    return real !== 0 || imaginary !== 0;
  }
  const item = value.values[0] ?? 0;
  if (Number.isNaN(item)) return undefined;
  return item !== 0;
}

function conditionState(value: RValue, construct: "if" | "while", span: SourceSpan): boolean {
  const state = scalarLogicalState(value, construct);
  if (state === undefined) {
    throw new REvaluationError(
      "NRE2207",
      `A missing value cannot be used as a ${construct} condition.`,
      {
        span,
      },
    );
  }
  return state;
}

function isCallableValue(value: unknown): value is RClosure | RBuiltin {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  return value.type === "closure" || value.type === "builtin";
}

function exactMatchState(value: RValue, span: SourceSpan): boolean | null {
  if (value.type !== "logical" || value.length !== 1) {
    throw new RTypeMismatchError("NRT3117", "'exact' must be one logical value.", {
      span,
      details: { type: value.type, ...("length" in value ? { length: value.length } : {}) },
    });
  }
  return isMissing(value, 0) ? null : value.values[0] === 1;
}

function estimateOutputBytes(value: RValue): number {
  switch (value.type) {
    case "null":
      return 0;
    case "logical":
      return value.values.byteLength + (value.missing?.byteLength ?? 0);
    case "integer":
    case "double":
    case "raw":
      return value.values.byteLength + (value.missing?.byteLength ?? 0);
    case "complex":
      return value.real.byteLength + value.imaginary.byteLength + (value.missing?.byteLength ?? 0);
    case "character":
      return (
        value.values.reduce((bytes, item) => bytes + item.length * 2, 0) +
        (value.missing?.byteLength ?? 0)
      );
    case "list":
    case "pairlist":
      return value.values.reduce((bytes, item) => bytes + estimateOutputBytes(item), 0);
    case "formula":
      return (
        16 +
        (value.response?.length ?? 0) * 2 +
        value.terms.reduce((bytes, term) => bytes + term.length * 2, 0) +
        value.variables.reduce((bytes, variable) => bytes + variable.length * 2, 0)
      );
    case "symbol":
      return value.name.length * 2;
    case "language":
      return Math.max(16, value.expression.span.end.offset - value.expression.span.start.offset);
    case "expression":
      return value.values.reduce(
        (bytes, expression) =>
          bytes + Math.max(16, expression.span.end.offset - expression.span.start.offset),
        0,
      );
    case "builtin":
    case "closure":
    case "dots":
    case "environment":
      return 64;
  }
}

function normalizeFormula(
  node: Extract<AstNode, { readonly kind: "FormulaExpression" }>,
  environment: REnvironment,
): RValue {
  const response = node.left === undefined ? undefined : formulaLabel(node.left);
  const state = { intercept: true, terms: [] as string[] };
  collectFormulaTerms(node.right, state, 1);
  const variables = new Set<string>();
  if (node.left !== undefined) collectFormulaVariables(node.left, variables);
  collectFormulaVariables(node.right, variables);
  return {
    type: "formula",
    ...(response === undefined ? {} : { response }),
    terms: [...new Set(state.terms)],
    variables: [...variables],
    intercept: state.intercept,
    environment,
  };
}

function collectFormulaTerms(
  node: AstNode,
  state: { intercept: boolean; terms: string[] },
  sign: 1 | -1,
): void {
  if (
    (node.kind === "DoubleLiteral" || node.kind === "IntegerLiteral") &&
    (node.value === 0 || node.value === 1)
  ) {
    if ((node.value === 0 && sign === 1) || (node.value === 1 && sign === -1)) {
      state.intercept = false;
    }
    if (node.value === 1 && sign === 1) state.intercept = true;
    return;
  }
  if (node.kind === "BinaryExpression" && (node.operator === "+" || node.operator === "-")) {
    collectFormulaTerms(node.left, state, sign);
    collectFormulaTerms(node.right, state, node.operator === "+" ? sign : sign === 1 ? -1 : 1);
    return;
  }
  if (node.kind === "BinaryExpression" && node.operator === "*") {
    const left = expandedFormulaTerms(node.left);
    const right = expandedFormulaTerms(node.right);
    updateFormulaTerms(state, [...left, ...right], sign);
    updateFormulaTerms(
      state,
      left.flatMap((leftTerm) => right.map((rightTerm) => `${leftTerm}:${rightTerm}`)),
      sign,
    );
    return;
  }
  if (node.kind === "BinaryExpression" && node.operator === ":") {
    const left = expandedFormulaTerms(node.left);
    const right = expandedFormulaTerms(node.right);
    updateFormulaTerms(
      state,
      left.flatMap((leftTerm) => right.map((rightTerm) => `${leftTerm}:${rightTerm}`)),
      sign,
    );
    return;
  }
  if (node.kind === "BinaryExpression" && node.operator === "/") {
    const left = expandedFormulaTerms(node.left);
    const right = expandedFormulaTerms(node.right);
    updateFormulaTerms(state, left, sign);
    updateFormulaTerms(
      state,
      left.flatMap((leftTerm) => right.map((rightTerm) => `${leftTerm}:${rightTerm}`)),
      sign,
    );
    return;
  }
  updateFormulaTerms(state, [formulaLabel(node)], sign);
}

function expandedFormulaTerms(node: AstNode): string[] {
  if (node.kind === "BinaryExpression" && node.operator === "+") {
    return [...expandedFormulaTerms(node.left), ...expandedFormulaTerms(node.right)];
  }
  return [formulaLabel(node)];
}

function updateFormulaTerms(
  state: { terms: string[] },
  terms: readonly string[],
  sign: 1 | -1,
): void {
  if (sign === 1) state.terms.push(...terms);
  else state.terms = state.terms.filter((term) => !terms.includes(term));
}

function formulaLabel(node: AstNode): string {
  switch (node.kind) {
    case "Identifier":
      return node.name;
    case "DoubleLiteral":
    case "IntegerLiteral":
      return String(node.value);
    case "StringLiteral":
      return JSON.stringify(node.value);
    case "LogicalLiteral":
      return node.value ? "TRUE" : "FALSE";
    case "NullLiteral":
      return "NULL";
    case "MissingLiteral":
      return "NA";
    case "UnaryExpression":
      return `${node.operator}${formulaLabel(node.operand)}`;
    case "BinaryExpression":
      return `${formulaLabel(node.left)} ${node.operator} ${formulaLabel(node.right)}`;
    case "CallExpression":
      return `${formulaLabel(node.callee)}(${node.arguments
        .map((argument) =>
          argument.name === undefined
            ? formulaLabel(argument.value)
            : `${argument.name} = ${formulaLabel(argument.value)}`,
        )
        .join(", ")})`;
    case "SubsetExpression": {
      if (node.operator === "$" || node.operator === "@") {
        return `${formulaLabel(node.target)}${node.operator}${formulaLabel(
          node.arguments[0]?.value ?? node.target,
        )}`;
      }
      return `${formulaLabel(node.target)}${node.operator}${node.arguments
        .map((argument) => formulaLabel(argument.value))
        .join(", ")}${node.operator === "[[" ? "]]" : "]"}`;
    }
    case "NamespaceExpression":
      return `${formulaLabel(node.namespace)}${node.operator}${formulaLabel(node.member)}`;
    default:
      throw unsupported("formula language form", node.span);
  }
}

function collectFormulaVariables(node: AstNode, output: Set<string>): void {
  switch (node.kind) {
    case "Identifier":
      if (node.name !== ".") output.add(node.name);
      return;
    case "UnaryExpression":
      collectFormulaVariables(node.operand, output);
      return;
    case "BinaryExpression":
      collectFormulaVariables(node.left, output);
      collectFormulaVariables(node.right, output);
      return;
    case "CallExpression":
      for (const argument of node.arguments) collectFormulaVariables(argument.value, output);
      return;
    case "SubsetExpression":
      collectFormulaVariables(node.target, output);
      if (node.operator !== "$" && node.operator !== "@") {
        for (const argument of node.arguments) collectFormulaVariables(argument.value, output);
      }
      return;
    case "NamespaceExpression":
    case "DoubleLiteral":
    case "IntegerLiteral":
    case "StringLiteral":
    case "LogicalLiteral":
    case "NullLiteral":
    case "MissingLiteral":
      return;
    default:
      throw unsupported("formula variable language form", node.span);
  }
}

function memoryReportingTrigger(used: number, previous: number): number {
  if (previous >= used) return previous;
  const target = Math.max(1_024, Math.ceil(used * 1.5));
  return Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(target / 1_024) * 1_024);
}
