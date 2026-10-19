import {
  matchArguments,
  matchArgumentsWithWarnings,
  partialMatchWarning,
  partialMatchWarningsEnabled,
} from "./arguments.js";
import type { PartialArgumentMatch } from "./arguments.js";
import { translatePosixCharacterClasses } from "./regex.js";
import { assertNever } from "@nativr/ast";
import type {
  AssignmentExpressionNode,
  AstNode,
  CallArgument,
  CallExpressionNode,
  ProgramNode,
  SourceSpan,
  SubsetExpressionNode,
} from "@nativr/ast";

import { EvaluationContext, DEFAULT_RUNTIME_LIMITS } from "./context.js";
import { deparseAst, deparseDiagnosticAst } from "./language.js";
import {
  embeddedValueAst,
  extractLanguageElement,
  extractLanguageMember,
  quoteLanguageNode,
  replaceLanguageElement,
  replaceLanguageMember,
  replaceLanguageSubset,
  subsetLanguage,
} from "./language-subset.js";
import { censusRuntimeMemory } from "./memory.js";
import {
  createEnvironment,
  createForcedPromise,
  createMissingPromise,
  createPromise,
  forcePromise,
  lookupBinding,
  missingArgumentMessage,
  setBinding,
} from "./environment.js";
import {
  NativRError,
  errorConditionCall,
  errorConditionClasses,
  recordErrorConditionCall,
  REvaluationError,
  RSignalledConditionError,
  RResourceLimitError,
  RRuntimeDisposedError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
} from "./errors.js";
import { decodeRBase64Resource, decodeRWorkspaceFile } from "./serialization.js";
import {
  characterVector,
  characterLiteralValue,
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
  pairlistValue,
  BASE_OPTIONS_STATE_KEY,
  NATIVR_PACKAGE_LIBRARY_PATH,
  NATIVR_PACKAGE_SOURCE_RESOURCE_ROOT,
  NATIVR_SYSTEM_LIBRARY_PATH,
  PACKAGE_SOURCE_EVALUATION_DIRECTORY_STATE_KEY,
  R_NULL,
  vectorDimensions,
  withClasses,
  withAttribute,
  GLOBAL_CALLING_HANDLERS_STATE_KEY,
  USER_HOOKS_STATE_KEY,
  runtimeOutputRouter,
  HOST_ELEMENTARY_MATH,
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
  RList,
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
  ElementaryMath,
} from "./values.js";

/** Internal value and visibility returned by one expression. */
export interface EvaluationResult {
  readonly value: RValue;
  readonly visible: boolean;
}

/** An error handled by options(error=) while evaluating top-level script expressions. */
export interface TopLevelEvaluationError {
  /** One-based index in the normalized program body. */
  readonly expressionIndex: number;
  readonly code: string;
  readonly message: string;
}

/** Optional script behavior; ordinary evaluation stops on the first uncaught error. */
export interface EvaluationOptions {
  readonly topLevelErrorHandling?: "option";
  /** Print each visible top-level result as a script runner would. */
  readonly printVisibleTopLevel?: boolean;
}

/** Complete internal result for one source evaluation. */
export interface DetailedEvaluationResult extends EvaluationResult {
  readonly topLevelErrors: readonly TopLevelEvaluationError[];
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
  /** Immutable text resources for registered core packages, supplied at session creation. */
  readonly systemPackageResources?: readonly RuntimeSystemPackageTextResource[];
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
  /** Elementary functions for this session (RFC-0007); defaults to the engine's Math. */
  readonly elementaryMath?: ElementaryMath;
}

/** One dependency imported by a normalized source-only package. */
export interface RuntimePackageImport {
  readonly package: string;
  /** Undefined imports the dependency's complete exported surface. */
  readonly names?: readonly string[];
  /** Local binding names corresponding to explicit export names. */
  readonly localNames?: readonly string[];
  /** Export names omitted from a full import. */
  readonly except?: readonly string[];
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

/** One browser-supplied data resource belonging to a registered core package. */
export interface RuntimeSystemPackageTextResource extends RuntimePackageTextResource {
  readonly package: string;
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
  /** exportPattern() declarations, including C-locale POSIX character classes. */
  readonly exportPatterns: readonly string[];
  /** S4 method names declared by exportMethods(); they need not be ordinary namespace bindings. */
  readonly methodExports: readonly string[];
  readonly s3Methods: readonly RuntimeS3Method[];
  readonly programs: readonly ProgramNode[];
  readonly textResources: readonly RuntimePackageTextResource[];
  readonly resources: readonly RuntimePackageResource[];
}

interface RuntimePackageRecord {
  readonly definition: RuntimePackageDefinition;
  namespace: REnvironment | undefined;
  exportNames: readonly string[] | undefined;
  loading: boolean;
  attached: boolean;
}

function runtimePackageExportNames(record: RuntimePackageRecord): readonly string[] {
  return (
    record.exportNames ??
    Object.freeze([...new Set([...record.definition.exports, ...record.definition.methodExports])])
  );
}

function resolveRuntimePackageExportNames(
  record: RuntimePackageRecord,
  namespace: REnvironment,
): readonly string[] {
  const names = new Set([...record.definition.exports, ...record.definition.methodExports]);
  for (const pattern of record.definition.exportPatterns) {
    let matcher: RegExp;
    try {
      matcher = new RegExp(translatePosixCharacterClasses(pattern), "u");
    } catch (error) {
      throw new REvaluationError(
        "NRE2230",
        `Package '${record.definition.name}' NAMESPACE has invalid exportPattern '${pattern}'.`,
        { cause: error },
      );
    }
    for (const name of namespace.bindings.keys()) {
      if (matcher.test(name)) names.add(name);
    }
  }
  return Object.freeze([...names]);
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
  readonly group?: string;
  readonly methodName?: string;
  readonly previousClasses?: RValue;
  readonly genericEnvironment: REnvironment;
  readonly classes: readonly string[];
  readonly classIndex: number;
  readonly arguments: ClosureCallFrame["arguments"];
  readonly call?: CallExpressionNode;
  readonly callerEnvironment?: REnvironment;
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
  ["stats", "all"],
  ["methods", "all"],
  ["grDevices", "all"],
  ["graphics", "all"],
  ["utils", "all"],
  ["datasets", "all"],
  ["tools", "all"],
  ["R6", new Set(["R6Class"])],
  ["vctrs", new Set(["new_class", "new_vctr"])],
  ["tibble", new Set(["tibble", "tribble"])],
]);
const BASE_NAMESPACE_CONSTANTS = new Set([
  ".GlobalEnv",
  "pi",
  "letters",
  "LETTERS",
  "T",
  "F",
  ".Machine",
  ".Platform",
  ".LC.categories",
  ".Library",
  ".Library.site",
]);
const PRIMITIVE_S3_GENERICS = new Set([
  "$",
  "[",
  "[[",
  "$<-",
  "[<-",
  "[[<-",
  "Ops",
  "Summary",
  "+",
  "-",
  "*",
  "/",
  "^",
  "%%",
  "%/%",
  "<",
  "<=",
  ">",
  ">=",
  "==",
  "!=",
  "!",
  "&",
  "|",
]);
const CORE_R_PACKAGE_NAMES = new Set([
  "base",
  "stats",
  "graphics",
  "grDevices",
  "utils",
  "datasets",
  "methods",
  "tools",
]);

function corePackageDescriptionFields(
  name: string,
): readonly { readonly name: string; readonly value: string }[] {
  return Object.freeze([
    Object.freeze({ name: "Package", value: name }),
    Object.freeze({ name: "Version", value: "4.6.1" }),
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

interface ExitingConditionFrame {
  readonly kind: "exiting";
  readonly target: symbol;
  readonly classes: readonly string[];
}

/** A calling-handler frame that muffles matching warnings or messages at its stack position. */
interface MufflingConditionFrame {
  readonly kind: "muffle";
  readonly condition: "warning" | "message";
  readonly classes: readonly string[];
}

/** One local calling handler from withCallingHandlers(); it runs in place and may resume. */
interface CallingConditionFrame {
  readonly kind: "calling";
  readonly className: string;
  readonly handler: RValue;
}

/** try() catches errors outside the handler stack, so eager error signalling stops here. */
interface BarrierConditionFrame {
  readonly kind: "barrier";
}

type ConditionFrame =
  ExitingConditionFrame | MufflingConditionFrame | CallingConditionFrame | BarrierConditionFrame;

/** An established restart; `exit` is the environment that identifies its restart object. */
interface RestartFrame {
  readonly name: string;
  readonly exit: REnvironment;
  readonly restart: RValue;
}

class RestartSignal extends Error {
  public constructor(
    public readonly exit: REnvironment,
    public readonly arguments_: readonly RValue[],
  ) {
    super("Internal restart control signal.");
  }
}

const SIMPLE_WARNING_CLASSES = Object.freeze(["simpleWarning", "warning", "condition"]);

const SYNTHETIC_SPAN: SourceSpan = Object.freeze({
  start: Object.freeze({ offset: 0, line: 1, column: 1 }),
  end: Object.freeze({ offset: 0, line: 1, column: 1 }),
});

function syntheticClosure(parameters: readonly string[], body: AstNode): RClosure {
  return {
    type: "closure",
    parameters: parameters.map((name) => ({ name, span: SYNTHETIC_SPAN })),
    body,
    environment: createEnvironment(null),
    attributes: new Map(),
  };
}

/** Restart objects carry `test = function(c) TRUE`; muffle restarts use `function() NULL`. */
const RESTART_TEST = syntheticClosure(["c"], {
  kind: "LogicalLiteral",
  value: true,
  span: SYNTHETIC_SPAN,
});
const MUFFLE_HANDLER = syntheticClosure([], { kind: "NullLiteral", span: SYNTHETIC_SPAN });

/** GNU R's always-present top-level restart, an unnamed list of its name and NULL. */
const ABORT_RESTART: RValue = withClasses(listValue([characterVector(["abort"]), R_NULL]), [
  "restart",
]);

class ExitingConditionSignal extends Error {
  public constructor(
    public readonly target: symbol,
    public readonly handlerIndex: number,
    public readonly condition: RValue,
  ) {
    super("Internal exiting condition control signal.");
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
  readonly #math: ElementaryMath;
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
  #baseNamespace: REnvironment;
  readonly #staticNamespaces = new Map<string, REnvironment>();
  #globalEnvironment: REnvironment;
  readonly #controlFrames: ControlFrame[] = [];
  readonly #closureCallFrames: ClosureCallFrame[] = [];
  readonly #errorCallTraces = new WeakMap<NativRError, readonly CallExpressionNode[]>();
  readonly #s3DispatchFrames: S3DispatchFrame[] = [];
  readonly #builtinState = new Map<string, unknown>();
  readonly #activeGlobalCallingHandlers = new Set<RValue>();
  readonly #conditionFrames: ConditionFrame[] = [];
  readonly #restartFrames: RestartFrame[] = [];
  // Errors already offered to the handler stack where they were raised, such as stop().
  readonly #signalledErrors = new WeakSet<NativRError>();
  readonly #packages = new Map<string, RuntimePackageRecord>();
  readonly #namespaceNames = new WeakMap<REnvironment, string>();
  readonly #systemPackageResources = new Map<string, Map<string, string>>();
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
    this.#math = options.elementaryMath ?? HOST_ELEMENTARY_MATH;
    this.#parseSource = options.parseSource;
    this.#initializeBuiltinState = options.initializeBuiltinState;
    this.#readline = options.readline;
    this.#urlRequest = options.urlRequest;
    this.#socketRequest = options.socketRequest;
    this.#systemCommand = options.systemCommand;
    this.#nativeModules = options.nativeModules ?? [];
    this.#nativeCall = options.nativeCall;
    let systemResourceBytes = 0;
    let systemResourceCount = 0;
    for (const resource of options.systemPackageResources ?? []) {
      if (
        typeof resource !== "object" ||
        resource === null ||
        typeof resource.package !== "string" ||
        typeof resource.path !== "string" ||
        typeof resource.text !== "string" ||
        !REGISTERED_NAMESPACE_EXPORTS.has(resource.package) ||
        resource.path.length === 0 ||
        resource.path
          .split("/")
          .some((part) => part.length === 0 || part === "." || part === "..") ||
        resource.path.includes("\\") ||
        [...resource.path].some((character) => {
          const codePoint = character.codePointAt(0)!;
          return codePoint <= 0x1f || codePoint === 0x7f;
        })
      ) {
        throw new REvaluationError("NRE2231", "Invalid core package resource path.");
      }
      const resources =
        this.#systemPackageResources.get(resource.package) ?? new Map<string, string>();
      if (resources.has(resource.path)) {
        throw new REvaluationError("NRE2231", "Duplicate core package resource path.");
      }
      systemResourceCount += 1;
      // Three bytes per UTF-16 code unit is a conservative UTF-8 upper bound.
      systemResourceBytes += 3 * (resource.path.length + resource.text.length);
      if (
        !Number.isSafeInteger(systemResourceBytes) ||
        systemResourceBytes > this.#limits.maxPackageResourceBytes ||
        systemResourceCount > this.#limits.maxVectorLength
      ) {
        throw new RResourceLimitError("NRL4002", "Core package resource limit exceeded.");
      }
      resources.set(resource.path, resource.text);
      this.#systemPackageResources.set(resource.package, resources);
    }
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
    this.#globalEnvironment = createEnvironment(this.#baseEnvironment, true);
    this.#baseNamespace = {
      ...createEnvironment(this.#globalEnvironment, true),
      bindings: this.#baseEnvironment.bindings,
      lockedBindings: this.#baseEnvironment.lockedBindings,
    };
    this.#namespaceNames.set(this.#baseNamespace, "base");
    this.#staticNamespaces.set("base", this.#baseNamespace);
    for (const name of REGISTERED_NAMESPACE_EXPORTS.keys()) {
      if (name === "base") continue;
      const namespace = createEnvironment(createEnvironment(this.#baseNamespace, true), true);
      this.#staticNamespaces.set(name, namespace);
      this.#namespaceNames.set(namespace, name);
    }
    this.#installBuiltins();
    this.#ensureSearchEnvironments();
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
        exportNames: undefined,
        loading: false,
        attached: false,
      });
    }
  }

  /** Evaluate a normalized program in the session global environment. */
  public async evaluate(
    program: ProgramNode,
    options: EvaluationOptions = {},
  ): Promise<DetailedEvaluationResult> {
    this.#ensureActive();
    const cancellation = { cancelled: false };
    this.#activeCancellation = cancellation;
    const context = new EvaluationContext(
      this.#limits,
      cancellation,
      () => runtimeOutputRouter(this.#builtinState),
      this.#math,
    );
    const start = Date.now();
    try {
      const topLevelErrors: TopLevelEvaluationError[] = [];
      const result =
        options.topLevelErrorHandling === "option" || options.printVisibleTopLevel === true
          ? await this.#evaluateTopLevelScript(program, context, topLevelErrors, options)
          : await this.#evaluateNode(program, this.#globalEnvironment, context);
      const outputBytes = estimateOutputBytes(result.value) + context.outputBytes;
      if (outputBytes > this.#limits.maxOutputBytes) {
        throw new RResourceLimitError("NRL4007", "Evaluation output size limit exceeded.", {
          details: { maxOutputBytes: this.#limits.maxOutputBytes, outputBytes },
        });
      }
      return {
        ...result,
        topLevelErrors,
        warnings: [...context.warnings],
        output: [...context.output],
        dataViews: [...context.dataViews],
        browseRequests: [...context.browseRequests],
        graphics: [...context.graphics],
        elapsedMs: Date.now() - start,
      };
    } catch (error) {
      if (
        error instanceof NativRError &&
        !(error instanceof RResourceLimitError) &&
        !this.#signalledErrors.has(error)
      ) {
        await this.#signalErrorCondition(error, context);
      }
      throw error;
    } finally {
      this.#activeCancellation = undefined;
    }
  }

  async #evaluateTopLevelScript(
    program: ProgramNode,
    context: EvaluationContext,
    errors: TopLevelEvaluationError[],
    options: EvaluationOptions,
  ): Promise<EvaluationResult> {
    context.checkpoint();
    let result: EvaluationResult = { value: R_NULL, visible: false };
    for (let index = 0; index < program.body.length; index += 1) {
      const expression = program.body[index];
      if (expression === undefined) continue;
      try {
        result = await this.#evaluateNode(expression, this.#globalEnvironment, context);
        if (options.printVisibleTopLevel === true && result.visible) {
          const printBinding = lookupBinding(this.#baseEnvironment, "print");
          if (printBinding === undefined) {
            throw new REvaluationError("NRE2001", "Object 'print' not found.");
          }
          const printFunction = await this.#force(printBinding, context);
          await this.#invokeCallable(
            printFunction,
            [{ promise: createForcedPromise(result.value, this.#globalEnvironment) }],
            context,
          );
        }
      } catch (error) {
        if (!(error instanceof NativRError) || error instanceof RResourceLimitError) {
          throw error;
        }
        if (options.topLevelErrorHandling !== "option") throw error;
        const stored = this.#builtinState.get(BASE_OPTIONS_STATE_KEY);
        const handler: unknown = stored instanceof Map ? stored.get("error") : undefined;
        if (!isCallableValue(handler)) throw error;
        if (!this.#signalledErrors.has(error)) await this.#signalErrorCondition(error, context);
        context.writeOutput({ stream: "stderr", text: this.#formatTopLevelError(error, context) });
        errors.push({ expressionIndex: index + 1, code: error.code, message: error.message });
        result = { value: R_NULL, visible: false };
        await this.#invokeCallable(handler, [], context);
      }
    }
    return result;
  }

  #formatTopLevelError(error: NativRError, context: EvaluationContext): string {
    const call =
      error instanceof RSignalledConditionError
        ? extractListMember(error.condition, "call", context)
        : R_NULL;
    if (call.type !== "language") return `Error: ${error.message}\n`;
    const prefix = `Error in ${deparseDiagnosticAst(call.expression)} : `;
    const separator = prefix.length + error.message.length > 72 ? "\n  " : "";
    let output = `${prefix}${separator}${error.message}\n`;
    const trace = this.#errorCallTraces.get(error);
    if (trace !== undefined && trace.length > 1) {
      output += `Calls: ${trace.map((frame) => (frame.callee.kind === "Identifier" ? frame.callee.name : deparseAst(frame.callee))).join(" -> ")}\n`;
    }
    return output;
  }

  /** Assign an already-converted runtime value in the global environment. */
  public async assign(name: string, value: RValue): Promise<void> {
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
    const context = new EvaluationContext(
      this.#limits,
      { cancelled: false },
      () => runtimeOutputRouter(this.#builtinState),
      this.#math,
    );
    await this.#assignBinding(this.#globalEnvironment, name, value, context);
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
    const context = new EvaluationContext(
      this.#limits,
      { cancelled: false },
      () => runtimeOutputRouter(this.#builtinState),
      this.#math,
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
    const context = new EvaluationContext(
      this.#limits,
      { cancelled: false },
      () => runtimeOutputRouter(this.#builtinState),
      this.#math,
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
    this.#globalEnvironment = createEnvironment(this.#baseEnvironment, true);
    this.#baseNamespace.parent = this.#globalEnvironment;
    this.#builtinState.clear();
    this.#installGlobalEnvironmentBinding();
    this.#initializeBuiltinState?.(this.#builtinState);
    this.#registeredS3Methods.clear();
    this.#installBuiltinS3Methods();
    this.#s3RegistrationTransactions.length = 0;
    for (const record of this.#packages.values()) {
      record.namespace?.bindings.clear();
      record.namespace = undefined;
      record.exportNames = undefined;
      record.loading = false;
      record.attached = false;
    }
    this.#searchPath = [...DEFAULT_SEARCH_PATH];
    this.#libraryPaths = [...DEFAULT_LIBRARY_PATHS];
    this.#invalidateSearchEnvironments(true);
    this.#ensureSearchEnvironments();
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
      this.#baseEnvironment.bindings.clear();
      for (const namespace of this.#staticNamespaces.values()) namespace.bindings.clear();
      this.#staticNamespaces.clear();
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
    // Keep origin handling in this frame: another async wrapper adds a hop to every AST node.
    // Await recursive paths below so their failures reach this handler before outer expressions.
    try {
      context.checkpoint();
      switch (node.kind) {
        case "Program":
        case "Block":
          return await this.#evaluateSequence(node.body, environment, context);
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
          return { value: characterLiteralValue(node), visible: true };
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
          const dotDot = /^\.\.([1-9][0-9]*)$/u.exec(node.name);
          if (dotDot !== null) {
            const dots = lookupBinding(environment, "...");
            if (dots?.type !== "dots") {
              throw new REvaluationError(
                "NRE2001",
                `'${node.name}' used in an incorrect context, no '...' to look in.`,
                { span: node.span, details: { symbol: node.name } },
              );
            }
            const argument = dots.arguments[Number(dotDot[1]) - 1];
            if (argument === undefined) {
              throw new REvaluationError(
                "NRE2103",
                `The ... list contains fewer than ${dotDot[1]} elements.`,
                { span: node.span },
              );
            }
            return await this.#forceDetailed(argument.promise, context);
          }
          const binding = lookupBinding(environment, node.name);
          if (binding === undefined) {
            throw new REvaluationError("NRE2001", `object '${node.name}' not found`, {
              span: node.span,
              details: { symbol: node.name },
            });
          }
          if (binding.type !== "promise" || binding.state === "forced") {
            return { value: await this.#force(binding, context), visible: true };
          }
          return await this.#forceDetailed(binding, context);
        }
        case "UnaryExpression": {
          const operand = await this.#evaluateValue(node.operand, environment, context);
          const dispatched = await this.#dispatchOperatorS3(
            node.operator,
            [operand],
            environment,
            [node.operand.span],
            context,
          );
          if (dispatched !== undefined) return dispatched;
          const warningStart = context.warnings.length;
          let value: RValue;
          try {
            value = this.#operators.unary(context, node.operator, operand);
          } catch (error) {
            return await this.#signalWarningsBeforeError(warningStart, node, context, error);
          }
          await this.#signalRecordedWarnings(warningStart, node, context);
          return { value, visible: true };
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
          const dispatched = await this.#dispatchOperatorS3(
            node.operator,
            [left, right],
            environment,
            [node.left.span, node.right.span],
            context,
          );
          if (dispatched !== undefined) return dispatched;
          const warningStart = context.warnings.length;
          let value: RValue;
          try {
            value = this.#operators.binary(context, node.operator, left, right);
          } catch (error) {
            return await this.#signalWarningsBeforeError(warningStart, node, context, error);
          }
          await this.#signalRecordedWarnings(warningStart, node, context);
          return { value, visible: true };
        }
        case "AssignmentExpression": {
          const value = await this.#evaluateValue(node.value, environment, context);
          const targetEnvironment = this.#assignmentEnvironment(
            environment,
            node.target.name,
            node.operator === "<<-" || node.operator === "->>",
            node.span,
          );
          await this.#assignBinding(targetEnvironment, node.target.name, value, context);
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
              await this.#assignBinding(target, memberName, replacement, context);
              return { value: replacement, visible: false };
            }
            updated =
              target.type === "null"
                ? replacement.type === "null"
                  ? R_NULL
                  : replaceListMember(listValue([]), memberName, replacement, context)
                : target.type === "language"
                  ? replaceLanguageMember(target, memberName, replacement, context)
                  : replaceListMember(target, memberName, replacement, context);
          } else {
            if (target.type === "environment") {
              if (node.target.operator !== "[[") {
                throw new RTypeMismatchError(
                  "NRT3306",
                  "Environment replacement requires [[ or $.",
                );
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
              await this.#assignBinding(
                target,
                environmentSubscriptName(index),
                replacement,
                context,
              );
              return { value: replacement, visible: false };
            }
            if (target.type === "null") {
              const arguments_ = node.target.arguments;
              if (arguments_.length > 1) {
                throw new REvaluationError(
                  "NRE2204",
                  `${node.target.operator} replacement requires one-dimensional subsetting on NULL.`,
                );
              }
              const argument = arguments_[0]?.value;
              const missing =
                argument?.kind === "UnsupportedExpression" &&
                argument.feature === "missing argument";
              if (node.target.operator === "[[" && (argument === undefined || missing)) {
                throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
              }
              const index =
                argument === undefined || missing
                  ? undefined
                  : await this.#evaluateValue(argument, environment, context);
              if (replacement.type === "null") {
                updated = R_NULL;
              } else if (node.target.operator === "[") {
                const emptyTarget =
                  replacement.type === "list" || replacement.type === "pairlist"
                    ? listValue([])
                    : isAtomic(replacement)
                      ? subsetVector(replacement, integerVector([]), context)
                      : logicalVector([]);
                updated = replaceVectorSubset(emptyTarget, index, replacement, context);
              } else {
                if (index === undefined) {
                  throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
                }
                updated = replaceVectorElement(listValue([]), index, replacement, context);
              }
              await this.#assignBinding(targetEnvironment, name, updated, context);
              return { value: replacement, visible: false };
            }
            if (target.type === "language") {
              const positional = node.target.arguments.filter(
                (argument) => argument.name === undefined,
              );
              if (
                positional.length > 1 ||
                (node.target.operator === "[[" && positional.length !== 1)
              ) {
                throw new REvaluationError(
                  "NRE2204",
                  "Language replacement accepts at most one subscript.",
                );
              }
              if (node.target.arguments.some((entry) => entry.name !== undefined)) {
                throw new REvaluationError(
                  "NRE2202",
                  "Language replacement requires positional subscripts.",
                );
              }
              const argument = positional[0]?.value;
              const missing =
                argument?.kind === "UnsupportedExpression" &&
                argument.feature === "missing argument";
              if (node.target.operator === "[[" && (argument === undefined || missing)) {
                throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
              }
              const index =
                argument === undefined || missing
                  ? undefined
                  : await this.#evaluateValue(argument, environment, context);
              updated =
                node.target.operator === "["
                  ? replaceLanguageSubset(target, index, replacement, context)
                  : replaceLanguageElement(target, index as RValue, replacement, context);
              await this.#assignBinding(targetEnvironment, name, updated, context);
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
              await this.#assignBinding(targetEnvironment, name, updated, context);
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
          await this.#assignBinding(targetEnvironment, name, updated, context);
          return { value: replacement, visible: false };
        }
        case "CallExpression": {
          const warningStart = context.warnings.length;
          let result: EvaluationResult;
          try {
            result = await this.#evaluateCall(node, environment, context);
          } catch (error) {
            return await this.#signalWarningsBeforeError(warningStart, node, context, error);
          }
          await this.#signalRecordedWarnings(warningStart, node, context);
          return result;
        }
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
            return await this.#evaluateNode(node.consequence, environment, context);
          }
          return await (node.alternative === undefined
            ? { value: R_NULL, visible: false }
            : this.#evaluateNode(node.alternative, environment, context));
        case "ForExpression":
          return await this.#evaluateFor(node, environment, context);
        case "WhileExpression":
          return await this.#evaluateWhile(node, environment, context);
        case "RepeatExpression":
          return await this.#evaluateRepeat(node.body, environment, context);
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
            if (objectClasses(target) !== undefined) {
              const dispatched = await this.#invokeS3MethodIfPresentResult(
                "$",
                this.#baseEnvironment,
                runtimeClassNames(target),
                0,
                [
                  { promise: createForcedPromise(target, environment), span: node.target.span },
                  {
                    promise: createForcedPromise(characterVector([name]), environment),
                    span: member.span,
                  },
                ],
                context,
                false,
                undefined,
                environment,
              );
              if (dispatched !== undefined) return dispatched;
            }
            if (target.type === "environment") {
              const binding = target.bindings.get(name);
              return {
                value: binding === undefined ? R_NULL : await this.#force(binding, context),
                visible: true,
              };
            }
            if (target.type === "null") return { value: R_NULL, visible: true };
            if (target.type === "language") {
              return { value: extractLanguageMember(target, name, context), visible: true };
            }
            return {
              value: extractListMember(target, name, context),
              visible: true,
            };
          }
          if (objectClasses(target) !== undefined) {
            const dispatched = await this.#invokeS3MethodIfPresentResult(
              node.operator,
              this.#baseEnvironment,
              runtimeClassNames(target),
              0,
              [
                { promise: createForcedPromise(target, environment), span: node.target.span },
                ...this.#prepareArguments(node.arguments, environment),
              ],
              context,
              true,
              undefined,
              environment,
            );
            if (dispatched !== undefined) return dispatched;
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
          if (target.type === "null") {
            let supplied = false;
            for (const argument of node.arguments) {
              const missing =
                argument.value?.kind === "UnsupportedExpression" &&
                argument.value.feature === "missing argument";
              if (argument.value === undefined || missing) continue;
              supplied = true;
              await this.#evaluateValue(argument.value, environment, context);
            }
            if (node.operator === "[[" && !supplied) {
              throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.", {
                span: node.span,
              });
            }
            return { value: R_NULL, visible: true };
          }
          if (target.type === "language") {
            const positional = node.arguments.filter((argument) => argument.name === undefined);
            if (positional.length > 1 || (node.operator === "[[" && positional.length !== 1)) {
              throw new REvaluationError(
                "NRE2204",
                "Language extraction accepts at most one subscript.",
              );
            }
            const named = node.arguments.filter((entry) => entry.name !== undefined);
            if (
              named.some((entry) => entry.name !== (node.operator === "[" ? "drop" : "exact")) ||
              named.length > 1
            ) {
              throw new REvaluationError("NRE2102", "Invalid named language subscript control.");
            }
            const argument = positional[0]?.value;
            const missing =
              argument?.kind === "UnsupportedExpression" && argument.feature === "missing argument";
            if (node.operator === "[[" && (argument === undefined || missing)) {
              throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
            }
            const index =
              argument === undefined || missing
                ? undefined
                : await this.#evaluateValue(argument, environment, context);
            const dropArgument = node.arguments.find((entry) => entry.name === "drop");
            if (dropArgument !== undefined) {
              await this.#evaluateValue(dropArgument.value, environment, context);
            }
            const exactArgument = node.arguments.find((entry) => entry.name === "exact");
            const exact =
              exactArgument === undefined
                ? true
                : exactMatchState(
                    await this.#evaluateValue(exactArgument.value, environment, context),
                    exactArgument.span,
                  );
            return {
              value:
                node.operator === "["
                  ? subsetLanguage(target, index, context)
                  : extractLanguageElement(target, index as RValue, context, exact),
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
            const namespaceEnvironment = this.#staticNamespaces.get(namespace);
            const binding =
              namespaceEnvironment === undefined
                ? undefined
                : lookupBinding(namespaceEnvironment, member);
            const internal = this.#staticNamespaceOwnsBinding(namespace, member);
            const exported =
              exports === "all"
                ? internal &&
                  !this.#builtins.some(
                    (definition) =>
                      definition.package === namespace &&
                      definition.name === member &&
                      definition.exported === false,
                  )
                : exports.has(member);
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
          const exported = runtimePackageExportNames(loaded.record).includes(member);
          const binding = loaded.namespace.bindings.get(member);
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
          return await this.#evaluatePipe(node, environment, context);
        case "ConstantExpression":
          return { value: node.value as RValue, visible: true };
        case "UnsupportedExpression":
          throw unsupported(node.feature, node.span);
        default:
          return assertNever(node);
      }
    } catch (error) {
      if (node.kind === "Identifier") {
        // A failed lookup belongs to the promise's evaluation frame, which can be global.
        const origin = this.#closureCallFrames.find((frame) => frame.environment === environment);
        this.#recordErrorCall(error, origin?.call ?? null);
      } else if (!["Program", "Block", "ConstantExpression"].includes(node.kind)) {
        this.#recordErrorCall(error, node);
      }
      throw error;
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
        await this.#assignBinding(environment, node.variable.name, value, context);
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
      updated = await this.#applyPreparedSubsetReplacement(operation, updated, context);
    }
    if (root.kind === "Identifier") {
      await this.#assignBinding(targetEnvironment as REnvironment, root.name, updated, context);
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

  async #applyPreparedSubsetReplacement(
    operation: PreparedSubsetOperation,
    replacement: RValue,
    context: EvaluationContext,
  ): Promise<RValue> {
    if (operation.operator === "$") {
      if (operation.target.type === "environment") {
        await this.#assignBinding(operation.target, operation.member, replacement, context);
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
      await this.#assignBinding(
        operation.target,
        environmentSubscriptName(operation.index),
        replacement,
        context,
      );
      return operation.target;
    }
    if (operation.target.type === "null") {
      if (replacement.type === "null") return R_NULL;
      if (operation.operator === "[[") {
        return replaceVectorElement(listValue([]), operation.index, replacement, context);
      }
      const emptyTarget =
        replacement.type === "list" || replacement.type === "pairlist"
          ? listValue([])
          : isAtomic(replacement)
            ? subsetVector(replacement, integerVector([]), context)
            : logicalVector([]);
      return replaceVectorSubset(emptyTarget, operation.index, replacement, context);
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
    const subset = constructedSubsetTarget(target);
    if (subset !== undefined) {
      const result = await this.#evaluateNode(
        {
          kind: "ReplacementExpression",
          operator: nonLocal ? "<<-" : "<-",
          target: subset,
          value: replacementNode,
          span,
        },
        environment,
        context,
      );
      return result.value;
    }
    const replacement = await this.#evaluateValue(replacementNode, environment, context);
    await this.#applyCallReplacement(
      target,
      replacement,
      environment,
      context,
      nonLocal,
      span,
      replacementNode,
    );
    return replacement;
  }

  async #applyCallReplacement(
    target: CallExpressionNode,
    replacement: RValue,
    environment: REnvironment,
    context: EvaluationContext,
    nonLocal: boolean,
    span: SourceSpan,
    sourceExpression?: AstNode,
  ): Promise<void> {
    const subset = constructedSubsetTarget(target);
    if (subset !== undefined) {
      await this.#evaluateNode(
        {
          kind: "ReplacementExpression",
          operator: nonLocal ? "<<-" : "<-",
          target: subset,
          value: embeddedValueAst(replacement, () => context.checkpoint()),
          span,
        },
        environment,
        context,
      );
      return;
    }
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
        sourceExpression,
      );
      return;
    }
    if (objectArgument?.value.kind === "CallExpression") {
      const object = await this.#evaluateValue(objectArgument.value, environment, context);
      const updated = await this.#invokeReplacementFunction(
        target,
        objectArgument,
        object,
        replacement,
        environment,
        context,
        span,
        sourceExpression,
      );
      await this.#applyCallReplacement(
        objectArgument.value,
        updated,
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
      sourceExpression,
    );
    await this.#assignBinding(targetEnvironment, objectName, updated, context);
  }

  async #applyCallReplacementToSubset(
    target: CallExpressionNode,
    objectArgument: CallExpressionNode["arguments"][number],
    replacement: RValue,
    environment: REnvironment,
    context: EvaluationContext,
    nonLocal: boolean,
    span: SourceSpan,
    sourceExpression?: AstNode,
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
      sourceExpression,
    );
    for (let offset = operations.length - 1; offset >= 0; offset -= 1) {
      const operation = await this.#prepareNestedSubsetOperation(
        (operations[offset] as PreparedSubsetOperation).target,
        path[offset] as SubsetExpressionNode,
        environment,
        context,
      );
      updated = await this.#applyPreparedSubsetReplacement(operation, updated, context);
    }
    if (root.kind === "Identifier") {
      await this.#assignBinding(targetEnvironment as REnvironment, root.name, updated, context);
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
    sourceExpression?: AstNode,
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
    // R evaluates the assigned value before invoking a replacement closure. Its
    // call frame still carries a synthetic call: the object is `*tmp*`, while
    // the value is the already evaluated result of the right-hand side. The
    // promise separately retains its source for substitute(value).
    const objectExpression: AstNode = {
      kind: "Identifier",
      name: "*tmp*",
      span: objectArgument.value.span,
    };
    const valueExpression = embeddedValueAst(replacement, () => context.checkpoint());
    const firstArgument = {
      ...(objectArgument.name === undefined ? {} : { name: objectArgument.name }),
      promise: { ...createForcedPromise(object, environment), expression: objectExpression },
      span: objectArgument.span,
    };
    const call: CallExpressionNode = {
      kind: "CallExpression",
      callee: { kind: "Identifier", name: replacementName, span: target.callee.span },
      arguments: [
        {
          ...(objectArgument.name === undefined ? {} : { name: objectArgument.name }),
          value: objectExpression,
          span: objectArgument.span,
        },
        ...target.arguments.slice(1),
        { name: "value", value: valueExpression, span },
      ],
      span,
    };
    return this.#invokeCallable(
      callable,
      [
        firstArgument,
        ...this.#prepareArguments(target.arguments.slice(1), environment),
        {
          name: "value",
          promise: {
            ...createForcedPromise(replacement, environment),
            expression: valueExpression,
            ...(sourceExpression === undefined ? {} : { sourceExpression }),
          },
          span,
        },
      ],
      context,
      call,
      environment,
    );
  }

  async #evaluateCall(
    node: CallExpressionNode,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    if (
      node.callee.kind === "Identifier" &&
      ["<-", "=", "<<-", "->", "->>"].includes(node.callee.name)
    ) {
      const operator = node.callee.name as AssignmentExpressionNode["operator"];
      if (node.arguments.length !== 2) {
        throw new REvaluationError(
          "NRE2102",
          `Assignment operator '${node.callee.name}' requires exactly two arguments.`,
          { span: node.span },
        );
      }
      const rightward = operator === "->" || operator === "->>";
      const target = node.arguments[rightward ? 1 : 0]?.value;
      const value = node.arguments[rightward ? 0 : 1]?.value;
      if (target === undefined || value === undefined) {
        throw new REvaluationError("NRE2102", "Invalid assignment call.", { span: node.span });
      }
      if (target.kind === "Identifier") {
        return this.#evaluateNode(
          {
            kind: "AssignmentExpression",
            operator,
            target,
            value,
            span: node.span,
          },
          environment,
          context,
        );
      }
      if (target.kind === "SubsetExpression" || target.kind === "CallExpression") {
        return this.#evaluateNode(
          {
            kind: "ReplacementExpression",
            operator,
            target,
            value,
            span: node.span,
          },
          environment,
          context,
        );
      }
      throw new REvaluationError("NRE2102", "Invalid left-hand side in assignment call.", {
        span: target.span,
      });
    }
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
    if (
      node.operator === "%>%" &&
      (node.right.kind !== "CallExpression" ||
        (node.right.callee.kind === "Identifier" && node.right.callee.name === "("))
    ) {
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
    while (current !== null) {
      const binding = current.bindings.get(node.name);
      if (binding !== undefined && binding.type !== "dots") {
        const value = await this.#force(binding, context);
        if (value.type === "closure" || value.type === "builtin") return value;
      }
      current = current.parent;
    }
    throw new REvaluationError("NRE2001", `could not find function "${node.name}"`, {
      span: node.span,
    });
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
    methodFrame?: S3DispatchFrame,
  ): Promise<EvaluationResult> {
    const debugStep =
      callable.type === "builtin" || callable.type === "closure"
        ? await this.#enterFunctionDebug(callable, call, context)
        : false;
    if (callable.type === "builtin") {
      try {
        let resultVisibility = callable.definition.resultVisibility ?? "visible";
        const value = await callable.definition.implementation({
          ...(methodFrame === undefined ? {} : { s3Generic: methodFrame.generic }),
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
          invokeLazy: async (target, arguments_, invocationCall) =>
            this.#invokeCallable(
              target,
              arguments_.map((argument) =>
                argument.name === undefined
                  ? { promise: argument.promise }
                  : { name: argument.name, promise: argument.promise },
              ),
              context,
              invocationCall,
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
          assignBinding: async (target, name, value) =>
            this.#assignBinding(target, name, value, context),
          signalCondition: async (classes, condition, muffleRestart) =>
            muffleRestart === undefined
              ? this.#signalCondition(classes, condition, context)
              : this.#signalMuffleable(classes, condition, muffleRestart, context),
          signalWarning: async (condition, warning) =>
            this.#signalWarning(condition, warning, context),
          raiseCondition: async (condition, message) =>
            this.#raiseCondition(condition, message, context),
          withCallingHandlers: async (handlers, evaluate) =>
            this.#withCallingHandlers(handlers, evaluate, context),
          errorBarrier: async (evaluate) => this.#errorBarrier(evaluate),
          withRestarts: async (restarts, evaluate) => this.#withRestarts(restarts, evaluate),
          computeRestarts: () => this.#computeRestarts(),
          invokeRestart: (restart, values) => this.#invokeRestart(restart, values),
          captureCondition: async (classes, evaluate) =>
            this.#captureCondition(classes, evaluate, context),
          muffleConditions: async (kind, classes, evaluate) =>
            this.#muffleConditions(kind, classes, evaluate, context),
          configureOnExit: (expression, environment, add, after) => {
            this.#configureOnExit(expression, environment, add, after);
          },
          isGlobalEnvironment: (environment) => environment === this.#globalEnvironment,
          currentEnvironment: () =>
            callerEnvironment ?? args[0]?.promise.environment ?? this.#globalEnvironment,
          parentFrame: (offset) => {
            const evaluationEnvironment =
              callerEnvironment ?? args[0]?.promise.environment ?? this.#globalEnvironment;
            let currentIndex = -1;
            for (let index = this.#closureCallFrames.length - 1; index >= 0; index -= 1) {
              if (this.#closureCallFrames[index]?.environment === evaluationEnvironment) {
                currentIndex = index;
                break;
              }
            }
            if (currentIndex < 0) currentIndex = this.#closureCallFrames.length - 1;
            const index = currentIndex - (offset - 1);
            return index >= 0
              ? (this.#closureCallFrames[index]?.callerEnvironment ?? this.#globalEnvironment)
              : this.#globalEnvironment;
          },
          currentCall: () => (call === undefined ? R_NULL : { type: "language", expression: call }),
          systemCall: (which) => this.#systemCall(which),
          systemFunction: (which) => this.#systemFunction(which),
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
          detachPackage: (entry, force) => this.#detachPackage(entry, force, context),
          unloadNamespace: (name, warnOnFailure) =>
            this.#unloadNamespace(name, warnOnFailure, context),
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
          namespaceEnvironment: (name) =>
            this.#packages.has(name)
              ? this.#packages.get(name)?.namespace
              : this.#staticNamespaces.get(name),
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
          matchCall: (expandDots, definition, call) =>
            this.#matchCurrentCall(context, expandDots, definition, call),
          callerFormalDefault: async (name) => this.#callerFormalDefault(name, context),
          define: (name, value) => {
            validateBindingName(name);
            setBinding(this.#globalEnvironment, name, value);
          },
          registerS3Method: async (generic, className, method, environment) =>
            this.#registerS3Method(generic, className, method, environment, context),
          dispatchS3: async (generic, object) => this.#dispatchS3(generic, object, context),
          dispatchS3IfPresent: async (
            generic,
            object,
            arguments_,
            includeDefault,
            argumentIndex,
            group,
            lookupEnvironment,
            defaultOnly,
          ) => {
            const result = await this.#dispatchS3IfPresentResult(
              generic,
              object,
              arguments_,
              context,
              includeDefault,
              argumentIndex,
              lookupEnvironment ??
                callerEnvironment ??
                args[0]?.promise.environment ??
                this.#globalEnvironment,
              group,
              call,
              defaultOnly,
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
      } catch (error) {
        this.#recordErrorCall(error, call);
        throw error;
      }
    }
    if (callable.type !== "closure") {
      throw new RTypeMismatchError("NRT3002", "Attempted to call a non-function value.", {
        details: { type: callable.type },
      });
    }
    return this.#invokeClosure(
      callable,
      args,
      context,
      call,
      callerEnvironment,
      debugStep,
      methodFrame,
    ).catch((error: unknown) => {
      this.#recordErrorCall(error, call);
      throw error;
    });
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

  async #captureCondition<T>(
    classes: readonly string[],
    evaluate: () => Promise<T>,
    context: EvaluationContext,
  ): Promise<
    | { readonly kind: "value"; readonly value: T }
    | { readonly kind: "condition"; readonly condition: RValue; readonly handlerIndex: number }
  > {
    const frame: ExitingConditionFrame = {
      kind: "exiting",
      target: Symbol("condition"),
      classes,
    };
    this.#conditionFrames.push(frame);
    const warningStart = context.warnings.length;
    try {
      const value = await evaluate();
      // Deliver warnings recorded outside an individual call while this frame is still active.
      await this.#signalRecordedWarnings(warningStart, undefined, context);
      return { kind: "value", value };
    } catch (error) {
      let signal = error;
      if (!(error instanceof ExitingConditionSignal)) {
        // Warnings recorded before an R-level error are delivered first, to this frame too.
        try {
          await this.#signalWarningsBeforeError(warningStart, undefined, context, error);
        } catch (delivered) {
          signal = delivered;
        }
      }
      if (!(signal instanceof ExitingConditionSignal) || signal.target !== frame.target) {
        throw signal;
      }
      return { kind: "condition", condition: signal.condition, handlerIndex: signal.handlerIndex };
    } finally {
      const index = this.#conditionFrames.indexOf(frame);
      if (index >= 0) this.#conditionFrames.splice(index, 1);
    }
  }

  async #muffleConditions<T>(
    condition: "warning" | "message",
    classes: readonly string[],
    evaluate: () => Promise<T>,
    context: EvaluationContext,
  ): Promise<T> {
    const frame: MufflingConditionFrame = { kind: "muffle", condition, classes };
    this.#conditionFrames.push(frame);
    const warningStart = context.warnings.length;
    try {
      const value = await evaluate();
      await this.#signalRecordedWarnings(warningStart, undefined, context);
      return value;
    } catch (error) {
      return this.#signalWarningsBeforeError(warningStart, undefined, context, error);
    } finally {
      const index = this.#conditionFrames.indexOf(frame);
      if (index >= 0) this.#conditionFrames.splice(index, 1);
    }
  }

  /**
   * Deliver warnings recorded before an R-level error, then rethrow it. An exiting handler that
   * consumes one of those warnings replaces the error, as the warning was signalled first.
   * Internal control signals, resource limits, and disposal never run R-level handlers.
   */
  async #signalWarningsBeforeError(
    start: number,
    node: AstNode | undefined,
    context: EvaluationContext,
    error: unknown,
  ): Promise<never> {
    if (
      error instanceof NativRError &&
      !(error instanceof RResourceLimitError) &&
      !(error instanceof RRuntimeDisposedError)
    ) {
      await this.#signalRecordedWarnings(start, node, context);
    }
    throw error;
  }

  /**
   * Signal deferred warnings recorded since `start` that have not reached the handler stack.
   * Handled warnings are removed from the deferred list; an exiting handler unwinds normally.
   */
  async #signalRecordedWarnings(
    start: number,
    node: AstNode | undefined,
    context: EvaluationContext,
  ): Promise<void> {
    if (context.warnings.length <= start) return;
    const pending = context.warnings.splice(start);
    for (const warning of pending) {
      if (context.isWarningSignalled(warning)) {
        context.warnings.push(warning);
        continue;
      }
      context.markWarningSignalled(warning);
      const condition = withClasses(
        listValue(
          [
            characterVector([warning.message]),
            node === undefined ? R_NULL : { type: "language", expression: node },
          ],
          ["message", "call"],
        ),
        [...SIMPLE_WARNING_CLASSES],
      );
      await this.#signalWarning(condition, warning, context);
    }
  }

  /**
   * Signal a warning with a muffleWarning restart, then apply options(warn): negative levels drop
   * it, 0 defers it, 1 reports it immediately, and 2 or more raise it again as an error.
   */
  async #signalWarning(
    condition: RValue,
    warning: RWarning,
    context: EvaluationContext,
  ): Promise<void> {
    const classes = objectClasses(condition) ?? [];
    if (await this.#signalMuffleable(classes, condition, "muffleWarning", context)) return;
    const stored = this.#builtinState.get(BASE_OPTIONS_STATE_KEY);
    const option: unknown = stored instanceof Map ? stored.get("warn") : undefined;
    const level =
      typeof option === "object" && option !== null && (option as RValue).type === "integer"
        ? ((option as { readonly values: ArrayLike<number> }).values[0] ?? 0)
        : 0;
    if (level < 0) return;
    if (level === 0) {
      context.warn(warning, true);
      return;
    }
    const call = condition.type === "list" ? extractListMember(condition, "call", context) : R_NULL;
    if (level >= 2) {
      const message = `(converted from warning) ${warning.message}`;
      await this.#raiseCondition(
        withClasses(listValue([characterVector([message]), call], ["message", "call"]), [
          "simpleError",
          "error",
          "condition",
        ]),
        message,
        context,
      );
    }
    let text = `Warning: ${warning.message}\n`;
    if (call.type === "language") {
      const callText = deparseDiagnosticAst(call.expression);
      const firstLine = warning.message.split("\n", 1)[0] ?? "";
      const separator = callText.length + firstLine.length > 57 ? "\n  " : " ";
      text = `Warning in ${callText} :${separator}${warning.message}\n`;
    }
    context.writeOutput({ stream: "message", text });
  }

  /** Raise an R error after offering it to the handler stack at the point where it is signalled. */
  async #raiseCondition(
    condition: RList,
    message: string,
    context: EvaluationContext,
  ): Promise<never> {
    const error = new RSignalledConditionError(message, condition);
    this.#signalledErrors.add(error);
    await this.#signalCondition(objectClasses(condition) ?? [], condition, context);
    throw error;
  }

  /** Signal with one muffle restart established; returns true when it was invoked or muffled. */
  async #signalMuffleable(
    classes: readonly string[],
    condition: RValue,
    name: "muffleWarning" | "muffleMessage",
    context: EvaluationContext,
  ): Promise<boolean> {
    const result = await this.#withRestarts(
      [{ name, handler: MUFFLE_HANDLER, description: "" }],
      () => this.#signalCondition(classes, condition, context),
    );
    return result.kind === "restart" || result.value;
  }

  async #signalCondition(
    classes: readonly string[],
    condition: RValue,
    context: EvaluationContext,
  ): Promise<boolean> {
    for (let index = this.#conditionFrames.length - 1; index >= 0; index -= 1) {
      const frame = this.#conditionFrames[index];
      if (frame === undefined) continue;
      if (frame.kind === "barrier") {
        if (classes.includes("error")) return false;
        continue;
      }
      if (frame.kind === "calling") {
        if (classes.includes(frame.className)) {
          await this.#invokeCallingHandler(index, frame.handler, condition, context);
        }
        continue;
      }
      if (frame.kind === "muffle") {
        if (
          classes.includes(frame.condition) &&
          frame.classes.some((name) => classes.includes(name))
        ) {
          return true;
        }
        continue;
      }
      const handlerIndex = frame.classes.findIndex((name) => classes.includes(name));
      if (handlerIndex < 0) continue;
      throw new ExitingConditionSignal(frame.target, handlerIndex, condition);
    }
    await this.#signalGlobalCondition(classes, condition, context);
    return false;
  }

  /** Run a calling handler with only the frames below it active, as GNU R does. */
  async #invokeCallingHandler(
    index: number,
    handler: RValue,
    condition: RValue,
    context: EvaluationContext,
  ): Promise<void> {
    const hidden = this.#conditionFrames.splice(index);
    try {
      await this.#invokeCallable(
        handler,
        [{ promise: createForcedPromise(condition, this.#globalEnvironment) }],
        context,
      );
    } finally {
      this.#conditionFrames.push(...hidden);
    }
  }

  async #withCallingHandlers<T>(
    handlers: readonly { readonly className: string; readonly handler: RValue }[],
    evaluate: () => Promise<T>,
    context: EvaluationContext,
  ): Promise<T> {
    // The first handler is innermost, so it is pushed last.
    const frames = handlers
      .map(({ className, handler }): CallingConditionFrame => ({
        kind: "calling",
        className,
        handler,
      }))
      .reverse();
    this.#conditionFrames.push(...frames);
    const warningStart = context.warnings.length;
    try {
      const value = await evaluate();
      await this.#signalRecordedWarnings(warningStart, undefined, context);
      return value;
    } catch (error) {
      let signal = error;
      try {
        await this.#signalWarningsBeforeError(warningStart, undefined, context, error);
      } catch (delivered) {
        signal = delivered;
      }
      // Errors not raised through raiseCondition() reach local handlers as they unwind here.
      if (
        signal instanceof NativRError &&
        !(signal instanceof RResourceLimitError) &&
        !(signal instanceof RRuntimeDisposedError) &&
        !this.#signalledErrors.has(signal)
      ) {
        const condition = this.#errorConditionValue(signal);
        const classes = objectClasses(condition) ?? [];
        for (let index = this.#conditionFrames.length - 1; index >= 0; index -= 1) {
          const frame = this.#conditionFrames[index];
          if (
            frame?.kind === "calling" &&
            frames.includes(frame) &&
            classes.includes(frame.className)
          ) {
            await this.#invokeCallingHandler(index, frame.handler, condition, context);
          }
        }
      }
      throw signal;
    } finally {
      for (const frame of frames) {
        const index = this.#conditionFrames.indexOf(frame);
        if (index >= 0) this.#conditionFrames.splice(index, 1);
      }
    }
  }

  async #errorBarrier<T>(evaluate: () => Promise<T>): Promise<T> {
    const frame: BarrierConditionFrame = { kind: "barrier" };
    this.#conditionFrames.push(frame);
    try {
      return await evaluate();
    } finally {
      const index = this.#conditionFrames.indexOf(frame);
      if (index >= 0) this.#conditionFrames.splice(index, 1);
    }
  }

  async #withRestarts<T>(
    restarts: readonly {
      readonly name: string;
      readonly handler: RValue;
      readonly description: string;
    }[],
    evaluate: () => Promise<T>,
  ): Promise<
    | { readonly kind: "value"; readonly value: T }
    | { readonly kind: "restart"; readonly index: number; readonly arguments: readonly RValue[] }
  > {
    const frames = restarts.map(({ name, handler, description }): RestartFrame => {
      const exit = createEnvironment(this.#emptyEnvironment);
      const restart = withClasses(
        listValue(
          [
            characterVector([name]),
            exit,
            handler,
            characterVector([description]),
            RESTART_TEST,
            R_NULL,
          ],
          ["name", "exit", "handler", "description", "test", "interactive"],
        ),
        ["restart"],
      );
      return { name, exit, restart };
    });
    // The first restart is found first, so it is pushed last.
    this.#restartFrames.push(...[...frames].reverse());
    try {
      return { kind: "value", value: await evaluate() };
    } catch (error) {
      if (error instanceof RestartSignal) {
        const index = frames.findIndex((frame) => frame.exit === error.exit);
        if (index >= 0) return { kind: "restart", index, arguments: error.arguments_ };
      }
      throw error;
    } finally {
      for (const frame of frames) {
        const index = this.#restartFrames.indexOf(frame);
        if (index >= 0) this.#restartFrames.splice(index, 1);
      }
    }
  }

  #computeRestarts(): readonly RValue[] {
    return [...this.#restartFrames.map((frame) => frame.restart).reverse(), ABORT_RESTART];
  }

  #invokeRestart(restart: RValue, values: readonly RValue[]): never {
    let frame: RestartFrame | undefined;
    if (
      restart === ABORT_RESTART ||
      (restart.type === "character" && restart.values[0] === "abort")
    ) {
      throw new RUnsupportedFeatureError("NRU6290", "Invoking the 'abort' restart is unsupported.");
    }
    if (restart.type === "list" && objectClasses(restart)?.includes("restart") === true) {
      const exit = restart.values[1];
      frame = this.#restartFrames.find((candidate) => candidate.exit === exit);
      if (frame === undefined) throw new REvaluationError("NRE2302", "restart not on stack");
    } else {
      const name =
        isAtomic(restart) &&
        restart.type !== "complex" &&
        restart.length === 1 &&
        !isMissing(restart, 0)
          ? String(restart.values[0])
          : "";
      for (let index = this.#restartFrames.length - 1; index >= 0; index -= 1) {
        if (this.#restartFrames[index]?.name === name) {
          frame = this.#restartFrames[index];
          break;
        }
      }
      if (frame === undefined)
        throw new REvaluationError("NRE2302", `no 'restart' '${name}' found`);
    }
    throw new RestartSignal(frame.exit, values);
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

  async #signalErrorCondition(error: NativRError, context: EvaluationContext): Promise<void> {
    const condition = this.#errorConditionValue(error);
    await this.#signalGlobalCondition(objectClasses(condition) ?? [], condition, context);
  }

  #errorConditionValue(error: NativRError): RValue {
    const call = errorConditionCall(error);
    return error instanceof RSignalledConditionError
      ? error.condition
      : withClasses(
          listValue(
            [
              characterVector([error.message]),
              call === undefined || call === null ? R_NULL : { type: "language", expression: call },
            ],
            ["message", "call"],
          ),
          errorConditionClasses(error),
        );
  }

  #recordErrorCall(error: unknown, call: AstNode | null | undefined): void {
    if (
      call !== undefined &&
      error instanceof NativRError &&
      !(error instanceof RSignalledConditionError) &&
      !(error instanceof RResourceLimitError) &&
      !(error instanceof RRuntimeDisposedError)
    )
      recordErrorConditionCall(error, call);
  }

  async #warnPartialArgument(
    match: PartialArgumentMatch,
    call: RValue,
    context: EvaluationContext,
  ): Promise<void> {
    if (!partialMatchWarningsEnabled(this.#builtinState)) return;
    const { condition, warning } = partialMatchWarning(match, call, () => context.checkpoint());
    await this.#signalWarning(condition, warning, context);
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
    methodFrame?: S3DispatchFrame,
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
      const frame = createEnvironment(closure.environment);
      const parameters = closure.parameters.map((parameter) => parameter.name);
      const options = { checkWork: () => context.checkpoint() };
      const result = partialMatchWarningsEnabled(this.#builtinState)
        ? await matchArgumentsWithWarnings(
            args,
            parameters,
            (match) =>
              this.#warnPartialArgument(
                match,
                call === undefined ? R_NULL : { type: "language", expression: call },
                context,
              ),
            options,
          )
        : matchArguments(args, parameters, options);
      const matched = new Map(
        [...result.matched].map(([name, argument]) => [name, argument.promise]),
      );
      for (const parameter of closure.parameters) {
        if (parameter.name === "...") continue;
        const supplied = matched.get(parameter.name);
        if (supplied !== undefined && !(supplied.expression === null && supplied.missing)) {
          setBinding(frame, parameter.name, supplied);
        } else if (parameter.defaultValue !== undefined) {
          setBinding(frame, parameter.name, createPromise(parameter.defaultValue, frame, true));
        } else {
          setBinding(frame, parameter.name, createMissingPromise(frame, parameter.name));
        }
      }
      if (closure.parameters.some((parameter) => parameter.name === "...")) {
        setBinding(frame, "...", { type: "dots", arguments: result.dots });
      }
      if (methodFrame !== undefined) {
        setBinding(frame, ".Generic", characterVector([methodFrame.generic]));
        if (methodFrame.group !== undefined)
          setBinding(frame, ".Group", characterVector([methodFrame.group]));
        setBinding(frame, ".Method", characterVector([methodFrame.methodName ?? ""]));
        const classes = characterVector(methodFrame.classes.slice(methodFrame.classIndex));
        setBinding(
          frame,
          ".Class",
          methodFrame.previousClasses === undefined
            ? classes
            : withAttribute(classes, "previous", methodFrame.previousClasses),
        );
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
          if (!(failure instanceof RResourceLimitError)) failure = error;
        }
        if (failed) {
          if (failure instanceof NativRError && !this.#errorCallTraces.has(failure)) {
            this.#errorCallTraces.set(
              failure,
              this.#closureCallFrames.flatMap((entry) =>
                entry.call === undefined ? [] : [entry.call],
              ),
            );
          }
          throw failure;
        }
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

  async #matchCurrentCall(
    context: EvaluationContext,
    expandDots: boolean,
    definition?: RValue,
    explicitCall?: RValue,
  ): Promise<RLanguage> {
    const frame = this.#closureCallFrames.at(-1);
    const sourceCall =
      explicitCall === undefined
        ? frame?.call
        : explicitCall.type === "language" && explicitCall.expression.kind === "CallExpression"
          ? explicitCall.expression
          : undefined;
    if (explicitCall !== undefined && sourceCall === undefined) {
      throw new RTypeMismatchError("NRT3214", "invalid 'call' argument");
    }
    if (sourceCall === undefined) {
      throw new REvaluationError(
        "NRE2217",
        "match.call() requires an active closure call originating from R syntax.",
      );
    }
    let parameters = frame?.closure.parameters;
    let matched = frame?.matched;
    const activeDots = frame?.environment.bindings.get("...");
    let dotsArguments = activeDots?.type === "dots" ? activeDots.arguments : [];
    if (definition !== undefined && definition.type !== "null") {
      if (definition.type === "closure") {
        parameters = definition.parameters;
      } else if (definition.type === "builtin" && definition.definition.formals !== undefined) {
        parameters = definition.definition.formals;
      } else {
        throw new RTypeMismatchError("NRT3214", "invalid 'definition' argument");
      }
    }
    if (parameters === undefined) {
      throw new RTypeMismatchError("NRT3214", "match.call(definition=) requires a function.");
    }
    if (
      explicitCall !== undefined ||
      (definition !== undefined && definition !== frame?.closure) ||
      partialMatchWarningsEnabled(this.#builtinState)
    ) {
      const callArguments: ClosureCallFrame["arguments"] =
        explicitCall === undefined
          ? (frame?.arguments ?? [])
          : sourceCall.arguments.map((argument) => ({
              ...(argument.name === undefined ? {} : { name: argument.name }),
              promise: createPromise(
                argument.value,
                frame?.callerEnvironment ?? this.#globalEnvironment,
              ),
              span: argument.span,
            }));
      // This call is observable warning metadata, independently probed through conditionCall().
      const warningCall: RLanguage = {
        type: "language",
        expression: {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "match.call", span: sourceCall.span },
          arguments: ["definition", "call", "expand.dots", "envir"].map((name) => ({
            value: { kind: "Identifier", name, span: sourceCall.span },
            span: sourceCall.span,
          })),
          span: sourceCall.span,
        },
      };
      const rematched = await matchCallDefinitionArguments(
        parameters,
        callArguments,
        () => context.checkpoint(),
        partialMatchWarningsEnabled(this.#builtinState)
          ? (match) => this.#warnPartialArgument(match, warningCall, context)
          : undefined,
      );
      matched = rematched.matched;
      dotsArguments = rematched.dots;
    }
    if (matched === undefined) {
      throw new RTypeMismatchError("NRT3214", "match.call(definition=) requires a function.");
    }
    const arguments_: CallArgument[] = [];
    for (const parameter of parameters) {
      if (parameter.name !== "...") {
        const promise = matched.get(parameter.name);
        if (
          promise === undefined ||
          (promise.expression === null && promise.missing) ||
          (promise.expression?.kind === "UnsupportedExpression" &&
            promise.expression.feature === "missing argument")
        )
          continue;
        const value = promiseCallAst(promise, sourceCall.span);
        arguments_.push({
          name: parameter.name,
          value,
          span: value.span,
        });
        continue;
      }

      if (dotsArguments.length === 0) continue;
      if (expandDots) {
        for (const argument of dotsArguments) {
          const value = promiseCallAst(argument.promise, sourceCall.span);
          arguments_.push({
            ...(argument.name === undefined ? {} : { name: argument.name }),
            value,
            span: value.span,
          });
        }
      } else {
        const entries = dotsArguments.map((argument): CallArgument => {
          const value = promiseCallAst(argument.promise, sourceCall.span);
          return {
            ...(argument.name === undefined ? {} : { name: argument.name }),
            value,
            span: value.span,
          };
        });
        const pairlistCall: CallExpressionNode = {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "pairlist", span: parameter.span },
          arguments: entries,
          span: parameter.span,
        };
        const names = entries.some((entry) => entry.name !== undefined)
          ? entries.map((entry) => entry.name ?? "")
          : undefined;
        arguments_.push({
          name: "...",
          value: {
            kind: "ConstantExpression",
            value: pairlistValue(
              entries.map((entry) => quoteLanguageNode(entry.value)),
              names,
            ),
            display: pairlistCall,
            span: parameter.span,
          },
          span: parameter.span,
        });
      }
    }
    return {
      type: "language",
      expression: {
        ...sourceCall,
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
      throw new REvaluationError("NRE2219", "argument is missing, with no default");
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

  #systemFunction(which: number): RClosure | typeof R_NULL {
    const frameCount = this.#closureCallFrames.length;
    const position = which === 0 ? frameCount : which > 0 ? which : frameCount + which;
    if (position === 0) return R_NULL;
    if (position < 0 || position > frameCount) {
      throw new REvaluationError("NRE2218", "Not that many frames on the stack.");
    }
    return this.#closureCallFrames[position - 1]?.closure ?? R_NULL;
  }

  #s3RegistrationKey(environment: REnvironment, generic: string, className: string): string {
    return `${environment.id}:${generic}.${className}`;
  }

  #s3TopEnvironment(environment: REnvironment): REnvironment {
    for (
      let current: REnvironment | null = environment;
      current !== null;
      current = current.parent
    ) {
      if (current === this.#globalEnvironment || current === this.#baseEnvironment) return current;
      if (this.#namespaceNames.has(current)) return current;
      const nameAttribute = current.attributes.get("name");
      const name =
        this.#searchEnvironmentNames.get(current.id) ??
        (nameAttribute?.type === "character" ? nameAttribute.values[0] : undefined);
      if (name?.startsWith("package:")) return current;
    }
    return this.#globalEnvironment;
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
    if (genericPackage === undefined && PRIMITIVE_S3_GENERICS.has(generic)) {
      this.#setRegisteredS3Method(
        this.#s3RegistrationKey(this.#baseEnvironment, generic, className),
        method,
      );
      return;
    }
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
      callFrame?.call,
      callFrame?.callerEnvironment,
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
        const namespace = this.#staticNamespaces.get(name);
        if (namespace === undefined)
          throw new REvaluationError("NRE2221", "Missing static namespace.");
        const loaded: {
          name: string;
          version: string;
          namespace: REnvironment;
          record: RuntimePackageRecord;
        } = {
          name,
          version: "4.6.1",
          namespace,
          record: {
            definition: {
              name,
              version: "4.6.1",
              descriptionFields: corePackageDescriptionFields(name),
              resourceTextEncoding: "utf8",
              dependencies: [],
              imports: [],
              exports: await this.#namespaceExports(name, context),
              exportPatterns: [],
              methodExports: [],
              s3Methods: [],
              programs: [],
              textResources: [],
              resources: [],
            },
            namespace,
            exportNames: undefined,
            loading: false,
            attached: this.#searchPath.includes(`package:${name}`),
          },
        };
        if (attach && !loaded.record.attached) {
          this.#searchPath.splice(1, 0, `package:${name}`);
          this.#attachSearchEnvironment(name);
          loaded.record.attached = true;
          try {
            await this.#invokeUserPackageHooks(loaded.record, "attach", context);
          } catch (error) {
            this.#removeSearchEnvironment(`package:${name}`);
            throw error;
          }
        }
        return loaded;
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
        const importsEnvironment = createEnvironment(this.#baseNamespace, true);
        const importOrigins = new Map<string, string>();
        for (const import_ of record.definition.imports) {
          context.checkpoint();
          const dependency = await this.#loadPackage(import_.package, false, context, libraryPaths);
          const exportedNames = await this.#namespaceExports(import_.package, context);
          const names = import_.names ?? exportedNames;
          context.allocate(names.length);
          for (const [index, importedName] of names.entries()) {
            if (import_.names === undefined && import_.except?.includes(importedName)) continue;
            const binding = exportedNames.includes(importedName)
              ? lookupBinding(dependency.namespace, importedName)
              : undefined;
            if (binding === undefined) {
              throw new REvaluationError(
                "NRE2223",
                `Package '${name}' imports missing binding '${importedName}' from '${import_.package}'.`,
              );
            }
            const localName = import_.localNames?.[index] ?? importedName;
            const previous = importsEnvironment.bindings.get(localName);
            if (previous !== undefined && localName === importedName) {
              const identical = this.#baseEnvironment.bindings.get("identical");
              if (identical === undefined)
                throw new REvaluationError("NRE2223", "Missing identical primitive.");
              const equal = await this.#invokeCallable(
                await this.#force(identical, context),
                [
                  {
                    promise: createForcedPromise(
                      await this.#force(previous, context),
                      this.#globalEnvironment,
                    ),
                  },
                  {
                    promise: createForcedPromise(
                      await this.#force(binding, context),
                      this.#globalEnvironment,
                    ),
                  },
                ],
                context,
              );
              if (equal.type !== "logical" || equal.values[0] !== 1)
                await this.#packageLifecycleWarning(
                  `replacing previous import '${importOrigins.get(localName)}::${localName}' by '${import_.package}::${localName}' when loading '${name}'`,
                  context,
                );
            }
            setBinding(importsEnvironment, localName, binding);
            importOrigins.set(localName, import_.package);
          }
        }
        const namespace = createEnvironment(importsEnvironment, true);
        this.#namespaceNames.set(namespace, name);
        record.namespace = namespace;
        const registeredMethodIndexes = new Set<number>();
        const registerAvailableS3Methods = async (requireAll: boolean): Promise<void> => {
          for (const [index, method] of record.definition.s3Methods.entries()) {
            if (registeredMethodIndexes.has(index)) continue;
            const binding = lookupBinding(namespace, method.method);
            if (binding === undefined) {
              if (requireAll) {
                throw new REvaluationError(
                  "NRE2225",
                  `Package '${name}' registers missing S3 method '${method.method}'.`,
                );
              }
              continue;
            }
            if (
              method.genericPackage === undefined &&
              !PRIMITIVE_S3_GENERICS.has(method.generic) &&
              lookupBinding(namespace, method.generic) === undefined
            ) {
              if (requireAll) {
                throw new REvaluationError("NRE2001", `object '${method.generic}' not found`);
              }
              continue;
            }
            await this.#registerS3Method(
              method.generic,
              method.class,
              binding,
              namespace,
              context,
              method.genericPackage,
            );
            registeredMethodIndexes.add(index);
          }
        };
        await this.#loadPackageSysdata(record, namespace, context);
        const hadSourceDirectory = this.#builtinState.has(
          PACKAGE_SOURCE_EVALUATION_DIRECTORY_STATE_KEY,
        );
        const previousSourceDirectory = this.#builtinState.get(
          PACKAGE_SOURCE_EVALUATION_DIRECTORY_STATE_KEY,
        );
        this.#builtinState.set(
          PACKAGE_SOURCE_EVALUATION_DIRECTORY_STATE_KEY,
          `${NATIVR_PACKAGE_LIBRARY_PATH}/${encodeURIComponent(name)}/${NATIVR_PACKAGE_SOURCE_RESOURCE_ROOT}`,
        );
        try {
          for (const program of record.definition.programs) {
            for (const expression of program.body) {
              await this.#evaluateNode(expression, namespace, context);
              await registerAvailableS3Methods(false);
            }
          }
        } finally {
          if (hadSourceDirectory) {
            this.#builtinState.set(
              PACKAGE_SOURCE_EVALUATION_DIRECTORY_STATE_KEY,
              previousSourceDirectory,
            );
          } else {
            this.#builtinState.delete(PACKAGE_SOURCE_EVALUATION_DIRECTORY_STATE_KEY);
          }
        }
        record.exportNames = resolveRuntimePackageExportNames(record, namespace);
        for (const exportedName of record.definition.exports) {
          if (namespace.bindings.get(exportedName) === undefined) {
            throw new REvaluationError(
              "NRE2224",
              `Package '${name}' exports missing binding '${exportedName}'.`,
            );
          }
        }
        await registerAvailableS3Methods(true);
        await this.#invokePackageHook(record, ".onLoad", context);
      } catch (error) {
        for (const [key, previous] of replacedMethods) {
          if (previous === undefined) this.#registeredS3Methods.delete(key);
          else this.#registeredS3Methods.set(key, previous);
        }
        record.namespace?.bindings.clear();
        record.namespace = undefined;
        record.exportNames = undefined;
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
      await this.#invokeUserPackageHooks(record, "onLoad", context);
    }
    const namespace = record.namespace;
    if (namespace === undefined) {
      throw new REvaluationError("NRE2226", `Package '${name}' did not create a namespace.`);
    }
    if (attach && !record.attached) {
      const exportNames = runtimePackageExportNames(record);
      context.allocate(exportNames.length);
      this.#searchPath = [
        this.#searchPath[0] ?? ".GlobalEnv",
        `package:${name}`,
        ...this.#searchPath.slice(1).filter((entry) => entry !== `package:${name}`),
      ];
      this.#attachSearchEnvironment(name);
      record.attached = true;
      try {
        await this.#invokePackageHook(record, ".onAttach", context);
        await this.#invokeUserPackageHooks(record, "attach", context);
      } catch (error) {
        // The namespace remains loaded, but a failed attachment must not stay searchable.
        // Preserve other packages attached by the hook while restoring any masked exports.
        record.attached = false;
        const entry = `package:${name}`;
        this.#searchPath = this.#searchPath.filter((item) => item !== entry);
        const removedEnvironment = this.#searchEnvironments.get(entry);
        if (removedEnvironment !== undefined) {
          if (this.#globalEnvironment.parent === removedEnvironment)
            this.#globalEnvironment.parent = removedEnvironment.parent;
          for (const environment of this.#searchEnvironments.values()) {
            if (environment.parent === removedEnvironment)
              environment.parent = removedEnvironment.parent;
          }
          this.#searchEnvironments.delete(entry);
        }
        throw error;
      }
    }
    return { name, version: record.definition.version, namespace, record };
  }

  async #invokeUserPackageHooks(
    record: RuntimePackageRecord,
    event: string,
    context: EvaluationContext,
  ): Promise<void> {
    const registry = this.#builtinState.get(USER_HOOKS_STATE_KEY);
    if (!(registry instanceof Map)) return;
    const hooks = registry.get("UserHook::" + record.definition.name + "::" + event) as
      RValue[] | undefined;
    if (!hooks?.length) return;
    context.allocate(hooks.length);
    const point = { offset: 0, line: 1, column: 1 };
    const span = { start: point, end: point };
    const call: CallExpressionNode = {
      kind: "CallExpression",
      callee: { kind: "Identifier", name: "fun", span },
      arguments: ["pkgname", "pkgpath"].map((name) => ({
        value: { kind: "Identifier" as const, name, span },
        span,
      })),
      span,
    };
    const arguments_ = [
      record.definition.name,
      (this.#packages.has(record.definition.name)
        ? NATIVR_PACKAGE_LIBRARY_PATH
        : NATIVR_SYSTEM_LIBRARY_PATH) +
        "/" +
        encodeURIComponent(record.definition.name),
    ].map((value) => ({
      promise: createForcedPromise(characterVector([value]), this.#globalEnvironment),
    }));
    // setHook replaces the stored array, so this reference is the event's stable snapshot.
    for (const hook of hooks) {
      context.checkpoint();
      try {
        await this.#invokeCallable(hook, arguments_, context, call, this.#globalEnvironment);
      } catch (error) {
        if (
          !(error instanceof NativRError) ||
          error instanceof RResourceLimitError ||
          error instanceof RUnsupportedFeatureError
        )
          throw error;
        context.writeOutput({ stream: "stderr", text: this.#formatTopLevelError(error, context) });
      }
    }
  }

  async #packageLifecycleWarning(message: string, context: EvaluationContext): Promise<void> {
    const warning = this.#baseEnvironment.bindings.get("warning");
    if (warning === undefined) throw new REvaluationError("NRE2280", message);
    await this.#invokeCallable(
      await this.#force(warning, context),
      [
        { promise: createForcedPromise(characterVector([message]), this.#globalEnvironment) },
        {
          name: "call.",
          promise: createForcedPromise(logicalVector([false]), this.#globalEnvironment),
        },
      ],
      context,
    );
  }

  async #detachPackage(entry: string, force: boolean, context: EvaluationContext): Promise<void> {
    const name = entry.startsWith("package:") ? entry.slice(8) : "";
    const record =
      this.#packages.get(name) ??
      (REGISTERED_NAMESPACE_EXPORTS.has(name)
        ? (await this.#loadPackage(name, false, context)).record
        : undefined);
    if (!record?.attached) {
      throw new RUnsupportedFeatureError("NRU6310", "detach() requires an attached package.");
    }
    const dependents = [...this.#packages.values()].filter(
      (candidate) =>
        candidate.attached &&
        candidate.definition.name !== name &&
        (
          candidate.definition.descriptionFields.find((field) => field.name === "Depends")?.value ??
          ""
        )
          .split(",")
          .some((dependency) => dependency.trim().split(/[\s(]/u)[0] === name),
    );
    if (!force && dependents.length > 0) {
      throw new REvaluationError(
        "NRE2280",
        `package '${name}' is required by '${dependents.map((item) => item.definition.name).join("', '")}' so will not be detached`,
      );
    }
    if (force && dependents.length > 0)
      await this.#packageLifecycleWarning(
        `package '${name}' is required by '${dependents.map((item) => item.definition.name).join("', '")}', which may no longer work correctly`,
        context,
      );
    await this.#invokeUserPackageHooks(record, "detach", context);
    try {
      await this.#invokePackageHook(record, ".onDetach", context);
    } catch (error) {
      if (
        !(error instanceof NativRError) ||
        error instanceof RResourceLimitError ||
        error instanceof RUnsupportedFeatureError
      )
        throw error;
      await this.#packageLifecycleWarning(
        `.onDetach failed in detach() for '${name}', details:\n  error: ${error.message}`,
        context,
      );
    }
    record.attached = false;
    this.#removeSearchEnvironment(entry);
  }

  #removeSearchEnvironment(entry: string): void {
    this.#searchPath = this.#searchPath.filter((item) => item !== entry);
    const removed = this.#searchEnvironments.get(entry);
    if (removed !== undefined) {
      if (this.#globalEnvironment.parent === removed)
        this.#globalEnvironment.parent = removed.parent;
      for (const environment of this.#searchEnvironments.values()) {
        if (environment.parent === removed) environment.parent = removed.parent;
      }
      this.#searchEnvironments.delete(entry);
      removed.parent = this.#baseEnvironment;
    }
  }

  async #unloadNamespace(
    name: string,
    warnOnFailure: boolean,
    context: EvaluationContext,
  ): Promise<void> {
    const record = this.#packages.get(name);
    if (record === undefined) {
      if (REGISTERED_NAMESPACE_EXPORTS.has(name))
        throw new RUnsupportedFeatureError(
          "NRU6311",
          "Unloading static core namespaces is not supported.",
        );
      return;
    }
    if (record.namespace === undefined) return;
    if (record.loading)
      throw new RUnsupportedFeatureError(
        "NRU6311",
        "Cannot unload a namespace while it is being loaded.",
      );
    if (record.attached) await this.#detachPackage(`package:${name}`, false, context);
    const importers = [...this.#packages.values()].filter(
      (candidate) =>
        candidate.namespace !== undefined &&
        candidate.definition.name !== name &&
        candidate.definition.imports.some((dependency) => dependency.package === name),
    );
    if (importers.length > 0) {
      const message = `namespace '${name}' is imported by '${importers.map((item) => item.definition.name).join("', '")}' so cannot be unloaded`;
      if (warnOnFailure) {
        await this.#packageLifecycleWarning(
          `'${name}' namespace cannot be unloaded:\n  ${message}`,
          context,
        );
        return;
      }
      throw new REvaluationError("NRE2281", message);
    }
    await this.#invokeUserPackageHooks(record, "onUnload", context);
    try {
      await this.#invokePackageHook(record, ".onUnload", context);
    } catch (error) {
      if (
        !(error instanceof NativRError) ||
        error instanceof RResourceLimitError ||
        error instanceof RUnsupportedFeatureError
      )
        throw error;
      await this.#packageLifecycleWarning(
        `.onUnload failed in unloadNamespace() for '${name}', details:\n  error: ${error.message}`,
        context,
      );
    }
    // Unregister the namespace without invalidating escaped closures, environments or S3 methods.
    record.namespace = undefined;
    record.exportNames = undefined;
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
      baseNamespace: this.#baseNamespace,
      empty: this.#emptyEnvironment,
    });
    for (const entry of workspace.entries) {
      context.checkpoint();
      setBinding(namespace, entry.name, entry.value);
    }
  }

  async #invokePackageHook(
    record: RuntimePackageRecord,
    hookName: ".onLoad" | ".onAttach" | ".onDetach" | ".onUnload",
    context: EvaluationContext,
  ): Promise<void> {
    const namespace = record.namespace;
    const binding = namespace?.bindings.get(hookName);
    if (binding === undefined) return;
    const callable = await this.#force(binding, context);
    await this.#invokeCallable(
      callable,
      (hookName === ".onDetach" || hookName === ".onUnload"
        ? [NATIVR_PACKAGE_LIBRARY_PATH + "/" + encodeURIComponent(record.definition.name)]
        : [NATIVR_PACKAGE_LIBRARY_PATH, record.definition.name]
      ).map((argument) => ({
        promise: createForcedPromise(characterVector([argument]), this.#globalEnvironment),
      })),
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
    const exportNames = runtimePackageExportNames(record);
    context.allocate(exportNames.length);
    return exportNames;
  }

  #namespaceName(environment: REnvironment): string | undefined {
    return this.#namespaceNames.get(environment);
  }

  async #namespaceBinding(
    name: string,
    bindingName: string,
    context: EvaluationContext,
  ): Promise<RValue | undefined> {
    const staticExports = this.#staticNamespaceExports(name);
    if (staticExports !== undefined) {
      if (!this.#staticNamespaceOwnsBinding(name, bindingName)) return undefined;
      const namespaceEnvironment = this.#staticNamespaces.get(name);
      const binding =
        namespaceEnvironment === undefined
          ? undefined
          : lookupBinding(namespaceEnvironment, bindingName);
      if (binding === undefined) return undefined;
      return this.#force(binding, context);
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
    return this.#force(binding, context);
  }

  #installedPackageVersion(name: string, libraryPaths?: readonly string[]): string | undefined {
    const effectivePaths = libraryPaths ?? this.#libraryPaths;
    if (this.#staticNamespaceExports(name) !== undefined) {
      return effectivePaths.includes(NATIVR_SYSTEM_LIBRARY_PATH) ? "4.6.1" : undefined;
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
      const resources = this.#systemPackageResources.get(name);
      if (
        normalizedPath.length > 0 &&
        ![...(resources?.keys() ?? [])].some(
          (path) => path === normalizedPath || path.startsWith(`${normalizedPath}/`),
        )
      ) {
        return undefined;
      }
      const root = `nativr://package/${encodeURIComponent(name)}`;
      return normalizedPath.length === 0
        ? root
        : `${root}/${normalizedPath
            .split("/")
            .map((part) => encodeURIComponent(part))
            .join("/")}`;
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
    if (this.#staticNamespaceExports(name) !== undefined) {
      return Object.freeze(
        [...(this.#systemPackageResources.get(name)?.keys() ?? [])]
          .filter(
            (path) =>
              normalizedPrefix.length === 0 ||
              path === normalizedPrefix ||
              path.startsWith(`${normalizedPrefix}/`),
          )
          .sort(),
      );
    }
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
    const systemResource = this.#systemPackageResources
      .get(resolved.name)
      ?.get(resolved.resourcePath);
    if (systemResource !== undefined) {
      return { encoding: "text", data: systemResource, textEncoding: "utf8" };
    }
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
      if (current === this.#globalEnvironment) {
        return undefined;
      }
      const namespaceName = this.#namespaceNames.get(current);
      if (namespaceName !== undefined) return namespaceName;
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
      .filter((definition) => definition.metadata.package === name && definition.exported !== false)
      .map((definition) => definition.name);
    if (name === "base") names.push(...BASE_NAMESPACE_CONSTANTS);
    if (name === "grDevices") names.push("colours");
    if (name === "graphics") names.push("plot");
    return [...new Set(names)];
  }

  #staticNamespaceExports(name: string): ReadonlySet<string> | "all" | undefined {
    if (this.#packages.has(name)) return undefined;
    return REGISTERED_NAMESPACE_EXPORTS.get(name);
  }

  #staticNamespaceOwnsBinding(name: string, bindingName: string): boolean {
    return (
      this.#builtins.some(
        (definition) => definition.package === name && definition.name === bindingName,
      ) ||
      (name === "base" && BASE_NAMESPACE_CONSTANTS.has(bindingName)) ||
      (name === "grDevices" && bindingName === "colours") ||
      (name === "graphics" && bindingName === "plot")
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
    const staticExports = this.#staticNamespaceExports(name);
    const source =
      staticExports === undefined ? record?.namespace : this.#staticNamespaces.get(name);
    const exportNames =
      staticExports === undefined
        ? record === undefined
          ? []
          : runtimePackageExportNames(record)
        : this.#registeredNamespaceExportNames(name, staticExports);
    if (source !== undefined) {
      for (const exportedName of exportNames) {
        const binding = lookupBinding(source, exportedName);
        if (binding !== undefined) setBinding(environment, exportedName, binding);
      }
    }
    const entry = `package:${name}`;
    this.#searchEnvironments.set(entry, environment);
    this.#searchEnvironmentNames.set(environment.id, entry);
    this.#globalEnvironment.parent = environment;
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
    const namespaceName = this.#namespaceNames.get(environment);
    if (namespaceName !== undefined) return namespaceName;
    for (const [name, namespace] of this.#staticNamespaces) {
      if (name !== "base" && namespace.parent === environment) return `imports:${name}`;
    }
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
        const source =
          staticExports === undefined ? record?.namespace : this.#staticNamespaces.get(name);
        const exports =
          staticExports === undefined
            ? record === undefined
              ? []
              : runtimePackageExportNames(record)
            : this.#registeredNamespaceExportNames(name, staticExports);
        if (source !== undefined) {
          for (const exportedName of exports) {
            const binding = lookupBinding(source, exportedName);
            if (binding !== undefined) setBinding(environment, exportedName, binding);
          }
        }
      }
      this.#searchEnvironments.set(entry, environment);
      this.#searchEnvironmentNames.set(environment.id, entry === "package:base" ? "base" : entry);
      parent = environment;
    }
    this.#globalEnvironment.parent = parent;
  }

  async #dispatchS3IfPresentResult(
    generic: string,
    object: RValue,
    arguments_: readonly BuiltinCallArgument[],
    context: EvaluationContext,
    includeDefault = true,
    argumentIndex = 0,
    callerEnvironment?: REnvironment,
    group?: string,
    call?: CallExpressionNode,
    defaultOnly = false,
  ): Promise<EvaluationResult | undefined> {
    if (generic.length === 0) {
      throw new REvaluationError("NRE2213", "UseMethod() generic name must be non-empty.");
    }
    const methodArguments: ClosureCallFrame["arguments"] =
      arguments_.length === 0 && argumentIndex >= 0
        ? [
            {
              promise: createForcedPromise(object, this.#globalEnvironment),
            },
          ]
        : arguments_.map((argument, index) =>
            index === argumentIndex
              ? {
                  ...argument,
                  promise: createForcedPromise(object, this.#globalEnvironment),
                }
              : argument,
          );
    return this.#invokeS3MethodIfPresentResult(
      generic,
      this.#baseEnvironment,
      defaultOnly ? [] : runtimeClassNames(object),
      0,
      methodArguments,
      context,
      includeDefault,
      call,
      callerEnvironment,
      group,
    );
  }

  async #dispatchOperatorS3(
    operator: string,
    operands: readonly RValue[],
    environment: REnvironment,
    spans: readonly SourceSpan[],
    context: EvaluationContext,
  ): Promise<EvaluationResult | undefined> {
    const arguments_: ClosureCallFrame["arguments"] = operands.map((operand, index) => {
      const span = spans[index];
      return span === undefined
        ? { promise: createForcedPromise(operand, environment) }
        : { promise: createForcedPromise(operand, environment), span };
    });
    for (const operand of operands) {
      if (objectClasses(operand) === undefined) continue;
      for (const generic of [operator, "Ops"]) {
        const dispatched = await this.#invokeS3MethodIfPresentResult(
          generic,
          this.#baseEnvironment,
          runtimeClassNames(operand),
          0,
          arguments_,
          context,
          false,
          undefined,
          environment,
        );
        if (dispatched !== undefined) return dispatched;
      }
    }
    return undefined;
  }

  async #nextS3Method(generic: string | undefined, context: EvaluationContext): Promise<RValue> {
    const frame = this.#s3DispatchFrames.at(-1);
    if (frame === undefined) {
      throw new REvaluationError("NRE2215", "NextMethod() used outside S3 method dispatch.");
    }
    const repeatedGroupMember =
      Boolean(frame.group) && frame.methodName?.startsWith(`${frame.generic}.`);
    const previous = characterVector(frame.classes.slice(frame.classIndex));
    return this.#invokeS3Method(
      generic ?? frame.generic,
      frame.genericEnvironment,
      frame.classes,
      Math.min(frame.classIndex + (repeatedGroupMember ? 0 : 1), frame.classes.length),
      frame.arguments,
      context,
      frame.call,
      frame.callerEnvironment,
      true,
      frame.group,
      frame.previousClasses === undefined
        ? previous
        : withAttribute(previous, "previous", frame.previousClasses),
    );
  }

  async #invokeS3Method(
    generic: string,
    genericEnvironment: REnvironment,
    classes: readonly string[],
    startIndex: number,
    arguments_: ClosureCallFrame["arguments"],
    context: EvaluationContext,
    call?: CallExpressionNode,
    callerEnvironment?: REnvironment,
    allowPrimitiveFallback = false,
    group?: string,
    previousClasses?: RValue,
  ): Promise<RValue> {
    const result = await this.#invokeS3MethodIfPresent(
      generic,
      genericEnvironment,
      classes,
      startIndex,
      arguments_,
      context,
      true,
      call,
      callerEnvironment,
      group,
      true,
      previousClasses,
    );
    if (result !== undefined) return result;
    if (allowPrimitiveFallback) {
      const definition = this.#builtins.find(
        (entry) => entry.package === "base" && entry.name === generic,
      );
      if (definition?.s3DefaultImplementation !== undefined) {
        return this.#invokeCallable(
          {
            type: "builtin",
            definition: { ...definition, implementation: definition.s3DefaultImplementation },
          },
          arguments_,
          context,
          call,
          callerEnvironment,
        );
      }
    }
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
    call?: CallExpressionNode,
    callerEnvironment?: REnvironment,
    group?: string,
    preserveGroup = false,
    previousClasses?: RValue,
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
        call,
        callerEnvironment,
        group,
        preserveGroup,
        previousClasses,
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
    call?: CallExpressionNode,
    callerEnvironment?: REnvironment,
    group?: string,
    preserveGroup = false,
    previousClasses?: RValue,
  ): Promise<EvaluationResult | undefined> {
    const end = includeDefault ? classes.length : classes.length - 1;
    for (let index = startIndex; index <= end; index += 1) {
      const className = classes[index];
      let methodName = className === undefined ? `${generic}.default` : `${generic}.${className}`;
      // Registration belongs to the defining frame; dispatch consults its top environment.
      let callable = await this.#findS3Method(
        methodName,
        this.#s3RegistrationKey(
          this.#s3TopEnvironment(genericEnvironment),
          generic,
          className ?? "default",
        ),
        callerEnvironment ?? this.#globalEnvironment,
        context,
      );
      let selectedGroup = preserveGroup ? group : group === undefined ? undefined : "";
      if (callable === undefined && group && className !== undefined) {
        methodName = `${group}.${className}`;
        callable = await this.#findS3Method(
          methodName,
          this.#s3RegistrationKey(this.#s3TopEnvironment(genericEnvironment), group, className),
          callerEnvironment ?? this.#globalEnvironment,
          context,
        );
        selectedGroup = group;
      }
      if (callable === undefined) continue;
      const methodCall =
        call === undefined
          ? undefined
          : ({
              ...call,
              callee: { kind: "Identifier", name: methodName, span: call.callee.span },
            } satisfies CallExpressionNode);
      const dispatchFrame: S3DispatchFrame = {
        generic,
        methodName,
        ...(selectedGroup === undefined ? {} : { group: selectedGroup }),
        ...(previousClasses === undefined ? {} : { previousClasses }),
        genericEnvironment,
        classes,
        classIndex: index,
        arguments: arguments_,
        ...(methodCall === undefined ? {} : { call: methodCall }),
        ...(callerEnvironment === undefined ? {} : { callerEnvironment }),
      };
      this.#s3DispatchFrames.push(dispatchFrame);
      try {
        return await this.#invokeCallableResult(
          callable,
          arguments_,
          context,
          methodCall,
          callerEnvironment,
          dispatchFrame,
        );
      } finally {
        this.#s3DispatchFrames.pop();
      }
    }
    return undefined;
  }

  async #findS3Method(
    methodName: string,
    registrationKey: string,
    callerEnvironment: REnvironment,
    context: EvaluationContext,
  ): Promise<RClosure | RBuiltin | undefined> {
    const callableBinding = async (binding: RBinding | undefined) => {
      if (binding === undefined) return undefined;
      const value = await this.#force(binding, context);
      return value.type === "closure" || value.type === "builtin" ? value : undefined;
    };

    const topEnvironment = this.#s3TopEnvironment(callerEnvironment);
    let current: REnvironment | null = callerEnvironment;
    while (current !== null) {
      const callable = await callableBinding(current.bindings.get(methodName));
      if (callable !== undefined) return callable;
      const atTopEnvironment = current === topEnvironment;
      current = current.parent;
      if (atTopEnvironment) break;
    }

    // Registered methods follow the caller's top environment, before its parents.
    const registered = await callableBinding(this.#registeredS3Methods.get(registrationKey));
    if (registered !== undefined) return registered;
    while (current !== null) {
      const callable = await callableBinding(current.bindings.get(methodName));
      if (callable !== undefined) return callable;
      current = current.parent;
    }
    return undefined;
  }

  async #force(binding: RBinding, context: EvaluationContext): Promise<RValue> {
    if (binding.type === "active-binding") {
      return this.#invokeCallable(binding.callable, [], context);
    }
    if (binding.type !== "promise") return binding;
    return forcePromise(binding, async (expression, environment) =>
      this.#evaluateValue(expression, environment, context),
    );
  }

  async #assignBinding(
    environment: REnvironment,
    name: string,
    value: RValue,
    context: EvaluationContext,
  ): Promise<void> {
    const existing = environment.bindings.get(name);
    if (existing?.type !== "active-binding") {
      setBinding(environment, name, value);
      return;
    }
    if (environment.lockedBindings.has(name)) {
      throw new REvaluationError("NRE2012", `Cannot change locked binding '${name}'.`);
    }
    await this.#invokeCallable(
      existing.callable,
      [{ promise: createForcedPromise(value, environment) }],
      context,
      undefined,
      environment,
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
      const error = new REvaluationError("NRE2006", missingArgumentMessage(promise));
      const origin = this.#closureCallFrames.find(
        (frame) => frame.environment === promise.environment,
      );
      this.#recordErrorCall(error, origin?.call ?? this.#closureCallFrames.at(-1)?.call);
      throw error;
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
        if (
          current === this.#baseEnvironment ||
          current === this.#baseNamespace ||
          current === this.#emptyEnvironment
        ) {
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
        this.#staticNamespaces,
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

  #installBuiltinS3Methods(): void {
    for (const definition of this.#builtins) {
      const method = definition.s3Method;
      if (method === undefined) continue;
      const binding = this.#staticNamespaces.get(definition.package)?.bindings.get(definition.name);
      if (binding !== undefined)
        this.#registeredS3Methods.set(
          this.#s3RegistrationKey(this.#baseEnvironment, method.generic, method.className),
          binding,
        );
    }
  }
  #installBuiltins(): void {
    this.#installGlobalEnvironmentBinding();
    for (const definition of this.#builtins) {
      const builtin: RBuiltin = { type: "builtin", definition };
      const environment =
        definition.package === "base"
          ? this.#baseEnvironment
          : this.#staticNamespaces.get(definition.package);
      if (environment !== undefined) setBinding(environment, definition.name, builtin);
    }
    this.#installBuiltinS3Methods();
    const graphicsDeviceNamespace = this.#staticNamespaces.get("grDevices");
    const colors = graphicsDeviceNamespace?.bindings.get("colors");
    if (colors !== undefined && graphicsDeviceNamespace !== undefined)
      setBinding(graphicsDeviceNamespace, "colours", colors);
    for (const [name, exports] of REGISTERED_NAMESPACE_EXPORTS) {
      if (CORE_R_PACKAGE_NAMES.has(name) || exports === "all") continue;
      const namespace = this.#staticNamespaces.get(name);
      if (namespace === undefined) continue;
      for (const member of exports) {
        const binding = this.#baseEnvironment.bindings.get(member);
        if (binding !== undefined) namespace.bindings.set(member, binding);
      }
    }
    const listObjects = this.#baseEnvironment.bindings.get("ls");
    if (listObjects !== undefined) setBinding(this.#baseEnvironment, "objects", listObjects);
    setBinding(this.#baseEnvironment, "pi", doubleVector([Math.PI]));
    setBinding(this.#baseEnvironment, "T", logicalVector([1]));
    setBinding(this.#baseEnvironment, "F", logicalVector([0]));
    setBinding(
      this.#baseEnvironment,
      "letters",
      characterVector(Array.from({ length: 26 }, (_, index) => String.fromCharCode(97 + index))),
    );
    setBinding(
      this.#baseEnvironment,
      "LETTERS",
      characterVector(Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))),
    );
    setBinding(this.#baseEnvironment, ".Machine", machineConstants());
    setBinding(this.#baseEnvironment, ".Platform", platformConstants());
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

  #installGlobalEnvironmentBinding(): void {
    // Session reset replaces the global environment, including this locked base binding.
    this.#baseEnvironment.bindings.set(".GlobalEnv", this.#globalEnvironment);
    this.#baseEnvironment.lockedBindings.add(".GlobalEnv");
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

function platformConstants(): RValue {
  const entries = [
    ["OS.type", "unix"],
    ["file.sep", "/"],
    ["dynlib.ext", ".wasm"],
    ["GUI", "NativR"],
    ["endian", "little"],
    ["pkgType", "source"],
    ["path.sep", ":"],
    ["r_arch", "wasm32"],
  ] as const;
  return listValue(
    entries.map(([, value]) => characterVector([value])),
    entries.map(([name]) => name),
  );
}

function constructedSubsetTarget(target: CallExpressionNode): SubsetExpressionNode | undefined {
  if (target.callee.kind !== "Identifier") return undefined;
  const operator = target.callee.name;
  if (operator !== "[" && operator !== "[[" && operator !== "$") return undefined;
  const object = target.arguments[0];
  if (object === undefined) {
    throw new REvaluationError(
      "NRE2102",
      `Replacement operator '${operator}' requires an object.`,
      {
        span: target.span,
      },
    );
  }
  return {
    kind: "SubsetExpression",
    operator,
    target: object.value,
    arguments: target.arguments.slice(1),
    span: target.span,
  };
}

async function matchCallDefinitionArguments(
  parameters: RClosure["parameters"],
  arguments_: ClosureCallFrame["arguments"],
  checkWork: () => void,
  onPartialMatch?: (match: PartialArgumentMatch) => Promise<void>,
): Promise<{ readonly matched: Map<string, RPromise>; readonly dots: BuiltinCallArgument[] }> {
  const names = parameters.map((parameter) => parameter.name);
  const result =
    onPartialMatch === undefined
      ? matchArguments(arguments_, names, { checkWork })
      : await matchArgumentsWithWarnings(arguments_, names, onPartialMatch, { checkWork });
  return {
    matched: new Map([...result.matched].map(([name, argument]) => [name, argument.promise])),
    dots: result.dots,
  };
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
