import { assertNever } from "@nativr/ast";
import type {
  AssignmentExpressionNode,
  AstNode,
  CallArgument,
  CallExpressionNode,
  FunctionParameter,
  ProgramNode,
  SourceSpan,
  SubsetExpressionNode,
} from "@nativr/ast";

import { EvaluationContext, DEFAULT_RUNTIME_LIMITS } from "./context.js";
import {
  deparseAst,
  languageEntries,
  languageFromEntries,
  languageValueAst,
  quoteLanguageAst,
} from "./language.js";
import { censusRuntimeMemory } from "./memory.js";
import { isCanonicalBase64 } from "./base64.js";
import { normalizePosixCharacterClasses } from "./regex.js";
import {
  createEnvironment,
  createForcedPromise,
  createMissingPromise,
  createPromise,
  forcePromise,
  lookupBinding,
  setBinding,
  setParentEnvironment,
} from "./environment.js";
import {
  NativRError,
  RConditionError,
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
  NATIVR_PACKAGE_SOURCE_RESOURCE_ROOT,
  NATIVR_SYSTEM_LIBRARY_PATH,
  PACKAGE_SOURCE_EVALUATION_DIRECTORY_STATE_KEY,
  SOURCE_REFERENCE_CONTEXT_STATE_KEY,
  S4_SLOT_REPLACEMENT_VALIDATOR_STATE_KEY,
  R_NULL,
  pairlistValue,
  vectorDimensions,
  vectorNames,
  withClasses,
  withAttribute,
  withNames,
  DYNAMIC_CALLING_HANDLERS_STATE_KEY,
  EXITING_HANDLER_STACK_STATE_KEY,
  ExitingHandlerJump,
  GLOBAL_CALLING_HANDLERS_STATE_KEY,
  RESTART_FRAME_COUNTER_STATE_KEY,
  RESTART_STACK_STATE_KEY,
  RestartJump,
  runtimeOutputRouter,
  rVersionValue,
} from "./values.js";

const SYNTHETIC_SOURCE_SPAN = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
} as const;

function evaluatorSourceReference(span: SourceSpan, sourceFile: REnvironment) {
  const firstColumn = span.start.column;
  const lastColumn = Math.max(1, span.end.column - 1);
  let reference = integerVector([
    span.start.line,
    firstColumn,
    span.end.line,
    lastColumn,
    firstColumn,
    lastColumn,
    span.start.line,
    span.end.line,
  ]);
  reference = withAttribute(reference, "srcfile", sourceFile);
  return withClasses(reference, ["srcref"]);
}

function mutableAtomicVector(value: RValue): boolean {
  return (
    value.type === "logical" ||
    value.type === "integer" ||
    value.type === "double" ||
    value.type === "complex" ||
    value.type === "raw"
  );
}
import {
  extractListMember,
  extractVectorElement,
  replaceCoordinateMatrix,
  replaceDimensions,
  replaceExpressionElement,
  replaceExpressionSubset,
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
  RFormula,
  RDataViewEvent,
  RLanguage,
  RList,
  RNativeCallRequest,
  RNativeModuleDefinition,
  RGraphicsEvent,
  RIntegerVector,
  ROutput,
  RPairlist,
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
  ExitingConditionHandlerFrame,
  RestartFrame,
  RValue,
  S4SlotReplacementValidator,
  RVector,
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
  /** Browser-owned resources and eagerly loaded data exported by bundled core packages. */
  readonly staticPackages?: readonly RuntimeStaticPackageDefinition[];
  /** Immutable non-callable values installed into browser-owned core namespaces. */
  readonly builtinBindings?: readonly RuntimeBuiltinBinding[];
  /** Immutable browser-owned text files exposed below the deterministic runtime root. */
  readonly runtimeTextResources?: readonly RuntimePackageTextResource[];
  /** Positive session identity supplied by the embedding facade for Sys.getpid(). */
  readonly sessionProcessId?: number;
  /** Recreate evaluator-owned builtin state at construction and reset. */
  readonly initializeBuiltinState?: (state: Map<string, unknown>) => void;
  /** Install base-environment data whose lifetime must track evaluator construction and reset. */
  readonly initializeBaseEnvironment?: (
    environment: REnvironment,
    state: Map<string, unknown>,
  ) => void;
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
  /** Undefined imports the dependency's complete exported surface; empty imports no bindings. */
  readonly names?: readonly string[];
  /** S4 method names whose defining namespace must be loaded before this package is evaluated. */
  readonly methodNames?: readonly string[];
}

/** One package requirement retained from DESCRIPTION. */
export interface RuntimePackageDependency {
  readonly package: string;
  /** DESCRIPTION relationship; only Depends packages join the search path on attachment. */
  readonly kind?: "Depends" | "Imports";
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

/** One browser-owned core-package resource set composed into the static R namespaces. */
export interface RuntimeStaticPackageDefinition {
  readonly name: string;
  readonly exports: readonly string[];
  readonly autoloadData: readonly string[];
  readonly resourceTextEncoding: "utf8" | "latin1";
  readonly textResources: readonly RuntimePackageTextResource[];
  readonly resources: readonly RuntimePackageResource[];
}

/** One immutable non-callable value installed into a browser-owned core namespace. */
export interface RuntimeBuiltinBinding {
  readonly package: string;
  readonly name: string;
  readonly value: RValue;
  readonly compatibility: "api" | "shape" | "numeric" | "behavioral";
}

function validateStaticPackageDefinition(definition: RuntimeStaticPackageDefinition): void {
  const paths = new Set<string>();
  const exports = new Set<string>();
  for (const name of definition.exports) {
    if (name.length === 0 || exports.has(name)) {
      throw new REvaluationError(
        "NRE2254",
        `Static core package '${definition.name}' has invalid exports.`,
      );
    }
    exports.add(name);
  }
  for (const name of definition.autoloadData) {
    if (name.length === 0) {
      throw new REvaluationError(
        "NRE2254",
        `Static core package '${definition.name}' has an invalid autoload data resource name.`,
      );
    }
  }
  for (const resource of [...definition.textResources, ...definition.resources]) {
    const parts = resource.path.split("/");
    if (
      resource.path.length === 0 ||
      resource.path.startsWith("/") ||
      resource.path.endsWith("/") ||
      resource.path.includes("\\") ||
      parts.some((part) => part.length === 0 || part === "." || part === "..") ||
      paths.has(resource.path)
    ) {
      throw new REvaluationError(
        "NRE2254",
        `Static core package '${definition.name}' has invalid resource path '${resource.path}'.`,
      );
    }
    paths.add(resource.path);
  }
  for (const resource of definition.resources) {
    if (!isCanonicalBase64(resource.data)) {
      throw new REvaluationError(
        "NRE2254",
        `Static core package '${definition.name}' resource '${resource.path}' is not canonical base64.`,
      );
    }
  }
}

function validateRuntimeTextResources(
  resources: readonly RuntimePackageTextResource[],
): ReadonlyMap<string, RuntimePackageTextResource> {
  const validated = new Map<string, RuntimePackageTextResource>();
  for (const resource of resources) {
    const parts = resource.path.split("/");
    if (
      resource.path.length === 0 ||
      resource.path.startsWith("/") ||
      resource.path.endsWith("/") ||
      resource.path.includes("\\") ||
      parts.some((part) => part.length === 0 || part === "." || part === "..") ||
      validated.has(resource.path)
    ) {
      throw new REvaluationError(
        "NRE2254",
        `The runtime has invalid text resource path '${resource.path}'.`,
      );
    }
    validated.set(resource.path, resource);
  }
  return validated;
}

/** Parser-independent package input accepted by the runtime. */
export interface RuntimePackageDefinition {
  readonly name: string;
  readonly version: string;
  /** Whether installed data sets are exposed through memoized package-data promises. */
  readonly lazyData?: boolean;
  readonly descriptionFields: readonly {
    readonly name: string;
    readonly value: string;
  }[];
  readonly resourceTextEncoding: "utf8" | "latin1";
  readonly dependencies: readonly RuntimePackageDependency[];
  readonly imports: readonly RuntimePackageImport[];
  readonly exports: readonly string[];
  /** POSIX-ERE-compatible exportPattern() declarations evaluated after local bindings load. */
  readonly exportPatterns: readonly string[];
  /** S4 class names declared by exportClasses(); exported as their .__C__ metadata bindings. */
  readonly classExports: readonly string[];
  /** S4 method names declared by exportMethods(); they need not be ordinary namespace bindings. */
  readonly methodExports: readonly string[];
  readonly s3Methods: readonly RuntimeS3Method[];
  readonly programs: readonly ProgramNode[];
  readonly textResources: readonly RuntimePackageTextResource[];
  readonly resources: readonly RuntimePackageResource[];
  /** Public LazyData object names and the source data-resource basenames that create them. */
  readonly datasets?: readonly {
    readonly name: string;
    readonly resource: string;
  }[];
}

interface RuntimePackageRecord {
  readonly definition: RuntimePackageDefinition;
  namespace: REnvironment | undefined;
  dataEnvironment: REnvironment | undefined;
  exportNames: readonly string[] | undefined;
  loading: boolean;
  readonly loadingData: Set<string>;
  attached: boolean;
}

interface DeferredS3MethodRegistration {
  readonly ownerPackage: string;
  readonly genericPackage: string;
  readonly generic: string;
  readonly className: string;
  readonly method: RBinding;
}

const PACKAGE_DATA_RESOURCE = /^data\/([^/]+)\.(?:r|rdata|rda|tab|txt|csv)(?:\.gz)?$/iu;

function runtimePackageDatasets(
  record: RuntimePackageRecord,
): readonly { readonly name: string; readonly resource: string }[] {
  const datasets = new Map<string, { readonly name: string; readonly resource: string }>();
  const explicitlyMappedResources = new Set<string>();
  for (const dataset of record.definition.datasets ?? []) {
    datasets.set(dataset.name, dataset);
    explicitlyMappedResources.add(dataset.resource);
  }
  for (const resource of record.definition.resources) {
    const name = PACKAGE_DATA_RESOURCE.exec(resource.path)?.[1];
    if (
      name !== undefined &&
      name.length > 0 &&
      !explicitlyMappedResources.has(name) &&
      !datasets.has(name)
    ) {
      datasets.set(name, Object.freeze({ name, resource: name }));
    }
  }
  return Object.freeze(
    [...datasets.values()].sort((left, right) => left.name.localeCompare(right.name)),
  );
}

function runtimePackageExportNames(record: RuntimePackageRecord): readonly string[] {
  return (
    record.exportNames ??
    Object.freeze([
      ...new Set([
        ...record.definition.exports,
        ...record.definition.classExports.map((name) => `.__C__${name}`),
        ...record.definition.methodExports,
      ]),
    ])
  );
}

function runtimePackageExportBinding(
  record: RuntimePackageRecord,
  name: string,
): RBinding | undefined {
  const namespace = record.namespace;
  if (namespace === undefined) return undefined;
  // An ordinary export may intentionally re-export an imported binding.
  // exportMethods() is metadata and must not accidentally expose an inherited
  // Base generic when the package has no ordinary binding of that name.
  return record.definition.exports.includes(name)
    ? lookupBinding(namespace, name)
    : namespace.bindings.get(name);
}

function resolveRuntimePackageExportNames(
  record: RuntimePackageRecord,
  namespace: REnvironment,
): readonly string[] {
  const names = new Set([
    ...record.definition.exports,
    ...record.definition.classExports.map((name) => `.__C__${name}`),
    ...record.definition.methodExports,
  ]);
  for (const pattern of record.definition.exportPatterns) {
    let matcher: RegExp;
    try {
      matcher = new RegExp(normalizePosixCharacterClasses(pattern), "u");
    } catch (error) {
      throw new REvaluationError(
        "NRE2230",
        `Package '${record.definition.name}' NAMESPACE has invalid exportPattern '${pattern}'.`,
        { cause: error },
      );
    }
    let exportsClassMetadata = false;
    for (const name of namespace.bindings.keys()) {
      matcher.lastIndex = 0;
      if (matcher.test(name)) names.add(name);
      if (name.startsWith(".__C__")) {
        matcher.lastIndex = 0;
        if (matcher.test(name.slice(".__C__".length))) {
          names.add(name);
          exportsClassMetadata = true;
        }
      } else if (name.startsWith(".__T__")) {
        const separator = name.lastIndexOf(":");
        const genericName = name.slice(".__T__".length, separator);
        matcher.lastIndex = 0;
        if (
          separator > ".__T__".length &&
          namespace.bindings.has(genericName) &&
          matcher.test(genericName)
        ) {
          names.add(name);
        }
      }
    }
    if (exportsClassMetadata) {
      for (const name of [
        ".__T__$:base",
        ".__T__$<-:base",
        ".__T__[:base",
        ".__T__[<-:base",
        ".__T__[[<-:base",
      ]) {
        if (namespace.bindings.has(name)) names.add(name);
      }
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

interface RegisteredEnvironmentFinalizer {
  readonly environment: REnvironment;
  readonly finalizer: RClosure;
  readonly onExit: boolean;
}

interface FunctionControlFrame {
  readonly kind: "function";
  readonly target: symbol;
  environment?: REnvironment;
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
  /** Explicit override for synthetic evaluation frames such as eval()/evalq(). */
  readonly nargs?: number;
  readonly call?: CallExpressionNode;
}

interface S3DispatchFrame {
  readonly generic: string;
  readonly dispatchGeneric: string;
  readonly group: string;
  readonly methodNames: readonly string[];
  readonly genericEnvironment: REnvironment;
  readonly methodLookupEnvironment: REnvironment;
  readonly classes: readonly string[];
  readonly classIndex: number;
  readonly arguments: ClosureCallFrame["arguments"];
}

type PreparedSubsetOperation =
  | {
      readonly operator: "@";
      readonly target: RValue;
      readonly member: string;
    }
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
    }
  | {
      readonly operator: "dimensions";
      readonly target: RVector;
      readonly indices: readonly (RValue | undefined)[];
      readonly drop: boolean;
      readonly elementReplacement: boolean;
    }
  | {
      readonly operator: "coordinates";
      readonly target: RVector;
      readonly index: RValue;
    };

const REGISTERED_NAMESPACE_EXPORTS = new Map<string, ReadonlySet<string> | "all">([
  ["base", "all"],
  [
    "stats",
    new Set([
      ".checkMFClasses",
      "aov",
      "anova",
      "ave",
      "coef",
      "coefficients",
      "complete.cases",
      "confint",
      "contrasts",
      "contr.helmert",
      "contr.sum",
      "contr.treatment",
      "cor",
      "cor.test",
      "cor.test.default",
      "chisq.test",
      "cov",
      "cov2cor",
      "cutree",
      "delete.response",
      "drop.terms",
      "ecdf",
      "density",
      "density.default",
      "D",
      "deriv",
      "deviance",
      "dbeta",
      "dbinom",
      "dpois",
      "dcauchy",
      "dexp",
      "dchisq",
      "dgamma",
      "dnorm",
      "dummy.coef",
      "dt",
      "ar",
      "rgeom",
      "arima0",
      "arima.sim",
      "family",
      "ftable",
      "interaction.plot",
      "is.empty.model",
      "factanal",
      "gaussian",
      "binomial",
      "biplot",
      "bw.nrd0",
      "quasibinomial",
      "qbeta",
      "poisson",
      "poly",
      "plot.ecdf",
      "plot.stepfun",
      "plot.ts",
      "pbeta",
      "printCoefmat",
      "quasipoisson",
      "Gamma",
      "fitted",
      "fitted.values",
      "as.formula",
      "approx",
      "approxfun",
      "spline",
      "smooth.spline",
      "SSfol",
      "supsmu",
      "formula",
      "getCall",
      "getInitial",
      "glm",
      "glm.fit",
      "hatvalues",
      "median",
      "lsfit",
      "lm",
      "lm.fit",
      "lm.influence",
      "loess",
      "loess.control",
      "logLik",
      "glm.control",
      "loadings",
      "lowess",
      "ksmooth",
      "mad",
      "make.link",
      "makepredictcall",
      "model.frame",
      "model.matrix",
      "model.offset",
      "model.response",
      "model.weights",
      "na.contiguous",
      "na.exclude",
      "na.fail",
      "na.omit",
      "na.pass",
      "napredict",
      "naresid",
      "nobs",
      "nls",
      "nls.control",
      "nlm",
      "nlminb",
      "optim",
      "optimise",
      "optimize",
      "offset",
      "integrate",
      "is.mts",
      "is.ts",
      "uniroot",
      "ppoints",
      "pgamma",
      "pexp",
      "plogis",
      "pnorm",
      "pcauchy",
      "pchisq",
      "phyper",
      "pf",
      "predict",
      "profile",
      "prcomp",
      "quantile",
      "qbinom",
      "qcauchy",
      "qchisq",
      "qf",
      "qgamma",
      "qexp",
      "qlogis",
      "qnorm",
      "qqline",
      "qqnorm",
      "qqplot",
      "rbeta",
      "rbinom",
      "rmultinom",
      "rcauchy",
      "rchisq",
      "rexp",
      "rgamma",
      "rlnorm",
      "rlogis",
      "rweibull",
      "rnorm",
      "rpois",
      "resid",
      "residuals",
      "rt",
      "runmed",
      "runif",
      "sd",
      "set.seed",
      "setNames",
      "splinefun",
      "symnum",
      "as.ts",
      "cycle",
      "deltat",
      "embed",
      "filter",
      "frequency",
      "ts",
      "ts.plot",
      "t.test",
      "t.test.default",
      "stepfun",
      "terms",
      "terms.formula",
      "TukeyHSD",
      "xtabs",
      "update",
      "update.formula",
      "var",
      "varimax",
      "vcov",
      "df.residual",
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
      "callGeneric",
      "callNextMethod",
      "cbind2",
      "formalArgs",
      "functionBody",
      "extends",
      "getClass",
      "getClasses",
      "getDataPart",
      "hasArg",
      "is",
      "isClass",
      "isGeneric",
      "initialize",
      "new",
      "prototype",
      "Quote",
      "representation",
      "rbind2",
      "signature",
      "setAs",
      "setClass",
      "setClassUnion",
      "setDataPart",
      "setGeneric",
      "setMethod",
      "setReplaceMethod",
      "setOldClass",
      "setRefClass",
      "setValidity",
      "show",
      "showClass",
      "slot",
      "slotNames",
      "slot<-",
      "validObject",
    ]),
  ],
  [
    "grDevices",
    new Set([
      "as.graphicsAnnot",
      "as.raster",
      "as.raster.array",
      "as.raster.character",
      "as.raster.logical",
      "as.raster.matrix",
      "as.raster.numeric",
      "as.raster.raw",
      "adjustcolor",
      "axisTicks",
      "boxplot.stats",
      "cairo_pdf",
      "col2rgb",
      "colorConverter",
      "colorRamp",
      "colorRampPalette",
      "colorspaces",
      "contourLines",
      "convertColor",
      "colors",
      "colours",
      "cm.colors",
      "dev.control",
      "dev.flush",
      "dev.hold",
      "dev.cur",
      "dev.interactive",
      "dev.list",
      "dev.new",
      "dev.next",
      "dev.off",
      "dev.prev",
      "dev.set",
      "dev.size",
      "devAskNewPage",
      "gray",
      "gray.colors",
      "grey",
      "grey.colors",
      "graphics.off",
      "grSoftVersion",
      "heat.colors",
      "hcl",
      "hsv",
      "is.raster",
      "jpeg",
      "nclass.FD",
      "nclass.Sturges",
      "nclass.scott",
      "n2mfrow",
      "palette",
      "pdf",
      "pdf.options",
      "png",
      "postscript",
      "recordPlot",
      "rainbow",
      "replayPlot",
      "rgb",
      "rgb2hsv",
      "svg",
      "terrain.colors",
      "tiff",
      "topo.colors",
      "trans3d",
      "xy.coords",
      "xyz.coords",
    ]),
  ],
  [
    "graphics",
    new Set([
      "abline",
      "arrows",
      "axTicks",
      "axis",
      "axis.Date",
      "axis.POSIXct",
      "barplot",
      "barplot.default",
      "box",
      "boxplot",
      "clip",
      "coplot",
      "curve",
      "frame",
      "filled.contour",
      "grid",
      "hist",
      "hist.default",
      "identify",
      "image",
      "image.default",
      "legend",
      "layout",
      "layout.show",
      "lines",
      "lines.default",
      "locator",
      "matplot",
      "mtext",
      "pairs",
      "par",
      "persp",
      "pie",
      "plot",
      "plot.default",
      "plot.function",
      "points",
      "polygon",
      "plot.new",
      "plot.window",
      "plot.xy",
      "rasterImage",
      "rect",
      "rug",
      "segments",
      "strheight",
      "stripchart",
      "strwidth",
      "symbols",
      "text",
      "title",
      "xinch",
      "xyinch",
      "yinch",
    ]),
  ],
  [
    "utils",
    new Set([
      ".DollarNames",
      "apropos",
      "aspell",
      "argsAnywhere",
      "assignInMyNamespace",
      "assignInNamespace",
      "as.person",
      "as.roman",
      "available.packages",
      "browseVignettes",
      "browseURL",
      "capture.output",
      "citation",
      "combn",
      "compareVersion",
      "contrib.url",
      "count.fields",
      "data",
      "demo",
      "download.file",
      "example",
      "flush.console",
      "file_test",
      "findMatches",
      "formatUL",
      "getAnywhere",
      "getS3method",
      "getTxtProgressBar",
      "glob2rx",
      "getFromNamespace",
      "getParseData",
      "globalVariables",
      "head",
      "head.matrix",
      "help",
      "install.packages",
      "installed.packages",
      "modifyList",
      "object.size",
      "old.packages",
      "person",
      "packageName",
      "packageDescription",
      "package.skeleton",
      "packageVersion",
      "read.csv",
      "read.csv2",
      "read.delim",
      "read.delim2",
      "read.table",
      "rc.settings",
      "sessionInfo",
      "str",
      "tail",
      "tail.matrix",
      "tar",
      "timestamp",
      "toLatex",
      "setTxtProgressBar",
      "txtProgressBar",
      "type.convert",
      "type.convert.data.frame",
      "type.convert.default",
      "type.convert.list",
      "update.packages",
      "URLdecode",
      "vignette",
      "View",
      "write.csv",
      "write.csv2",
      "write.table",
    ]),
  ],
  ["datasets", new Set()],
  ["stats4", new Set()],
  ["compiler", new Set(["compile"])],
  [
    "parallel",
    new Set([
      "clusterApply",
      "clusterApplyLB",
      "clusterCall",
      "clusterEvalQ",
      "clusterExport",
      "detectCores",
      "getDefaultCluster",
      "makeCluster",
      "makePSOCKcluster",
      "mclapply",
      "nextRNGStream",
      "nextRNGSubStream",
      "parLapply",
      "parLapplyLB",
      "splitIndices",
      "setDefaultCluster",
      "stopCluster",
    ]),
  ],
  ["tools", new Set(["Rcmd", "assertError", "assertWarning", "file_ext", "md5sum"])],
  [
    "grid",
    new Set([
      "convertHeight",
      "convertWidth",
      "current.transform",
      "current.viewport",
      "downViewport",
      "gpar",
      "get.gpar",
      "gList",
      "grid.draw",
      "grid.newpage",
      "grid.lines",
      "grid.points",
      "grid.polygon",
      "grid.rect",
      "grid.segments",
      "grid.text",
      "grobHeight",
      "grobWidth",
      "makeContent",
      "makeContent.default",
      "makeContext",
      "makeContext.default",
      "linesGrob",
      "popViewport",
      "pointsGrob",
      "polygonGrob",
      "pushViewport",
      "rectGrob",
      "segmentsGrob",
      "upViewport",
      "vpPath",
      "textGrob",
      "unit",
      "viewport",
    ]),
  ],
  ["R6", new Set(["R6Class"])],
  ["vctrs", new Set(["new_class", "new_vctr"])],
  ["tibble", new Set(["as_tibble", "tibble", "tribble"])],
]);

const CORE_NAMESPACE_FULL_IMPORT_INTERNALS = new Map<string, readonly string[]>([
  ["methods", Object.freeze(["asS4"])],
]);
const BASE_NAMESPACE_CONSTANTS = new Set([
  "pi",
  "letters",
  "LETTERS",
  "month.abb",
  "month.name",
  "T",
  "F",
  ".GlobalEnv",
  ".BaseNamespaceEnv",
  ".Machine",
  ".Platform",
  ".leap.seconds",
  ".LC.categories",
  ".Library",
  ".Library.site",
  ".knownS3Generics",
  ".S3PrimitiveGenerics",
  ".sys.timezone",
]);

export function coreBuiltinPackageName(declaredPackage: string, bindingName: string): string {
  if (declaredPackage !== "base") return declaredPackage;
  let owner: string | undefined;
  for (const [name, exports] of REGISTERED_NAMESPACE_EXPORTS) {
    if (name === "base" || exports === "all" || !exports.has(bindingName)) continue;
    if (owner !== undefined) return "base";
    owner = name;
  }
  return owner ?? "base";
}

const PRIMITIVE_S3_GENERICS = new Set([
  "$",
  "[",
  "[[",
  "$<-",
  "[<-",
  "[[<-",
  "Ops",
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
const IMPLICIT_S3_GROUP_GENERICS = new Set(["Math", "Ops", "Summary", "Complex", "matrixOps"]);
const CORE_R_PACKAGE_NAMES = new Set([
  "base",
  "stats",
  "graphics",
  "grDevices",
  "utils",
  "datasets",
  "methods",
  "stats4",
  "compiler",
  "parallel",
  "tools",
]);

const NATIVR_TARGET_R_VERSION = "4.6.1";
const NATIVR_TARGET_RELEASE_TIMESTAMP = "2026-06-24 00:00:00 UTC";

function installedPackageBuildTimestamp(
  fields: readonly { readonly name: string; readonly value: string }[],
): string {
  const values = new Map(fields.map((field) => [field.name, field.value]));
  for (const name of ["Packaged", "Date/Publication"] as const) {
    const value = values.get(name)?.trim();
    const timestamp = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC)(?:;|$)/u.exec(value ?? "")?.[1];
    if (timestamp !== undefined) return timestamp;
  }
  const date = /^(\d{4}-\d{2}-\d{2})$/u.exec(values.get("Date")?.trim() ?? "")?.[1];
  return date === undefined ? NATIVR_TARGET_RELEASE_TIMESTAMP : `${date} 00:00:00 UTC`;
}

function installedPureRDescriptionFields(
  fields: readonly { readonly name: string; readonly value: string }[],
): readonly { readonly name: string; readonly value: string }[] {
  if (fields.some((field) => field.name === "Built")) return fields;
  return Object.freeze([
    ...fields,
    Object.freeze({
      name: "Built",
      value: `R ${NATIVR_TARGET_R_VERSION}; ; ${installedPackageBuildTimestamp(fields)}; browser`,
    }),
  ]);
}

function corePackageDescriptionFields(
  name: string,
): readonly { readonly name: string; readonly value: string }[] {
  return Object.freeze([
    Object.freeze({ name: "Package", value: name }),
    Object.freeze({ name: "Version", value: "4.6.1" }),
    ...(CORE_R_PACKAGE_NAMES.has(name)
      ? [
          Object.freeze({
            name: "Priority",
            value: "base",
          }),
        ]
      : []),
    Object.freeze({
      name: "Built",
      value: `R ${NATIVR_TARGET_R_VERSION}; wasm32-unknown-browser; ${NATIVR_TARGET_RELEASE_TIMESTAMP}; browser`,
    }),
  ]);
}

const CORE_PACKAGE_METADATA_PATHS = Object.freeze(["DESCRIPTION", "NAMESPACE"]);

function corePackageMetadataText(
  name: string,
  path: string,
  exports_: readonly string[],
): string | undefined {
  if (path === "DESCRIPTION") {
    return `${corePackageDescriptionFields(name)
      .map((field) => `${field.name}: ${field.value}`)
      .join("\n")}\n`;
  }
  if (path === "NAMESPACE") {
    return `${exports_.map((binding) => `export(${JSON.stringify(binding)})`).join("\n")}\n`;
  }
  return undefined;
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
  readonly #initializeBaseEnvironment: EvaluatorOptions["initializeBaseEnvironment"];
  readonly #readline: EvaluatorOptions["readline"];
  readonly #urlRequest: EvaluatorOptions["urlRequest"];
  readonly #socketRequest: EvaluatorOptions["socketRequest"];
  readonly #systemCommand: EvaluatorOptions["systemCommand"];
  readonly #nativeModules: readonly RNativeModuleDefinition[];
  readonly #nativeCall: EvaluatorOptions["nativeCall"];
  readonly #sessionProcessId: number;
  #emptyEnvironment: REnvironment;
  #baseEnvironment: REnvironment;
  readonly #baseNamespaceEnvironment: REnvironment;
  #attachedPackagesEnvironment: REnvironment;
  #globalEnvironment: REnvironment;
  readonly #controlFrames: ControlFrame[] = [];
  readonly #closureCallFrames: ClosureCallFrame[] = [];
  readonly #s3DispatchFrames: S3DispatchFrame[] = [];
  #s3DispatchSuppressionDepth = 0;
  readonly #builtinState = new Map<string, unknown>();
  readonly #activeGlobalCallingHandlers = new Set<RValue>();
  readonly #activeExitingHandlerFrames = new Set<number>();
  readonly #packages = new Map<string, RuntimePackageRecord>();
  readonly #builtinPackageNamespaces = new Map<string, REnvironment>();
  readonly #staticPackages = new Map<
    string,
    { readonly definition: RuntimeStaticPackageDefinition; readonly namespace: REnvironment }
  >();
  readonly #runtimeTextResources: ReadonlyMap<string, RuntimePackageTextResource>;
  readonly #registeredS3Methods = new Map<string, RBinding>();
  readonly #deferredS3Methods = new Map<string, DeferredS3MethodRegistration[]>();
  readonly #environmentFinalizers: RegisteredEnvironmentFinalizer[] = [];
  readonly #s3RegistrationTransactions: Map<string, RBinding | undefined>[] = [];
  readonly #mutableVectorOwners = new WeakMap<
    RValue,
    { readonly environment: REnvironment; readonly name: string }
  >();
  #searchPath = [...DEFAULT_SEARCH_PATH];
  #libraryPaths = [...DEFAULT_LIBRARY_PATHS];
  readonly #searchEnvironments = new Map<string, REnvironment>();
  readonly #searchEnvironmentNames = new Map<number, string>();
  readonly #userSearchEnvironments = new Map<string, REnvironment>();
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
    this.#initializeBaseEnvironment = options.initializeBaseEnvironment;
    this.#readline = options.readline;
    this.#urlRequest = options.urlRequest;
    this.#socketRequest = options.socketRequest;
    this.#systemCommand = options.systemCommand;
    this.#nativeModules = options.nativeModules ?? [];
    this.#nativeCall = options.nativeCall;
    this.#runtimeTextResources = validateRuntimeTextResources(options.runtimeTextResources ?? []);
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
    this.#baseNamespaceEnvironment = createEnvironment(this.#globalEnvironment, true);
    for (const definition of this.#builtins) {
      const packageName = definition.package;
      if (packageName !== "base" && !this.#builtinPackageNamespaces.has(packageName)) {
        this.#builtinPackageNamespaces.set(
          packageName,
          createEnvironment(this.#baseNamespaceEnvironment, true),
        );
      }
    }
    this.#installBuiltins();
    for (const binding of options.builtinBindings ?? []) {
      const environment =
        binding.package === "base"
          ? this.#baseEnvironment
          : this.#builtinPackageNamespaces.get(binding.package);
      if (
        environment === undefined ||
        binding.name.length === 0 ||
        environment.bindings.has(binding.name)
      ) {
        throw new REvaluationError(
          "NRE2254",
          `Core binding '${binding.package}::${binding.name}' is not uniquely registered.`,
        );
      }
      setBinding(environment, binding.name, binding.value);
    }
    this.#initializeBaseEnvironment?.(this.#baseEnvironment, this.#builtinState);
    this.#installBuiltinS3Methods();
    this.#syncBaseNamespaceBindings();
    for (const definition of options.staticPackages ?? []) {
      if (
        !REGISTERED_NAMESPACE_EXPORTS.has(definition.name) ||
        definition.name === "base" ||
        this.#staticPackages.has(definition.name)
      ) {
        throw new REvaluationError(
          "NRE2254",
          `Static core package '${definition.name}' is not uniquely registered.`,
        );
      }
      validateStaticPackageDefinition(definition);
      this.#staticPackages.set(definition.name, {
        definition,
        namespace:
          this.#builtinPackageNamespaces.get(definition.name) ??
          createEnvironment(this.#baseNamespaceEnvironment, true),
      });
    }
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
        dataEnvironment: undefined,
        exportNames: undefined,
        loading: false,
        loadingData: new Set(),
        attached: false,
      });
    }
    this.#rebuildAttachedSearchBindings();
  }

  /** Materialize declared core-package lazy data before exposing the session. */
  public async initialize(): Promise<void> {
    this.#ensureActive();
    if (this.#parseSource === undefined) {
      if (
        [...this.#staticPackages.values()].some(({ definition }) => definition.autoloadData.length)
      ) {
        throw new REvaluationError("NRE2255", "Static package data requires a source parser.");
      }
      return;
    }
    for (const { definition } of this.#staticPackages.values()) {
      if (definition.autoloadData.length === 0) continue;
      for (const name of definition.autoloadData) {
        const source = `data(list = ${JSON.stringify(name)}, package = ${JSON.stringify(
          definition.name,
        )}, envir = asNamespace(${JSON.stringify(definition.name)}))`;
        const context = new EvaluationContext(DEFAULT_RUNTIME_LIMITS, { cancelled: false }, () =>
          runtimeOutputRouter(this.#builtinState),
        );
        await this.#evaluateNode(this.#parseSource(source), this.#globalEnvironment, context);
      }
    }
    this.#rebuildAttachedSearchBindings();
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
        warnings: context.warnings.map(({ condition: _condition, ...warning }) => warning),
        output: [...context.output],
        dataViews: [...context.dataViews],
        browseRequests: [...context.browseRequests],
        graphics: [...context.graphics],
        elapsedMs: Date.now() - start,
      };
    } catch (error) {
      if (error instanceof NativRError && !(error instanceof RResourceLimitError)) {
        const condition =
          error instanceof RConditionError
            ? error.condition
            : withClasses(
                listValue([characterVector([error.message]), R_NULL], ["message", "call"]),
                ["simpleError", "error", "condition"],
              );
        await this.#signalGlobalCondition(
          objectClasses(condition) ?? ["simpleError", "error", "condition"],
          condition,
          context,
          "global",
        );
      }
      throw error;
    } finally {
      this.#activeCancellation = undefined;
    }
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
    const context = new EvaluationContext(this.#limits, { cancelled: false }, () =>
      runtimeOutputRouter(this.#builtinState),
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
  public async reset(): Promise<void> {
    this.#ensureActive();
    const context = this.#lifecycleContext();
    try {
      await this.#runEnvironmentFinalizers(true, undefined, context);
    } finally {
      this.#environmentFinalizers.length = 0;
      this.#attachedPackagesEnvironment = createEnvironment(this.#baseEnvironment, true);
      this.#globalEnvironment = createEnvironment(this.#attachedPackagesEnvironment, true);
      this.#baseEnvironment.bindings.set(".GlobalEnv", this.#globalEnvironment);
      setParentEnvironment(this.#baseNamespaceEnvironment, this.#globalEnvironment);
      this.#syncBaseNamespaceBindings();
      this.#builtinState.clear();
      this.#initializeBuiltinState?.(this.#builtinState);
      this.#initializeBaseEnvironment?.(this.#baseEnvironment, this.#builtinState);
      this.#registeredS3Methods.clear();
      this.#installBuiltinS3Methods();
      this.#s3RegistrationTransactions.length = 0;
      for (const record of this.#packages.values()) {
        record.namespace?.bindings.clear();
        record.dataEnvironment?.bindings.clear();
        record.namespace = undefined;
        record.dataEnvironment = undefined;
        record.exportNames = undefined;
        record.loading = false;
        record.loadingData.clear();
        record.attached = false;
      }
      this.#searchPath = [...DEFAULT_SEARCH_PATH];
      this.#userSearchEnvironments.clear();
      this.#libraryPaths = [...DEFAULT_LIBRARY_PATHS];
      this.#invalidateSearchEnvironments(true);
      this.#rebuildAttachedSearchBindings();
      this.#memoryMaxUsed = { nodeCells: 0, vectorCells: 0 };
      this.#memoryTrigger = { nodeCells: 0, vectorCells: 0 };
      this.#memoryCollections = 0;
      this.#memoryFullCollections = 0;
    }
  }

  /** Release this session and reject future operations. */
  public async dispose(): Promise<void> {
    if (!this.#disposed) {
      this.interrupt();
      const context = this.#lifecycleContext();
      try {
        await this.#runEnvironmentFinalizers(true, undefined, context);
      } finally {
        this.#environmentFinalizers.length = 0;
        this.#disposed = true;
        this.#globalEnvironment.bindings.clear();
        this.#attachedPackagesEnvironment.bindings.clear();
        this.#baseNamespaceEnvironment.bindings.clear();
        this.#baseEnvironment.bindings.clear();
        this.#emptyEnvironment.bindings.clear();
        this.#builtinState.clear();
        this.#registeredS3Methods.clear();
        this.#s3RegistrationTransactions.length = 0;
        this.#invalidateSearchEnvironments(true);
        for (const record of this.#packages.values()) {
          record.namespace?.bindings.clear();
          record.dataEnvironment?.bindings.clear();
        }
        for (const record of this.#staticPackages.values()) record.namespace.bindings.clear();
        for (const namespace of this.#builtinPackageNamespaces.values()) {
          namespace.bindings.clear();
        }
        this.#packages.clear();
        this.#staticPackages.clear();
        this.#builtinPackageNamespaces.clear();
      }
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
          return this.#forceDetailed(argument.promise, context);
        }
        const binding =
          lookupBinding(environment, node.name) ?? this.#attachedUserSearchBinding(node.name);
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
        const dispatched = await this.#dispatchOperatorS3(
          node.operator,
          [operand],
          environment,
          [node.operand.span],
          context,
        );
        if (dispatched !== undefined) return dispatched;
        return { value: this.#operators.unary(context, node.operator, operand), visible: true };
      }
      case "BinaryExpression": {
        const left = await this.#evaluateValue(node.left, environment, context);
        if (node.operator === "&&" || node.operator === "||") {
          const leftState = scalarLogicalState(left, node.operator, node.left.span);
          if (
            (node.operator === "&&" && leftState === false) ||
            (node.operator === "||" && leftState === true)
          ) {
            context.allocate(1);
            return { value: logicalVector([leftState]), visible: true };
          }
          const right = await this.#evaluateValue(node.right, environment, context);
          const rightState = scalarLogicalState(right, node.operator, node.right.span);
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
        const firstWarning = context.warnings.length;
        const value = this.#operators.binary(context, node.operator, left, right, deparseAst(node));
        await this.#signalCollectedWarnings(context, firstWarning, node);
        return {
          value,
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
        // GNU R evaluates the replacement value before the target and its
        // subscripts. Reload the binding afterwards so chained replacements
        // retain mutations performed by the right-hand side.
        const replacement = await this.#evaluateValue(node.value, environment, context);
        this.#invalidateMutableVectorOwnership(replacement);
        const binding = lookupBinding(targetEnvironment, name);
        if (binding === undefined) {
          throw new REvaluationError("NRE2001", `Object '${name}' not found.`, {
            span: node.target.target.span,
            details: { symbol: name },
          });
        }
        const target = await this.#force(binding, context);
        if (node.target.operator !== "@" && objectClasses(target) !== undefined) {
          let memberArguments: ClosureCallFrame["arguments"];
          if (node.target.operator === "$") {
            const member = node.target.arguments[0]?.value;
            if (member === undefined) {
              throw new REvaluationError("NRE2206", "The $ operator requires a member name.");
            }
            const memberSpan = node.target.arguments[0]?.span;
            memberArguments = [
              {
                ...(memberSpan === undefined ? {} : { span: memberSpan }),
                promise: createForcedPromise(
                  characterVector([staticName(member, "member")]),
                  environment,
                ),
              },
            ];
          } else {
            memberArguments = this.#prepareArguments(node.target.arguments, environment);
          }
          const replacementArguments: ClosureCallFrame["arguments"] = [
            {
              promise: createForcedPromise(target, environment, {
                kind: "Identifier",
                name: "*tmp*",
                span: node.target.target.span,
              }),
              span: node.target.target.span,
            },
            ...memberArguments,
            {
              name: "value",
              promise: createForcedPromise(replacement, environment, node.value),
              span: node.value.span,
            },
          ];
          if (isVector(target) && target.s4 === true) {
            const replacementBinding = lookupBinding(
              this.#baseEnvironment,
              `${node.target.operator}<-`,
            );
            if (replacementBinding !== undefined) {
              const callable = await this.#force(replacementBinding, context);
              if (isCallableValue(callable)) {
                const updated = await this.#invokeCallable(
                  callable,
                  replacementArguments,
                  context,
                  undefined,
                  environment,
                );
                await this.#assignBinding(targetEnvironment, name, updated, context);
                return { value: replacement, visible: false };
              }
            }
          }
          const dispatched = await this.#invokeS3MethodIfPresentResult(
            `${node.target.operator}<-`,
            this.#baseEnvironment,
            runtimeClassNames(target),
            0,
            replacementArguments,
            context,
            false,
            environment,
          );
          if (dispatched !== undefined) {
            await this.#assignBinding(targetEnvironment, name, dispatched.value, context);
            return { value: replacement, visible: false };
          }
        }
        let updated: RValue;
        if (node.target.operator === "@") {
          const member = node.target.arguments[0]?.value;
          if (member === undefined) {
            throw new REvaluationError("NRE2206", "The @ operator requires a slot name.");
          }
          updated = replaceS4Slot(
            target,
            staticName(member, "slot"),
            replacement,
            context,
            this.#builtinState,
          );
        } else if (node.target.operator === "$") {
          const member = node.target.arguments[0]?.value;
          if (member === undefined) {
            throw new REvaluationError("NRE2206", "The $ operator requires a member name.");
          }
          const memberName = staticName(member, "member");
          if (target.type === "environment") {
            await this.#assignBinding(target, memberName, replacement, context);
            return { value: replacement, visible: false };
          }
          if (target.type === "language") {
            updated = replaceLanguageMember(target, memberName, replacement, context);
          } else {
            updated =
              target.type === "null"
                ? replacement.type === "null"
                  ? R_NULL
                  : replaceListMember(listValue([]), memberName, replacement, context)
                : replaceListMember(target, memberName, replacement, context);
          }
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
              argument?.kind === "UnsupportedExpression" && argument.feature === "missing argument";
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
          if (target.type === "language" || target.type === "formula") {
            const positional = node.target.arguments.filter(
              (argument) => argument.name === undefined,
            );
            if (positional.length !== 1) {
              throw new REvaluationError(
                "NRE2204",
                `${node.target.operator} language replacement requires one subscript.`,
              );
            }
            const argument = positional[0]?.value;
            const missing =
              argument?.kind === "UnsupportedExpression" && argument.feature === "missing argument";
            if (node.target.operator === "[[" && (argument === undefined || missing)) {
              throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
            }
            const index =
              argument === undefined || missing
                ? undefined
                : await this.#evaluateValue(argument, environment, context);
            const entries = languageEntries(formulaAsLanguage(target));
            const replaced =
              node.target.operator === "["
                ? replaceVectorSubset(entries, index, replacement, context)
                : replaceVectorElement(entries, index as RValue, replacement, context);
            const rebuilt =
              node.target.operator === "[[" &&
              replacement.type === "null" &&
              isFirstLanguageEntry(index)
                ? languageTailPairlist(target, replaced)
                : languageFromEntries(replaced);
            updated =
              target.type === "formula"
                ? rebuilt.type === "pairlist"
                  ? rebuilt
                  : restoreFormulaAfterLanguageReplacement(target, rebuilt)
                : rebuilt;
            await this.#assignBinding(targetEnvironment, name, updated, context);
            return { value: replacement, visible: false };
          }
          if (target.type === "expression") {
            const positional = node.target.arguments.filter(
              (argument) => argument.name === undefined,
            );
            if (positional.length !== 1) {
              throw new REvaluationError(
                "NRE2204",
                `${node.target.operator} expression replacement requires one subscript.`,
              );
            }
            const argument = positional[0]?.value;
            const missing =
              argument?.kind === "UnsupportedExpression" && argument.feature === "missing argument";
            if (node.target.operator === "[[" && (argument === undefined || missing)) {
              throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
            }
            const index =
              argument === undefined || missing
                ? undefined
                : await this.#evaluateValue(argument, environment, context);
            updated =
              node.target.operator === "["
                ? replaceExpressionSubset(target, index, replacement, context)
                : replaceExpressionElement(target, index as RValue, replacement, context);
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
              : replaceDimensions(
                  target,
                  indices,
                  replacement,
                  context,
                  node.target.operator === "[[",
                );
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
              updated = replaceVectorSubset(
                target,
                index,
                replacement,
                context,
                node.operator !== "<<-" &&
                  node.operator !== "->>" &&
                  this.#ownsMutableVector(target, targetEnvironment, name),
              );
            }
          } else {
            if (argument === undefined || missing) {
              throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
            }
            const index = await this.#evaluateValue(argument, environment, context);
            updated = replaceVectorElement(
              target,
              index,
              replacement,
              context,
              node.operator !== "<<-" &&
                node.operator !== "->>" &&
                this.#ownsMutableVector(target, targetEnvironment, name),
            );
          }
        }
        await this.#assignBinding(
          targetEnvironment,
          name,
          updated,
          context,
          node.operator !== "<<-" && node.operator !== "->>",
        );
        return { value: replacement, visible: false };
      }
      case "CallExpression":
        return this.#evaluateCall(node, environment, context);
      case "FunctionExpression": {
        const sourceFile = this.#builtinState.get(SOURCE_REFERENCE_CONTEXT_STATE_KEY);
        const attributes = new Map<string, RValue>();
        if (
          typeof sourceFile === "object" &&
          sourceFile !== null &&
          "type" in sourceFile &&
          sourceFile.type === "environment"
        ) {
          attributes.set("srcref", evaluatorSourceReference(node.span, sourceFile as REnvironment));
        }
        return {
          value: {
            type: "closure",
            parameters: node.parameters,
            body: node.body,
            environment,
            attributes,
          },
          visible: true,
        };
      }
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
        if (node.operator === "@") {
          const member = node.arguments[0]?.value;
          if (member === undefined) {
            throw new REvaluationError("NRE2206", "The @ operator requires a slot name.", {
              span: node.span,
            });
          }
          return {
            value: extractS4Slot(target, staticName(member, "slot"), context),
            visible: true,
          };
        }
        if (node.operator === "$") {
          const member = node.arguments[0]?.value;
          if (member === undefined) {
            throw new REvaluationError("NRE2206", "The $ operator requires a member name.", {
              span: node.span,
            });
          }
          if (
            member.kind !== "Identifier" &&
            member.kind !== "StringLiteral" &&
            !(member.kind === "UnsupportedExpression" && member.feature === "dots")
          ) {
            throw new RTypeMismatchError("NRT3305", "The $ member name must be an identifier.");
          }
          const name =
            member.kind === "Identifier"
              ? member.name
              : member.kind === "StringLiteral"
                ? member.value
                : "...";
          if (isVector(target) && target.s4 === true) {
            const binding = lookupBinding(this.#baseEnvironment, "$");
            if (binding !== undefined) {
              const callable = await this.#force(binding, context);
              if (isCallableValue(callable)) {
                return this.#invokeCallableResult(
                  callable,
                  [
                    {
                      promise: createForcedPromise(target, environment, node.target),
                      span: node.target.span,
                    },
                    {
                      promise: createForcedPromise(characterVector([name]), environment, member),
                      span: member.span,
                    },
                  ],
                  context,
                  undefined,
                  environment,
                );
              }
            }
          }
          if (target.type === "language") {
            return {
              value: extractListMember(languageEntries(target), name, context),
              visible: true,
            };
          }
          if (objectClasses(target) !== undefined) {
            const dispatched = await this.#invokeS3MethodIfPresentResult(
              "$",
              this.#baseEnvironment,
              runtimeClassNames(target),
              0,
              [
                {
                  promise: createForcedPromise(target, environment, node.target),
                  span: node.target.span,
                },
                {
                  promise: createForcedPromise(characterVector([name]), environment),
                  span: member.span,
                },
              ],
              context,
              false,
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
          return {
            value: extractListMember(target, name, context),
            visible: true,
          };
        }
        if (isVector(target) && target.s4 === true) {
          const binding = lookupBinding(this.#baseEnvironment, node.operator);
          if (binding !== undefined) {
            const callable = await this.#force(binding, context);
            if (isCallableValue(callable)) {
              return this.#invokeCallableResult(
                callable,
                [
                  {
                    promise: createForcedPromise(target, environment, node.target),
                    span: node.target.span,
                  },
                  ...this.#prepareArguments(node.arguments, environment),
                ],
                context,
                undefined,
                environment,
              );
            }
          }
        }
        if (objectClasses(target) !== undefined) {
          const dispatched = await this.#invokeS3MethodIfPresentResult(
            node.operator,
            this.#baseEnvironment,
            runtimeClassNames(target),
            0,
            [
              {
                promise: createForcedPromise(target, environment, node.target),
                span: node.target.span,
              },
              ...this.#prepareArguments(node.arguments, environment),
            ],
            context,
            false,
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
        if (target.type === "language" || target.type === "formula") {
          const positional = node.arguments.filter((argument) => argument.name === undefined);
          if (positional.length !== 1) {
            throw new REvaluationError(
              "NRE2204",
              `${node.operator} language extraction requires one subscript.`,
            );
          }
          const argument = positional[0]?.value;
          const missing =
            argument?.kind === "UnsupportedExpression" && argument.feature === "missing argument";
          const entries = languageEntries(formulaAsLanguage(target));
          if (node.operator === "[") {
            const index =
              argument === undefined || missing
                ? undefined
                : await this.#evaluateValue(argument, environment, context);
            const rebuilt = languageFromEntries(subsetVector(entries, index, context));
            return {
              value:
                target.type === "formula"
                  ? restoreFormulaAfterLanguageReplacement(target, rebuilt)
                  : rebuilt,
              visible: true,
            };
          }
          if (argument === undefined || missing) {
            throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
          }
          const exactArguments = node.arguments.filter((entry) => entry.name === "exact");
          if (exactArguments.length > 1) {
            throw new REvaluationError("NRE2102", "Argument 'exact' matched more than once.");
          }
          const exactArgument = exactArguments[0];
          const index = await this.#evaluateValue(argument, environment, context);
          const exact =
            exactArgument === undefined
              ? true
              : exactMatchState(
                  await this.#evaluateValue(exactArgument.value, environment, context),
                  exactArgument.span,
                );
          return { value: extractVectorElement(entries, index, context, exact), visible: true };
        }
        if (target.type === "expression") {
          const positional = node.arguments.filter((argument) => argument.name === undefined);
          if (positional.length !== 1) {
            throw new REvaluationError(
              "NRE2204",
              `${node.operator} expression extraction requires one subscript.`,
            );
          }
          const argument = positional[0]?.value;
          const missing =
            argument?.kind === "UnsupportedExpression" && argument.feature === "missing argument";
          const explicitNames = target.attributes?.get("names");
          const entryNames = target.values.map((value, index) => {
            if (explicitNames?.type === "character") return explicitNames.values[index] ?? "";
            return value.kind === "AssignmentExpression" &&
              value.operator === "=" &&
              value.target.kind === "Identifier"
              ? value.target.name
              : "";
          });
          const entryValues = target.values.map((value) =>
            value.kind === "AssignmentExpression" &&
            value.operator === "=" &&
            value.target.kind === "Identifier"
              ? value.value
              : value,
          );
          const entries = listValue(
            entryValues.map(quoteLanguageAst),
            entryNames.some((name) => name.length > 0) ? entryNames : undefined,
          );
          if (node.operator === "[") {
            const index =
              argument === undefined || missing
                ? undefined
                : await this.#evaluateValue(argument, environment, context);
            const selected = subsetVector(entries, index, context);
            if (selected.type !== "list") {
              throw new Error();
            }
            const selectedNames = vectorNames(selected);
            const values = selected.values.map((value, selectedIndex) => {
              const expression = languageValueAst(value);
              const name = selectedNames?.[selectedIndex];
              return name === undefined || name.length === 0
                ? expression
                : ({
                    kind: "AssignmentExpression",
                    operator: "=",
                    target: { kind: "Identifier", name, span: expression.span },
                    value: expression,
                    span: expression.span,
                  } satisfies AstNode);
            });
            return {
              value: {
                type: "expression",
                values: Object.freeze(values),
                attributes: selected.attributes,
              },
              visible: true,
            };
          }
          if (argument === undefined || missing) {
            throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
          }
          const exactArguments = node.arguments.filter((entry) => entry.name === "exact");
          if (exactArguments.length > 1) {
            throw new REvaluationError("NRE2102", "Argument 'exact' matched more than once.");
          }
          const exactArgument = exactArguments[0];
          const index = await this.#evaluateValue(argument, environment, context);
          const exact =
            exactArgument === undefined
              ? true
              : exactMatchState(
                  await this.#evaluateValue(exactArgument.value, environment, context),
                  exactArgument.span,
                );
          return { value: extractVectorElement(entries, index, context, exact), visible: true };
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
        let positional = node.arguments.filter((argument) => argument.name === undefined);
        const dropArgument = node.arguments.find((argument) => argument.name === "drop");
        const positionalDropArgument =
          isDataFrame(target) && positional.length === 3 ? positional[2] : undefined;
        if (positionalDropArgument !== undefined) {
          if (dropArgument !== undefined) {
            throw new REvaluationError("NRE2102", "Argument 'drop' matched more than once.");
          }
          positional = positional.slice(0, 2);
        }
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
          const positionalDrop =
            positionalDropArgument === undefined
              ? undefined
              : await this.#evaluateOptionalSubscript(
                  positionalDropArgument.value,
                  environment,
                  context,
                );
          const drop =
            dropArgument !== undefined
              ? conditionState(
                  await this.#evaluateValue(dropArgument.value, environment, context),
                  "if",
                  dropArgument.span,
                )
              : positionalDrop === undefined
                ? true
                : conditionState(positionalDrop, "if", positionalDropArgument?.span ?? node.span);
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
          const binding = lookupBinding(this.#staticNamespaceEnvironment(namespace), member);
          const internal = this.#staticNamespaceOwnsBinding(namespace, member);
          const exported =
            exports === "all"
              ? internal
              : exports.has(member) ||
                this.#staticPackages.get(namespace)?.definition.exports.includes(member) === true;
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
        const loaded =
          record.loading && record.namespace !== undefined
            ? {
                name: namespace,
                version: record.definition.version,
                namespace: record.namespace,
                record,
              }
            : await this.#loadPackage(namespace, false, context);
        const exported = runtimePackageExportNames(loaded.record).includes(member);
        const lazyDataBinding =
          node.operator === "::" && !exported
            ? this.#loadPackageLazyData(loaded.record, context)?.bindings.get(member)
            : undefined;
        const binding =
          lazyDataBinding ??
          (exported
            ? runtimePackageExportBinding(loaded.record, member)
            : loaded.namespace.bindings.get(member));
        if (
          binding === undefined ||
          (node.operator === "::" && !exported && lazyDataBinding === undefined)
        ) {
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
      case "ConstantExpression":
        return { value: node.value as RValue, visible: true };
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
    if (node.variable.kind !== "Identifier") {
      throw new RTypeMismatchError("NRT3115", "A for-loop variable must be a symbol.", {
        span: node.variable.span,
      });
    }
    const sequence = await this.#evaluateValue(node.sequence, environment, context);
    if (sequence.type === "null") return { value: R_NULL, visible: false };
    if (!isVector(sequence) && sequence.type !== "expression") {
      throw new RTypeMismatchError(
        "NRT3115",
        "A for-loop sequence must be a vector, list, or expression.",
        {
          span: node.sequence.span,
          details: { type: sequence.type },
        },
      );
    }
    const sequenceLength =
      sequence.type === "expression" ? sequence.values.length : sequence.length;
    const target = Symbol("for");
    this.#controlFrames.push({ kind: "loop", target });
    try {
      for (let index = 0; index < sequenceLength; index += 1) {
        const value =
          sequence.type === "expression"
            ? quoteLanguageAst(
                sequence.values[index] ?? {
                  kind: "NullLiteral",
                  span: SYNTHETIC_SOURCE_SPAN,
                },
              )
            : sequence.type === "list"
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
    if (node.operator === "@") {
      const member = node.arguments[0]?.value;
      if (member === undefined) {
        throw new REvaluationError("NRE2206", "The @ operator requires a slot name.");
      }
      return { operator: "@", target, member: staticName(member, "slot") };
    }
    if (node.operator === "$") {
      const member = node.arguments[0]?.value;
      if (member === undefined) {
        throw new REvaluationError("NRE2206", "The $ operator requires a member name.");
      }
      return { operator: "$", target, member: staticName(member, "member") };
    }
    let positional = node.arguments.filter((argument) => argument.name === undefined);
    const dropArgument = node.arguments.find((argument) => argument.name === "drop");
    const positionalDropArgument =
      isDataFrame(target) && node.operator === "[" && positional.length === 3
        ? positional[2]
        : undefined;
    if (positionalDropArgument !== undefined) {
      if (dropArgument !== undefined) {
        throw new REvaluationError("NRE2102", "Argument 'drop' matched more than once.");
      }
      positional = positional.slice(0, 2);
    }
    const exactArguments = node.arguments.filter((entry) => entry.name === "exact");
    if (exactArguments.length > 1) {
      throw new REvaluationError("NRE2102", "Argument 'exact' matched more than once.");
    }
    const unknownNamed = node.arguments.find(
      (argument) =>
        argument.name !== undefined && argument.name !== (node.operator === "[" ? "drop" : "exact"),
    );
    if (unknownNamed !== undefined) {
      throw unsupported(`named subscript '${unknownNamed.name ?? ""}'`, unknownNamed.span);
    }
    const dimensions = isVector(target) ? vectorDimensions(target) : undefined;
    const dimensional =
      positional.length >= 2 || (dimensions?.length === 1 && positional.length === 1);
    if (dimensional) {
      if (!isVector(target)) {
        throw new RTypeMismatchError(
          "NRT3306",
          "Nested multidimensional replacement requires an atomic vector or list.",
          { details: { type: target.type } },
        );
      }
      const indices: (RValue | undefined)[] = [];
      for (const entry of positional) {
        indices.push(await this.#evaluateOptionalSubscript(entry.value, environment, context));
      }
      const positionalDrop =
        positionalDropArgument === undefined
          ? undefined
          : await this.#evaluateOptionalSubscript(
              positionalDropArgument.value,
              environment,
              context,
            );
      const drop =
        dropArgument !== undefined
          ? conditionState(
              await this.#evaluateValue(dropArgument.value, environment, context),
              "if",
              dropArgument.span,
            )
          : positionalDrop === undefined
            ? true
            : conditionState(positionalDrop, "if", positionalDropArgument?.span ?? node.span);
      return {
        operator: "dimensions",
        target,
        indices,
        drop,
        elementReplacement: node.operator === "[[",
      };
    }
    if (positional.length !== 1) {
      throw new REvaluationError(
        "NRE2204",
        `${node.operator} nested replacement requires one or one-per-dimension subscript.`,
      );
    }
    const argument = positional[0]?.value;
    const missing =
      argument?.kind === "UnsupportedExpression" && argument.feature === "missing argument";
    if (node.operator === "[") {
      const index =
        argument === undefined || missing
          ? undefined
          : await this.#evaluateValue(argument, environment, context);
      if (isVector(target) && isCoordinateMatrixSubscript(target, index)) {
        return { operator: "coordinates", target, index };
      }
      return {
        operator: "[",
        target,
        index,
      };
    }
    if (argument === undefined || missing) {
      throw new REvaluationError("NRE2204", "[[ requires one non-missing subscript.");
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
    if (operation.operator === "@") {
      return extractS4Slot(operation.target, operation.member, context);
    }
    if (operation.operator === "$") {
      if (operation.target.type === "environment") {
        const binding = operation.target.bindings.get(operation.member);
        return binding === undefined ? R_NULL : this.#force(binding, context);
      }
      return extractListMember(operation.target, operation.member, context);
    }
    if (operation.operator === "dimensions") {
      const selected = subsetDimensions(
        operation.target,
        operation.indices,
        operation.drop,
        context,
      );
      if (!operation.elementReplacement) return selected;
      if (selected.length !== 1) {
        throw new REvaluationError("NRE2204", "[[ requires exactly one selected element.");
      }
      return extractVectorElement(selected, integerVector([1]), context);
    }
    if (operation.operator === "coordinates") {
      return subsetCoordinateMatrix(operation.target, operation.index, context);
    }
    if (operation.target.type === "environment") {
      if (operation.operator !== "[[") {
        throw new RTypeMismatchError("NRT3306", "Environment extraction requires [[ or $.");
      }
      const binding = operation.target.bindings.get(environmentSubscriptName(operation.index));
      return binding === undefined ? R_NULL : this.#force(binding, context);
    }
    if (operation.target.type === "null") return R_NULL;
    if (!isVector(operation.target) && operation.target.type !== "pairlist") {
      if (operation.target.type === "language" || operation.target.type === "formula") {
        const entries = languageEntries(formulaAsLanguage(operation.target));
        if (operation.operator !== "[") {
          return extractVectorElement(entries, operation.index, context, operation.exact);
        }
        const rebuilt = languageFromEntries(subsetVector(entries, operation.index, context));
        return operation.target.type === "formula"
          ? restoreFormulaAfterLanguageReplacement(operation.target, rebuilt)
          : rebuilt;
      }
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
    if (operation.operator === "@") {
      return replaceS4Slot(
        operation.target,
        operation.member,
        replacement,
        context,
        this.#builtinState,
      );
    }
    if (operation.operator === "$") {
      if (operation.target.type === "environment") {
        await this.#assignBinding(operation.target, operation.member, replacement, context);
        return operation.target;
      }
      if (operation.target.type === "language") {
        return replaceLanguageMember(operation.target, operation.member, replacement, context);
      }
      if (operation.target.type === "null") {
        return replacement.type === "null" ? R_NULL : listValue([replacement], [operation.member]);
      }
      return replaceListMember(operation.target, operation.member, replacement, context);
    }
    if (operation.operator === "dimensions") {
      return replaceDimensions(
        operation.target,
        operation.indices,
        replacement,
        context,
        operation.elementReplacement,
      );
    }
    if (operation.operator === "coordinates") {
      return replaceCoordinateMatrix(operation.target, operation.index, replacement, context);
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
      if (operation.operator === "[") {
        const emptyTarget =
          replacement.type === "list" || replacement.type === "pairlist"
            ? listValue([])
            : isAtomic(replacement)
              ? subsetVector(replacement, integerVector([]), context)
              : logicalVector([]);
        return replaceVectorSubset(emptyTarget, operation.index, replacement, context);
      }
      return replaceVectorElement(listValue([]), operation.index, replacement, context);
    }
    if (!isVector(operation.target) && operation.target.type !== "pairlist") {
      if (operation.target.type === "language" || operation.target.type === "formula") {
        const entries = languageEntries(formulaAsLanguage(operation.target));
        const replaced =
          operation.operator === "["
            ? replaceVectorSubset(entries, operation.index, replacement, context)
            : replaceVectorElement(entries, operation.index, replacement, context);
        const rebuilt =
          operation.operator === "[[" &&
          replacement.type === "null" &&
          isFirstLanguageEntry(operation.index)
            ? languageTailPairlist(operation.target, replaced)
            : languageFromEntries(replaced);
        return operation.target.type === "formula"
          ? rebuilt.type === "pairlist"
            ? rebuilt
            : restoreFormulaAfterLanguageReplacement(operation.target, rebuilt)
          : rebuilt;
      }
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
    if (target.callee.kind !== "Identifier" && target.callee.kind !== "NamespaceExpression") {
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
      throw new RTypeMismatchError(
        "NRT3306",
        "Target of assignment expands to a non-language object.",
        { span },
      );
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
  ): Promise<RValue> {
    let replacementName: string;
    let replacementCallee: AstNode;
    let callable: RValue;
    if (target.callee.kind === "Identifier") {
      replacementName = `${target.callee.name}<-`;
      replacementCallee = { kind: "Identifier", name: replacementName, span: target.callee.span };
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
      callable = await this.#force(callableBinding, context);
    } else if (target.callee.kind === "NamespaceExpression") {
      const member = staticName(target.callee.member, "namespace member");
      replacementName = `${member}<-`;
      replacementCallee = {
        ...target.callee,
        member: { kind: "Identifier", name: replacementName, span: target.callee.member.span },
      };
      callable = await this.#evaluateValue(replacementCallee, environment, context);
    } else {
      throw unsupported("non-identifier replacement functions", target.callee.span);
    }
    const replacementObject =
      replacementName === "slot<-" && isVector(object)
        ? { ...object, attributes: new Map(object.attributes) }
        : object;
    const firstArgument = {
      ...(objectArgument.name === undefined ? {} : { name: objectArgument.name }),
      promise: createForcedPromise(replacementObject, environment, objectArgument.value),
      span: objectArgument.span,
    };
    const replacementExpression = languageValueAst(replacement);
    const callObjectArgument: CallArgument = {
      ...(objectArgument.name === undefined ? {} : { name: objectArgument.name }),
      value: { kind: "Identifier", name: "*tmp*", span: objectArgument.value.span },
      span: objectArgument.span,
    };
    const replacementCall: CallExpressionNode = {
      kind: "CallExpression",
      callee: replacementCallee,
      arguments: Object.freeze([
        callObjectArgument,
        ...target.arguments.slice(1),
        { name: "value", value: replacementExpression, span },
      ]),
      span,
    };
    return this.#invokeCallable(
      callable,
      [
        firstArgument,
        ...this.#prepareArguments(target.arguments.slice(1), environment),
        {
          name: "value",
          promise: createForcedPromise(replacement, environment, replacementExpression),
          span,
        },
      ],
      context,
      replacementCall,
      environment,
    );
  }

  async #evaluateCall(
    node: CallExpressionNode,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    if (node.callee.kind === "Identifier" && node.callee.name === "(") {
      const argument = node.arguments[0];
      if (node.arguments.length !== 1 || argument === undefined || argument.name !== undefined) {
        throw new REvaluationError("NRE2102", "'(' requires one unnamed argument.", {
          span: node.span,
        });
      }
      const result = await this.#evaluateNode(argument.value, environment, context);
      return { value: result.value, visible: true };
    }
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
    const parenthesizedPipeTarget =
      node.right.kind === "CallExpression" &&
      node.right.callee.kind === "Identifier" &&
      node.right.callee.name === "(" &&
      node.right.arguments.length === 1
        ? node.right.arguments[0]
        : undefined;
    if (
      node.operator === "%>%" &&
      parenthesizedPipeTarget !== undefined &&
      parenthesizedPipeTarget.name === undefined
    ) {
      const callable = await this.#evaluateCallable(
        parenthesizedPipeTarget.value,
        environment,
        context,
      );
      return this.#invokeCallableResult(
        callable,
        [{ promise: createForcedPromise(left, environment), span: node.left.span }],
        context,
      );
    }
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
    if (node.kind !== "Identifier" && node.kind !== "StringLiteral") {
      return this.#evaluateValue(node, environment, context);
    }
    const name = node.kind === "Identifier" ? node.name : node.value;
    let current: REnvironment | null = environment;
    let firstNonCallable: RValue | undefined;
    while (current !== null) {
      const binding = current.bindings.get(name);
      if (binding !== undefined && binding.type !== "dots") {
        const value = await this.#force(binding, context);
        if (value.type === "closure" || value.type === "builtin") return value;
        firstNonCallable ??= value;
      }
      current = current.parent;
    }
    if (firstNonCallable !== undefined) return firstNonCallable;
    if (node.kind === "Identifier") return this.#evaluateValue(node, environment, context);
    throw new REvaluationError("NRE2001", `object '${name}' not found`, {
      span: node.span,
      details: { symbol: name },
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
    s3Dispatch?: S3DispatchFrame,
  ): Promise<EvaluationResult> {
    const debugStep =
      callable.type === "builtin" || callable.type === "closure"
        ? await this.#enterFunctionDebug(callable, call, context)
        : false;
    if (callable.type === "builtin") {
      let resultVisibility = callable.definition.resultVisibility ?? "visible";
      const trace = functionDebugRegistry(this.#builtinState).traces.get(callable);
      const traceEnvironment =
        callerEnvironment ?? args[0]?.promise.environment ?? this.#globalEnvironment;
      const invocationEnvironment =
        s3Dispatch === undefined ? traceEnvironment : createEnvironment(traceEnvironment);
      if (s3Dispatch !== undefined) {
        setBinding(
          invocationEnvironment,
          ".Generic",
          characterVector([s3Dispatch.dispatchGeneric]),
        );
        setBinding(invocationEnvironment, ".Method", characterVector(s3Dispatch.methodNames));
        setBinding(
          invocationEnvironment,
          ".Class",
          characterVector(s3Dispatch.classes.slice(s3Dispatch.classIndex)),
        );
        setBinding(invocationEnvironment, ".Group", characterVector([s3Dispatch.group]));
        setBinding(invocationEnvironment, ".GenericCallEnv", s3Dispatch.methodLookupEnvironment);
        setBinding(invocationEnvironment, ".GenericDefEnv", s3Dispatch.genericEnvironment);
      }
      if (trace?.print) {
        context.writeOutput({
          stream: "stdout",
          text: `trace: ${call === undefined ? `${callable.definition.name}()` : deparseAst(call)}\n`,
        });
      }
      if (trace?.entry !== undefined) {
        await this.#evaluateNode(trace.entry, traceEnvironment, context);
      }
      let value: RValue;
      try {
        value = await callable.definition.implementation({
          arguments: args.map(({ name, promise }) =>
            name === undefined ? { promise } : { name, promise },
          ),
          context,
          state: this.#builtinState,
          sessionProcessId: this.#sessionProcessId,
          memoryStatistics: (reset, full) => this.#memoryStatistics(reset, full, context),
          collectGarbage: async (reset, full) => this.#collectGarbage(reset, full, context),
          registerEnvironmentFinalizer: (environment, finalizer, onExit) => {
            this.#registerEnvironmentFinalizer(environment, finalizer, onExit, context);
          },
          setResultVisibility: (visibility) => {
            resultVisibility = visibility;
          },
          currentArgumentCount: () => {
            const frame = this.#closureCallFrames.at(-1);
            return frame === undefined ? undefined : (frame.nargs ?? frame.arguments.length);
          },
          force: async (promise) => this.#force(promise, context),
          forceDetailed: async (promise) => this.#forceDetailed(promise, context),
          invoke: async (target, arguments_, invocationEnvironment) =>
            this.#invokeCallable(
              target,
              arguments_.map((argument) => ({
                ...(argument.name === undefined ? {} : { name: argument.name }),
                promise: createForcedPromise(
                  argument.value,
                  invocationEnvironment ?? this.#globalEnvironment,
                  languageValueAst(argument.value),
                ),
              })),
              context,
              undefined,
              invocationEnvironment,
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
          evaluateScoped: async (value, environment) =>
            this.#evaluateLanguageValueInFunctionScope(value, environment, context),
          evaluateEval: async (value, environment) =>
            this.#evaluateLanguageValueInEvalScope(value, environment, context),
          evaluateSource: async (value, environment) =>
            this.#evaluateLanguageValueInSourceScope(value, environment, context),
          assignBinding: async (target, name, value) =>
            this.#assignBinding(target, name, value, context),
          signalCondition: async (classes, condition, scope, afterFrameId) =>
            this.#signalGlobalCondition(
              classes,
              condition,
              context,
              scope ?? (classes.includes("error") ? "dynamic" : "all"),
              afterFrameId,
            ),
          configureOnExit: (expression, environment, add, after) => {
            this.#configureOnExit(expression, environment, add, after);
          },
          isGlobalEnvironment: (environment) => environment === this.#globalEnvironment,
          currentEnvironment: () => invocationEnvironment,
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
            let result = evaluationEnvironment;
            for (let depth = 0; depth < offset; depth += 1) {
              const frame = this.#closureCallFrames[currentIndex];
              result = frame?.callerEnvironment ?? this.#globalEnvironment;
              if (depth + 1 === offset || result === this.#globalEnvironment) return result;

              let callerIndex = -1;
              for (let index = currentIndex - 1; index >= 0; index -= 1) {
                if (this.#closureCallFrames[index]?.environment === result) {
                  callerIndex = index;
                  break;
                }
              }
              if (callerIndex < 0) return this.#globalEnvironment;
              currentIndex = callerIndex;
            }
            return result;
          },
          currentCall: () => (call === undefined ? R_NULL : { type: "language", expression: call }),
          systemCall: (which) => this.#systemCall(which),
          systemFunction: (which) => this.#systemFunction(which),
          systemCalls: () => this.#systemCalls(),
          systemFrames: () => this.#systemFrames(),
          systemParents: () => this.#systemParents(),
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
          attachSearchEnvironment: (environment, name, position) =>
            this.#attachUserSearchEnvironment(environment, name, position),
          detachSearchEnvironment: (identifier) => this.#detachSearchEnvironment(identifier),
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
          namespaceEnvironment: (name) =>
            REGISTERED_NAMESPACE_EXPORTS.has(name)
              ? this.#staticNamespaceEnvironment(name)
              : this.#packages.get(name)?.namespace,
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
          matchCall: (expandDots, definition, suppliedCall) =>
            this.#matchCurrentCall(expandDots, definition, suppliedCall),
          matchBuiltinCall: (parameters, expandDots) => {
            if (call === undefined) {
              throw new REvaluationError(
                "NRE2217",
                "Call matching requires a builtin call originating from R syntax.",
              );
            }
            return matchCallExpression(
              parameters.map((name) => ({ name, span: call.span })),
              call,
              args.map((argument): CallArgument => {
                const value = promiseCallAst(argument.promise, call.span);
                return {
                  ...(argument.name === undefined ? {} : { name: argument.name }),
                  value,
                  span: argument.span ?? value.span,
                };
              }),
              expandDots,
            );
          },
          callerFormalDefault: async (name) => this.#callerFormalDefault(name, context),
          define: (name, value) => {
            validateBindingName(name);
            setBinding(this.#globalEnvironment, name, value);
          },
          registerS3Method: async (generic, className, method, environment) =>
            this.#registerS3Method(generic, className, method, environment, context),
          dispatchS3: async (generic, object) => {
            const result = await this.#dispatchS3Result(generic, object, context);
            resultVisibility = result.visible ? "visible" : "invisible";
            return result.value;
          },
          dispatchS3IfPresent: async (
            generic,
            object,
            arguments_,
            includeDefault,
            argumentIndex,
            dispatchGeneric,
            methodArguments,
          ) => {
            const methodLookupEnvironment =
              callerEnvironment ?? args[0]?.promise.environment ?? this.#globalEnvironment;
            const result = await this.#dispatchS3IfPresentResult(
              generic,
              object,
              arguments_,
              context,
              includeDefault,
              argumentIndex,
              methodLookupEnvironment,
              dispatchGeneric,
              methodArguments?.map((argument) => runtimeClassNames(argument)),
              call,
              callerEnvironment,
            );
            if (result === undefined) return undefined;
            resultVisibility = result.visible ? "visible" : "invisible";
            return result.value;
          },
          nextMethod: async (generic, object, extraArguments) => {
            const result = await this.#nextS3MethodResult(generic, object, extraArguments, context);
            resultVisibility = result.visible ? "visible" : "invisible";
            return result.value;
          },
        });
      } finally {
        if (trace?.exit !== undefined) {
          await this.#evaluateNode(trace.exit, traceEnvironment, context);
        }
      }
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
    return this.#invokeClosure(
      callable,
      args,
      context,
      call,
      callerEnvironment,
      debugStep,
      s3Dispatch,
    );
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
    scope: "all" | "dynamic" | "global" = "all",
    afterFrameId?: number,
  ): Promise<void> {
    let selected:
      | {
          readonly frame: ExitingConditionHandlerFrame;
          readonly handlerArgument: BuiltinCallArgument;
        }
      | undefined;
    if (scope !== "global") {
      const exiting = this.#builtinState.get(EXITING_HANDLER_STACK_STATE_KEY);
      if (Array.isArray(exiting)) {
        const frames = exiting as readonly ExitingConditionHandlerFrame[];
        for (let index = frames.length - 1; index >= 0 && selected === undefined; index -= 1) {
          const frame = frames[index];
          if (
            frame === undefined ||
            this.#activeExitingHandlerFrames.has(frame.id) ||
            (afterFrameId !== undefined && frame.id <= afterFrameId)
          ) {
            continue;
          }
          const handlerArgument = frame.handlers.find(
            (argument) => argument.name !== undefined && classes.includes(argument.name),
          );
          if (handlerArgument !== undefined) selected = { frame, handlerArgument };
        }
      }
    }

    const dynamic = this.#builtinState.get(DYNAMIC_CALLING_HANDLERS_STATE_KEY);
    if (scope !== "global" && Array.isArray(dynamic)) {
      const frames = dynamic as readonly {
        readonly id: number;
        readonly handlers: ReadonlyMap<string, unknown>;
      }[];
      for (let frameIndex = frames.length - 1; frameIndex >= 0; frameIndex -= 1) {
        const frame = frames[frameIndex];
        if (
          frame === undefined ||
          !(frame.handlers instanceof Map) ||
          (selected !== undefined && frame.id <= selected.frame.id) ||
          (selected === undefined && afterFrameId !== undefined && frame.id <= afterFrameId)
        ) {
          continue;
        }
        const typedFrame = frame.handlers as ReadonlyMap<string, unknown>;
        for (const [name, handler] of typedFrame) {
          if (
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
    }
    if (selected !== undefined) {
      const handler = await this.#force(selected.handlerArgument.promise, context);
      if (!isCallableValue(handler)) {
        throw new RTypeMismatchError("NRT3250", "Condition handlers must be functions.");
      }
      this.#activeExitingHandlerFrames.add(selected.frame.id);
      try {
        const value = await this.#invokeCallable(
          handler,
          [{ promise: createForcedPromise(condition, this.#globalEnvironment) }],
          context,
        );
        throw new ExitingHandlerJump(selected.frame.id, value);
      } finally {
        this.#activeExitingHandlerFrames.delete(selected.frame.id);
      }
    }
    if (scope === "dynamic") return;
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

  async #signalCollectedWarnings(
    context: EvaluationContext,
    firstWarning: number,
    call: AstNode,
  ): Promise<void> {
    const pending = context.warnings.splice(firstWarning);
    for (const warning of pending) {
      const classes = warning.classes ?? ["simpleWarning", "warning", "condition"];
      const condition = withClasses(
        listValue(
          [characterVector([warning.message]), { type: "language", expression: call }],
          ["message", "call"],
        ),
        classes,
      );
      const stored = this.#builtinState.get(RESTART_STACK_STATE_KEY);
      const stack = Array.isArray(stored) ? (stored as RestartFrame[]) : [];
      if (!Array.isArray(stored)) this.#builtinState.set(RESTART_STACK_STATE_KEY, stack);
      const previousCounter = this.#builtinState.get(RESTART_FRAME_COUNTER_STATE_KEY);
      const id = (typeof previousCounter === "number" ? previousCounter : 0) + 1;
      this.#builtinState.set(RESTART_FRAME_COUNTER_STATE_KEY, id);
      stack.push({ id, names: new Set(["muffleWarning"]) });
      try {
        await this.#signalGlobalCondition(classes, condition, context);
        context.warnings.push(warning);
      } catch (error) {
        if (!(error instanceof RestartJump) || error.frameId !== id) throw error;
      } finally {
        if (stack[stack.length - 1]?.id === id) stack.pop();
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
    s3Dispatch?: S3DispatchFrame,
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
      functionFrame.environment = frame;
      const matched = new Map<string, RPromise>();
      const matchedArgumentIndexes = new Set<number>();
      const exactlyMatchedParameters = new Set<string>();
      const namedMatchedParameters = new Set<string>();
      const positionallyReservedParameters = new Set<string>();
      const provisionalMissingArguments = new Map<string, number>();

      for (const [argumentIndex, argument] of args.entries()) {
        if (argument.name === undefined) continue;
        const name = argument.name ?? "";
        const parameter = regularParameters.find((candidate) => candidate.name === name);
        if (parameter === undefined) continue;
        if (namedMatchedParameters.has(name)) {
          throw new REvaluationError(
            "NRE2004",
            `Argument '${name}' matched more than once.`,
            argument.span === undefined ? {} : { span: argument.span },
          );
        }
        namedMatchedParameters.add(name);
        if (argument.promise.missing) provisionalMissingArguments.set(name, argumentIndex);
        else {
          matched.set(name, argument.promise);
          positionallyReservedParameters.add(name);
        }
        exactlyMatchedParameters.add(name);
        matchedArgumentIndexes.add(argumentIndex);
      }

      const partialParameters = hasDots
        ? closure.parameters.slice(0, dotsIndex)
        : regularParameters;
      for (const [argumentIndex, argument] of args.entries()) {
        if (argument.name === undefined || matchedArgumentIndexes.has(argumentIndex)) continue;
        const name = argument.name;
        const candidates = partialParameters.filter(
          (parameter) =>
            !exactlyMatchedParameters.has(parameter.name) && parameter.name.startsWith(name),
        );
        if (candidates.length > 1) {
          throw new REvaluationError(
            "NRE2007",
            `Argument '${name}' matches multiple formal arguments.`,
            argument.span === undefined ? {} : { span: argument.span },
          );
        }
        const parameter = candidates[0];
        if (parameter === undefined) continue;
        if (namedMatchedParameters.has(parameter.name)) {
          throw new REvaluationError(
            "NRE2004",
            `Argument '${parameter.name}' matched more than once.`,
            argument.span === undefined ? {} : { span: argument.span },
          );
        }
        namedMatchedParameters.add(parameter.name);
        if (argument.promise.missing) {
          provisionalMissingArguments.set(parameter.name, argumentIndex);
        } else {
          matched.set(parameter.name, argument.promise);
          positionallyReservedParameters.add(parameter.name);
        }
        matchedArgumentIndexes.add(argumentIndex);
      }

      let positionalIndex = 0;
      for (const [argumentIndex, argument] of args.entries()) {
        if (argument.name !== undefined) continue;
        while (
          positionalIndex < positionalParameters.length &&
          (positionallyReservedParameters.has(positionalParameters[positionalIndex]?.name ?? "") ||
            matched.has(positionalParameters[positionalIndex]?.name ?? ""))
        ) {
          positionalIndex += 1;
        }
        const parameter = positionalParameters[positionalIndex];
        if (argument.promise.missing) {
          if (parameter === undefined && hasDots) continue;
          matchedArgumentIndexes.add(argumentIndex);
          if (parameter !== undefined) positionalIndex += 1;
          continue;
        }
        if (parameter === undefined) {
          if (hasDots) continue;
          throw new REvaluationError(
            "NRE2005",
            "Unused positional argument.",
            argument.span === undefined ? {} : { span: argument.span },
          );
        }
        const provisionalIndex = provisionalMissingArguments.get(parameter.name);
        if (provisionalIndex !== undefined) provisionalMissingArguments.delete(parameter.name);
        matched.set(parameter.name, argument.promise);
        matchedArgumentIndexes.add(argumentIndex);
        positionalIndex += 1;
      }

      for (const [name, argumentIndex] of provisionalMissingArguments) {
        const promise = args[argumentIndex]?.promise;
        if (promise !== undefined) matched.set(name, promise);
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
      if (s3Dispatch !== undefined) {
        setBinding(frame, ".Generic", characterVector([s3Dispatch.dispatchGeneric]));
        setBinding(frame, ".Method", characterVector(s3Dispatch.methodNames));
        setBinding(
          frame,
          ".Class",
          characterVector(s3Dispatch.classes.slice(s3Dispatch.classIndex)),
        );
        setBinding(frame, ".Group", characterVector([s3Dispatch.group]));
        setBinding(frame, ".GenericCallEnv", s3Dispatch.methodLookupEnvironment);
        setBinding(frame, ".GenericDefEnv", s3Dispatch.genericEnvironment);
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
        const trace = functionDebugRegistry(this.#builtinState).traces.get(closure);
        if (trace?.print) {
          context.writeOutput({
            stream: "stdout",
            text: `trace: ${call === undefined ? "function()" : deparseAst(call)}\n`,
          });
        }
        let result: EvaluationResult | undefined;
        let failed = false;
        let failure: unknown;
        try {
          if (trace?.entry !== undefined) {
            await this.#evaluateNode(trace.entry, frame, context);
          }
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
          if (trace?.exit !== undefined) {
            await this.#evaluateNode(trace.exit, frame, context);
          }
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
    const frame = this.#nearestFunctionFrame(environment) ?? this.#nearestFunctionFrame(undefined);
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

  async #evaluateLanguageValueInFunctionScope(
    value: RValue,
    environment: REnvironment,
    context: EvaluationContext,
    frameEnvironment: REnvironment = environment,
  ): Promise<EvaluationResult> {
    const functionTarget = Symbol("scoped evaluation");
    const functionFrame: FunctionControlFrame = {
      kind: "function",
      target: functionTarget,
      environment: frameEnvironment,
      exitHandlers: [],
    };
    this.#controlFrames.push(functionFrame);
    try {
      let result: EvaluationResult | undefined;
      let failed = false;
      let failure: unknown;
      try {
        result = await this.#evaluateLanguageValueResult(value, environment, context);
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
        throw new REvaluationError("NRE2140", "A scoped evaluation completed without a result.");
      }
      return result;
    } finally {
      this.#controlFrames.pop();
    }
  }

  async #evaluateLanguageValueInSourceScope(
    value: RValue,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const sourceEnvironment = createEnvironment(environment);
    const intermediateEnvironments = [
      sourceEnvironment,
      createEnvironment(sourceEnvironment),
      createEnvironment(sourceEnvironment),
      environment,
    ];
    const frameSpecs = [
      { name: "source", parameters: ["file", "local"] as const, bindings: [] as const },
      { name: "withVisible", parameters: ["x"] as const, bindings: [["x", value]] as const },
      {
        name: "eval",
        parameters: ["expr", "envir", "enclos"] as const,
        bindings: [
          ["expr", value],
          ["envir", environment],
          ["enclos", this.#baseEnvironment],
        ] as const,
      },
      {
        name: "eval",
        parameters: ["expr", "envir", "enclos"] as const,
        bindings: [
          ["expr", value],
          ["envir", environment],
          ["enclos", this.#baseEnvironment],
        ] as const,
      },
    ] as const;
    const calls = frameSpecs.map(({ name }): CallExpressionNode => ({
      kind: "CallExpression",
      callee: { kind: "Identifier", name, span: SYNTHETIC_SOURCE_SPAN },
      arguments: Object.freeze([]),
      span: SYNTHETIC_SOURCE_SPAN,
    }));
    const frames = calls.map((call, index): ClosureCallFrame => {
      const frameEnvironment = intermediateEnvironments[index] ?? environment;
      const spec = frameSpecs[index]!;
      const matched = new Map<string, RPromise>();
      for (const [name, binding] of spec.bindings) {
        const promise = createForcedPromise(binding, frameEnvironment);
        setBinding(frameEnvironment, name, promise);
        matched.set(name, promise);
      }
      const closure: RClosure = {
        type: "closure",
        parameters: spec.parameters.map((name) => ({ name, span: SYNTHETIC_SOURCE_SPAN })),
        body: { kind: "NullLiteral", span: SYNTHETIC_SOURCE_SPAN },
        environment:
          index === 0 ? environment : (intermediateEnvironments[index - 1] ?? environment),
        attributes: new Map(),
      };
      return {
        arguments: [],
        environment: frameEnvironment,
        callerEnvironment:
          index === 0 ? environment : (intermediateEnvironments[index - 1] ?? environment),
        closure,
        matched,
        call,
      };
    });
    this.#closureCallFrames.push(...frames);
    try {
      return await this.#evaluateLanguageValueInFunctionScope(
        value,
        environment,
        context,
        sourceEnvironment,
      );
    } finally {
      this.#closureCallFrames.splice(this.#closureCallFrames.length - frames.length, frames.length);
    }
  }

  async #evaluateLanguageValueInEvalScope(
    value: RValue,
    environment: REnvironment,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const outerEnvironment = createEnvironment(this.#baseEnvironment);
    const expressionPromise = createForcedPromise(value, outerEnvironment);
    const environmentPromise = createForcedPromise(environment, outerEnvironment);
    const enclosurePromise = createForcedPromise(this.#baseEnvironment, outerEnvironment);
    setBinding(outerEnvironment, "expr", expressionPromise);
    setBinding(outerEnvironment, "envir", environmentPromise);
    setBinding(outerEnvironment, "enclos", enclosurePromise);

    const call: CallExpressionNode = {
      kind: "CallExpression",
      callee: { kind: "Identifier", name: "eval", span: SYNTHETIC_SOURCE_SPAN },
      arguments: Object.freeze([
        {
          value: { kind: "Identifier", name: "expr", span: SYNTHETIC_SOURCE_SPAN },
          span: SYNTHETIC_SOURCE_SPAN,
        },
        {
          value: { kind: "Identifier", name: "envir", span: SYNTHETIC_SOURCE_SPAN },
          span: SYNTHETIC_SOURCE_SPAN,
        },
      ]),
      span: SYNTHETIC_SOURCE_SPAN,
    };
    const parameters = ["expr", "envir", "enclos"].map((name) => ({
      name,
      span: SYNTHETIC_SOURCE_SPAN,
    }));
    const closure: RClosure = {
      type: "closure",
      parameters,
      body: { kind: "NullLiteral", span: SYNTHETIC_SOURCE_SPAN },
      environment: this.#baseEnvironment,
      attributes: new Map(),
    };
    const suppliedArguments = [
      { promise: expressionPromise },
      { promise: environmentPromise },
    ] as const;
    const frames: readonly ClosureCallFrame[] = [
      {
        arguments: suppliedArguments,
        environment: outerEnvironment,
        callerEnvironment: this.#closureCallFrames.at(-1)?.environment ?? this.#globalEnvironment,
        closure,
        matched: new Map([
          ["expr", expressionPromise],
          ["envir", environmentPromise],
          ["enclos", enclosurePromise],
        ]),
        nargs: 3,
        call,
      },
      {
        arguments: suppliedArguments,
        environment,
        callerEnvironment: outerEnvironment,
        closure,
        matched: new Map(),
        nargs: 3,
        call,
      },
    ];
    this.#closureCallFrames.push(...frames);
    try {
      return await this.#evaluateLanguageValueResult(value, environment, context);
    } finally {
      this.#closureCallFrames.splice(this.#closureCallFrames.length - frames.length, frames.length);
    }
  }

  #nearestFunctionFrame(environment: REnvironment | undefined): FunctionControlFrame | undefined {
    for (let index = this.#controlFrames.length - 1; index >= 0; index -= 1) {
      const frame = this.#controlFrames[index];
      if (
        frame?.kind === "function" &&
        (environment === undefined || frame.environment === environment)
      ) {
        return frame;
      }
    }
    return undefined;
  }

  #matchCurrentCall(
    expandDots: boolean,
    definition?: RClosure | RBuiltin,
    suppliedCall?: RLanguage,
  ): RLanguage {
    const frame = this.#closureCallFrames.at(-1);
    if ((definition === undefined || suppliedCall === undefined) && frame === undefined) {
      throw new REvaluationError("NRE2217", "match.call() requires an active closure call.");
    }
    const activeCall =
      frame === undefined
        ? undefined
        : (frame.call ?? {
            kind: "CallExpression",
            callee: { kind: "Identifier", name: "function", span: SYNTHETIC_SOURCE_SPAN },
            arguments: frame.arguments.map((argument): CallArgument => {
              const value = promiseCallAst(argument.promise, SYNTHETIC_SOURCE_SPAN);
              return {
                ...(argument.name === undefined ? {} : { name: argument.name }),
                value,
                span: argument.span ?? value.span,
              };
            }),
            span: SYNTHETIC_SOURCE_SPAN,
          });
    if (definition !== undefined || suppliedCall !== undefined) {
      const parameters =
        definition === undefined
          ? frame?.closure.parameters
          : definition.type === "closure"
            ? definition.parameters
            : definition.definition.formals;
      if (parameters === undefined) {
        throw new RTypeMismatchError("NRT3214", "invalid 'definition' argument");
      }
      const call = suppliedCall?.expression ?? activeCall;
      if (call?.kind !== "CallExpression") {
        throw new RTypeMismatchError("NRT3214", "invalid 'call' argument");
      }
      const sourceArguments =
        suppliedCall === undefined && frame !== undefined
          ? frame.arguments.map((argument): CallArgument => {
              const value = promiseCallAst(argument.promise, call.span);
              return {
                ...(argument.name === undefined ? {} : { name: argument.name }),
                value,
                span: argument.span ?? value.span,
              };
            })
          : call.arguments;
      return matchCallExpression(parameters, call, sourceArguments, expandDots);
    }
    if (frame === undefined || activeCall === undefined) {
      throw new REvaluationError("NRE2217", "match.call() requires an active closure call.");
    }
    const arguments_: CallArgument[] = [];
    for (const parameter of frame.closure.parameters) {
      if (parameter.name !== "...") {
        const promise = frame.matched.get(parameter.name);
        if (promise === undefined) continue;
        const value = promiseCallAst(promise, activeCall.span);
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
          const value = promiseCallAst(argument.promise, activeCall.span);
          arguments_.push({
            ...(argument.name === undefined ? {} : { name: argument.name }),
            value,
            span: value.span,
          });
        }
      } else {
        const entries = dots.arguments.map((argument): CallArgument => {
          const value = promiseCallAst(argument.promise, activeCall.span ?? parameter.span);
          return {
            ...(argument.name === undefined ? {} : { name: argument.name }),
            value,
            span: value.span,
          };
        });
        const values = dots.arguments.map((argument) =>
          quotePromiseCallAst(argument.promise, activeCall.span ?? parameter.span),
        );
        const names = entries.map((entry) => entry.name ?? "");
        const pairlist = pairlistValue(values, names);
        const display: CallExpressionNode = {
          kind: "CallExpression",
          callee: { kind: "Identifier", name: "pairlist", span: parameter.span },
          arguments: entries,
          span: parameter.span,
        };
        arguments_.push({
          name: "...",
          value: {
            kind: "ConstantExpression",
            value: pairlist,
            display,
            span: parameter.span,
          },
          span: parameter.span,
        });
      }
    }
    return {
      type: "language",
      expression: {
        ...activeCall,
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

  #systemFunction(which: number): RClosure | typeof R_NULL {
    const frameCount = this.#closureCallFrames.length;
    const position = which === 0 ? frameCount : which > 0 ? which : frameCount + which;
    if (position === 0) return R_NULL;
    if (position < 0 || position > frameCount) {
      throw new REvaluationError("NRE2218", "Not that many frames on the stack.");
    }
    return this.#closureCallFrames[position - 1]?.closure ?? R_NULL;
  }

  #systemCalls(): RPairlist {
    return pairlistValue(
      this.#closureCallFrames.map((frame) =>
        frame.call === undefined
          ? R_NULL
          : ({ type: "language", expression: frame.call } satisfies RLanguage),
      ),
    );
  }

  #systemFrames(): RPairlist {
    return pairlistValue(this.#closureCallFrames.map((frame) => frame.environment));
  }

  #systemParents(): RIntegerVector {
    return integerVector(
      this.#closureCallFrames.map((frame, frameIndex) => {
        for (let index = frameIndex - 1; index >= 0; index -= 1) {
          if (this.#closureCallFrames[index]?.environment === frame.callerEnvironment) {
            return index + 1;
          }
        }
        return 0;
      }),
    );
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
    if (
      genericPackage === undefined &&
      (PRIMITIVE_S3_GENERICS.has(generic) || IMPLICIT_S3_GROUP_GENERICS.has(generic))
    ) {
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

  #isS3GenericNamespaceLoaded(packageName: string): boolean {
    return (
      packageName === "base" ||
      this.#builtinPackageNamespaces.has(packageName) ||
      this.#staticPackages.has(packageName) ||
      this.#packages.get(packageName)?.namespace !== undefined
    );
  }

  #deferS3Method(registration: DeferredS3MethodRegistration): void {
    const pending = this.#deferredS3Methods.get(registration.genericPackage) ?? [];
    pending.push(registration);
    this.#deferredS3Methods.set(registration.genericPackage, pending);
  }

  async #registerDeferredS3Methods(
    genericPackage: string,
    context: EvaluationContext,
  ): Promise<void> {
    const pending = this.#deferredS3Methods.get(genericPackage);
    if (pending === undefined) return;
    for (const registration of pending) {
      await this.#registerS3Method(
        registration.generic,
        registration.className,
        registration.method,
        this.#packages.get(registration.ownerPackage)?.namespace ?? this.#baseNamespaceEnvironment,
        context,
        genericPackage,
      );
    }
    this.#deferredS3Methods.delete(genericPackage);
  }

  async #dispatchS3Result(
    generic: string,
    object: RValue | undefined,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    if (generic.length === 0) {
      throw new REvaluationError("NRE2213", "UseMethod() generic name must be non-empty.");
    }
    const callFrame = this.#closureCallFrames.at(-1);
    const arguments_ = callFrame?.arguments ?? [];
    let dispatchObject = object;
    if (dispatchObject === undefined) {
      const first = arguments_[0];
      if (first === undefined) {
        if (callFrame === undefined) {
          throw new REvaluationError(
            "NRE2214",
            "UseMethod() requires an object or a generic call argument.",
          );
        }
        dispatchObject = R_NULL;
      } else {
        dispatchObject = await this.#force(first.promise, context);
      }
    }
    return this.#invokeS3MethodResult(
      generic,
      callFrame?.closure.environment ?? this.#baseEnvironment,
      callFrame?.callerEnvironment ?? this.#globalEnvironment,
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
        const staticPackage = this.#staticPackages.get(name);
        if (attach && !this.#searchPath.includes(`package:${name}`)) {
          this.#searchPath = [
            this.#searchPath[0] ?? ".GlobalEnv",
            `package:${name}`,
            ...this.#searchPath.slice(1),
          ];
          this.#invalidateSearchEnvironments();
          this.#rebuildAttachedSearchBindings();
        }
        return {
          name,
          version: "4.6.1",
          namespace: this.#staticNamespaceEnvironment(name),
          record: {
            definition: {
              name,
              version: "4.6.1",
              lazyData: false,
              descriptionFields: corePackageDescriptionFields(name),
              resourceTextEncoding: "utf8",
              dependencies: [],
              imports: [],
              exports: await this.#namespaceExports(name, context),
              exportPatterns: [],
              classExports: [],
              methodExports: [],
              s3Methods: [],
              programs: [],
              textResources: staticPackage?.definition.textResources ?? [],
              resources: staticPackage?.definition.resources ?? [],
            },
            namespace: this.#staticNamespaceEnvironment(name),
            dataEnvironment: undefined,
            exportNames: undefined,
            loading: false,
            loadingData: new Set(),
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
        const sourceDependsEnvironment = await this.#packageSourceDependsEnvironment(
          record,
          context,
        );
        const importsEnvironment = createEnvironment(
          sourceDependsEnvironment ?? this.#baseNamespaceEnvironment,
          true,
        );
        for (const import_ of record.definition.imports) {
          context.checkpoint();
          const dependency = await this.#loadPackage(import_.package, false, context, libraryPaths);
          const names = import_.names ?? [
            ...(await this.#namespaceExports(import_.package, context)),
            ...(CORE_NAMESPACE_FULL_IMPORT_INTERNALS.get(import_.package) ?? []),
          ];
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
        const registeredMethodIndexes = new Set<number>();
        const deferredMethods: DeferredS3MethodRegistration[] = [];
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
              !IMPLICIT_S3_GROUP_GENERICS.has(method.generic) &&
              lookupBinding(namespace, method.generic) === undefined
            ) {
              if (requireAll) {
                throw new REvaluationError("NRE2001", `object '${method.generic}' not found`);
              }
              continue;
            }
            if (
              method.genericPackage !== undefined &&
              !this.#isS3GenericNamespaceLoaded(method.genericPackage)
            ) {
              deferredMethods.push({
                ownerPackage: name,
                genericPackage: method.genericPackage,
                generic: method.generic,
                className: method.class,
                method: binding,
              });
              registeredMethodIndexes.add(index);
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
          // DESCRIPTION Depends packages are visible while package sources are
          // installed/evaluated, but they are not lexical namespace imports.
          // Remove that temporary lookup layer before .onLoad and later calls.
          if (sourceDependsEnvironment !== undefined) {
            setParentEnvironment(importsEnvironment, this.#baseNamespaceEnvironment);
          }
          if (hadSourceDirectory) {
            this.#builtinState.set(
              PACKAGE_SOURCE_EVALUATION_DIRECTORY_STATE_KEY,
              previousSourceDirectory,
            );
          } else {
            this.#builtinState.delete(PACKAGE_SOURCE_EVALUATION_DIRECTORY_STATE_KEY);
          }
        }
        await registerAvailableS3Methods(true);
        await this.#invokePackageHook(record, ".onLoad", context);
        // Explicit exports may be imported bindings or may be installed by
        // .onLoad. Validate only after the namespace lifecycle hook completes.
        for (const exportedName of record.definition.exports) {
          if (lookupBinding(namespace, exportedName) === undefined) {
            throw new REvaluationError(
              "NRE2224",
              `Package '${name}' exports missing binding '${exportedName}'.`,
            );
          }
        }
        for (const className of record.definition.classExports) {
          const exportedName = `.__C__${className}`;
          if (namespace.bindings.get(exportedName) === undefined) {
            throw new REvaluationError(
              "NRE2224",
              `Package '${name}' exports missing S4 class '${className}'.`,
            );
          }
        }
        // exportPattern() applies to the completed namespace, including bindings
        // intentionally installed by .onLoad (often through delayedAssign()).
        record.exportNames = resolveRuntimePackageExportNames(record, namespace);
        await this.#registerDeferredS3Methods(name, context);
        for (const registration of deferredMethods) this.#deferS3Method(registration);
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
        throw new Error();
      }
      if (loadFailed) throw loadError;
    }
    const namespace = record.namespace;
    if (namespace === undefined) {
      throw new REvaluationError("NRE2226", `Package '${name}' did not create a namespace.`);
    }
    if (attach && !record.attached) {
      for (const dependency of record.definition.dependencies) {
        if (dependency.kind === "Depends") {
          await this.#loadPackage(dependency.package, true, context, libraryPaths);
        }
      }
      this.#loadPackageLazyData(record, context);
      await this.#invokePackageHook(record, ".onAttach", context);
      const exportNames = runtimePackageExportNames(record);
      context.allocate(exportNames.length);
      this.#searchPath = [
        this.#searchPath[0] ?? ".GlobalEnv",
        `package:${name}`,
        ...this.#searchPath.slice(1).filter((entry) => entry !== `package:${name}`),
      ];
      this.#attachSearchEnvironment(name);
      this.#rebuildAttachedSearchBindings();
      record.attached = true;
    }
    return { name, version: record.definition.version, namespace, record };
  }

  async #packageSourceDependsEnvironment(
    record: RuntimePackageRecord,
    context: EvaluationContext,
  ): Promise<REnvironment | undefined> {
    const attachmentOrder: string[] = [];
    const active = new Set<string>();
    const appendWithDependencies = (name: string): void => {
      if (active.has(name)) return;
      active.add(name);
      const dependencyRecord = this.#packages.get(name);
      for (const dependency of dependencyRecord?.definition.dependencies ?? []) {
        if (dependency.kind === "Depends") appendWithDependencies(dependency.package);
      }
      active.delete(name);
      attachmentOrder.push(name);
    };
    for (const dependency of record.definition.dependencies) {
      if (dependency.kind === "Depends") appendWithDependencies(dependency.package);
    }
    if (attachmentOrder.length === 0) return undefined;

    const environment = createEnvironment(this.#baseNamespaceEnvironment, true);
    for (const name of attachmentOrder) {
      context.checkpoint();
      const dependency = this.#packages.get(name);
      const namespace =
        dependency?.namespace ?? this.#staticPackages.get(name)?.namespace ?? undefined;
      if (namespace === undefined) continue;
      const exportNames = await this.#namespaceExports(name, context);
      context.allocate(exportNames.length);
      for (const exportName of exportNames) {
        const binding =
          dependency === undefined
            ? namespace.bindings.get(exportName)
            : runtimePackageExportBinding(dependency, exportName);
        if (binding !== undefined) setBinding(environment, exportName, binding);
      }
    }
    return environment;
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
    const bytes = decodeRBase64Resource(
      archive.data,
      context,
      context.limits.maxPackageResourceBytes,
    );
    const workspace = await decodeRWorkspaceFile(
      bytes,
      context,
      {
        global: this.#globalEnvironment,
        base: this.#baseEnvironment,
        baseNamespace: this.#baseNamespaceEnvironment,
        empty: this.#emptyEnvironment,
      },
      context.limits.maxPackageResourceBytes,
    );
    for (const entry of workspace.entries) {
      context.checkpoint();
      setBinding(namespace, entry.name, entry.value);
    }
  }

  #loadPackageLazyData(
    record: RuntimePackageRecord,
    context: EvaluationContext,
  ): REnvironment | undefined {
    if (record.definition.lazyData !== true) return undefined;
    if (record.dataEnvironment !== undefined) return record.dataEnvironment;
    const datasets = runtimePackageDatasets(record);
    const environment = createEnvironment(this.#baseNamespaceEnvironment, true);
    record.dataEnvironment = environment;
    context.allocate(datasets.length);
    for (const dataset of datasets) {
      setBinding(environment, dataset.name, {
        type: "promise",
        expression: null,
        environment,
        packageData: {
          package: record.definition.name,
          dataset: dataset.name,
          ...(dataset.resource === dataset.name ? {} : { resource: dataset.resource }),
        },
        missing: false,
        state: "unforced",
        value: undefined,
      });
    }
    return environment;
  }

  async #loadPackageDataset(
    record: RuntimePackageRecord,
    dataset: string,
    resource: string,
    promise: RPromise,
    context: EvaluationContext,
  ): Promise<RValue> {
    const environment = record.dataEnvironment;
    if (environment === undefined) {
      throw new REvaluationError(
        "NRE2250",
        `Package '${record.definition.name}' has no LazyData environment.`,
      );
    }
    if (record.loadingData.has(dataset)) {
      throw new REvaluationError(
        "NRE2250",
        `Package LazyData cycle while loading '${record.definition.name}::${dataset}'.`,
      );
    }
    const dataBinding = this.#builtinPackageNamespaces.get("utils")?.bindings.get("data");
    if (dataBinding === undefined) {
      throw new REvaluationError(
        "NRE2255",
        `Package '${record.definition.name}' LazyData requires the utils::data runtime binding.`,
      );
    }
    record.loadingData.add(dataset);
    try {
      const data = await this.#force(dataBinding, context);
      await this.#invokeCallable(
        data,
        [
          {
            name: "list",
            promise: createForcedPromise(characterVector([resource]), environment),
          },
          {
            name: "package",
            promise: createForcedPromise(characterVector([record.definition.name]), environment),
          },
          {
            name: "envir",
            promise: createForcedPromise(environment, environment),
          },
        ],
        context,
        undefined,
        environment,
      );
      const loaded = environment.bindings.get(dataset);
      if (loaded === undefined || loaded === promise) {
        throw new REvaluationError(
          "NRE2250",
          `Package data set '${record.definition.name}::${dataset}' did not create a matching binding.`,
        );
      }
      const value = await this.#force(loaded, context);
      if (record.attached) {
        this.#attachSearchEnvironment(record.definition.name);
        this.#rebuildAttachedSearchBindings();
      }
      return value;
    } finally {
      record.loadingData.delete(dataset);
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
    const exportNames = runtimePackageExportNames(record);
    context.allocate(exportNames.length);
    return exportNames;
  }

  #namespaceName(environment: REnvironment): string | undefined {
    for (const [name, record] of this.#staticPackages) {
      if (record.namespace === environment) return name;
    }
    for (const [name, namespace] of this.#builtinPackageNamespaces) {
      if (namespace === environment) return name;
    }
    if (environment === this.#baseNamespaceEnvironment) return "base";
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
      const binding = this.#staticNamespaceEnvironment(name).bindings.get(bindingName);
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
    const binding =
      record.namespace?.bindings.get(bindingName) ??
      this.#loadPackageLazyData(record, context)?.bindings.get(bindingName);
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
      fields: installedPureRDescriptionFields(record.definition.descriptionFields),
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
      const definition = this.#staticPackages.get(name)?.definition;
      const metadata = CORE_PACKAGE_METADATA_PATHS.includes(normalizedPath);
      if (
        normalizedPath.length > 0 &&
        !metadata &&
        (definition === undefined ||
          ![...definition.textResources, ...definition.resources].some(
            (resource) =>
              resource.path === normalizedPath || resource.path.startsWith(`${normalizedPath}/`),
          ))
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
      const definition = this.#staticPackages.get(name)?.definition;
      return Object.freeze(
        [
          ...CORE_PACKAGE_METADATA_PATHS,
          ...(definition === undefined
            ? []
            : [...definition.textResources, ...definition.resources].map(
                (resource) => resource.path,
              )),
        ]
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
    const runtimePrefix = "nativr://runtime/";
    if (path.startsWith(runtimePrefix)) {
      const resource = this.#runtimeTextResources.get(path.slice(runtimePrefix.length));
      return resource === undefined
        ? undefined
        : { encoding: "text", data: resource.text, textEncoding: "utf8" };
    }
    const resolved = parsePackageVirtualPath(path);
    if (resolved === undefined || resolved.resourcePath.length === 0) return undefined;
    const staticExports = this.#staticNamespaceExports(resolved.name);
    if (staticExports !== undefined) {
      const exportNames =
        staticExports === "all"
          ? [...this.#staticNamespaceEnvironment(resolved.name).bindings.keys()]
          : [...staticExports];
      const metadata = corePackageMetadataText(resolved.name, resolved.resourcePath, exportNames);
      if (metadata !== undefined) {
        return { encoding: "text", data: metadata, textEncoding: "utf8" };
      }
    }
    const staticDefinition = this.#staticPackages.get(resolved.name)?.definition;
    if (staticDefinition !== undefined) {
      const text = staticDefinition.textResources.find(
        (resource) => resource.path === resolved.resourcePath,
      );
      if (text !== undefined) return { encoding: "text", data: text.text, textEncoding: "utf8" };
      const binary = staticDefinition.resources.find(
        (resource) => resource.path === resolved.resourcePath,
      );
      return binary === undefined
        ? undefined
        : {
            encoding: "base64",
            data: binary.data,
            textEncoding: staticDefinition.resourceTextEncoding,
          };
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
      if (current === this.#globalEnvironment || current === this.#attachedPackagesEnvironment) {
        return undefined;
      }
      for (const [name, record] of this.#packages) {
        if (record.namespace === current || record.dataEnvironment === current) return name;
      }
      for (const [name, record] of this.#staticPackages) {
        if (record.namespace === current) return name;
      }
      for (const [name, namespace] of this.#builtinPackageNamespaces) {
        if (namespace === current) return name;
      }
      const searchName = this.#searchEnvironmentNames.get(current.id);
      if (searchName?.startsWith("package:")) return searchName.slice("package:".length);
      if (current === this.#baseEnvironment || current === this.#baseNamespaceEnvironment) {
        return "base";
      }
      current = current.parent;
    }
    return undefined;
  }

  #registeredNamespaceExportNames(name: string, exports: ReadonlySet<string> | "all"): string[] {
    const staticExports = this.#staticPackages.get(name)?.definition.exports ?? [];
    if (exports !== "all") return [...new Set([...exports, ...staticExports])];
    const names = this.#builtins
      .filter((definition) => definition.package === name)
      .map((definition) => definition.name);
    if (name === "base") {
      names.push(
        "pi",
        "letters",
        "LETTERS",
        "month.abb",
        "month.name",
        "T",
        "F",
        ".Machine",
        ".Platform",
        ".leap.seconds",
        ".LC.categories",
        ".Library",
        ".Library.site",
        ".BaseNamespaceEnv",
      );
    }
    return [...new Set([...names, ...staticExports])];
  }

  #staticNamespaceExports(name: string): ReadonlySet<string> | "all" | undefined {
    return this.#packages.has(name) ? undefined : REGISTERED_NAMESPACE_EXPORTS.get(name);
  }

  #staticNamespaceOwnsBinding(name: string, bindingName: string): boolean {
    return (
      this.#staticPackages.get(name)?.definition.exports.includes(bindingName) === true ||
      this.#builtins.some(
        (definition) => definition.package === name && definition.name === bindingName,
      ) ||
      (name === "base" && BASE_NAMESPACE_CONSTANTS.has(bindingName))
    );
  }

  #staticNamespaceEnvironment(name: string): REnvironment {
    return (
      this.#staticPackages.get(name)?.namespace ??
      this.#builtinPackageNamespaces.get(name) ??
      this.#baseNamespaceEnvironment
    );
  }

  #rebuildAttachedSearchBindings(): void {
    this.#attachedPackagesEnvironment.bindings.clear();
    for (let index = this.#searchPath.length - 1; index >= 0; index -= 1) {
      const entry = this.#searchPath[index];
      if (entry === undefined || entry === ".GlobalEnv" || entry === "package:base") continue;
      const user = this.#userSearchEnvironments.get(entry);
      if (user !== undefined) {
        for (const [name, binding] of user.bindings) {
          setBinding(this.#attachedPackagesEnvironment, name, binding);
        }
        continue;
      }
      if (!entry.startsWith("package:")) continue;
      const packageName = entry.slice("package:".length);
      const staticExports = this.#staticNamespaceExports(packageName);
      if (staticExports !== undefined) {
        const source = this.#staticNamespaceEnvironment(packageName);
        for (const name of this.#registeredNamespaceExportNames(packageName, staticExports)) {
          const binding = source.bindings.get(name);
          if (binding !== undefined) setBinding(this.#attachedPackagesEnvironment, name, binding);
        }
        continue;
      }
      const record = this.#packages.get(packageName);
      if (record?.namespace === undefined) continue;
      for (const name of runtimePackageExportNames(record)) {
        const binding = runtimePackageExportBinding(record, name);
        if (binding !== undefined) setBinding(this.#attachedPackagesEnvironment, name, binding);
      }
      for (const [name, binding] of record.dataEnvironment?.bindings ?? []) {
        setBinding(this.#attachedPackagesEnvironment, name, binding);
      }
    }
  }

  #attachUserSearchEnvironment(
    environment: REnvironment,
    name: string,
    position: number,
  ): REnvironment {
    if (name.length === 0) {
      throw new REvaluationError("NRE2264", `invalid attach name '${name}'`);
    }
    if (this.#searchPath.includes(name)) {
      throw new REvaluationError("NRE2264", `'${name}' is already on the search path`);
    }
    const normalizedPosition = Math.trunc(position);
    if (
      !Number.isFinite(normalizedPosition) ||
      normalizedPosition < 2 ||
      normalizedPosition > this.#searchPath.length
    ) {
      throw new REvaluationError("NRE2264", "invalid 'pos' argument");
    }
    const attached = createEnvironment(this.#emptyEnvironment, true);
    for (const [bindingName, binding] of environment.bindings) {
      setBinding(attached, bindingName, binding);
    }
    for (const [attributeName, attribute] of environment.attributes) {
      attached.attributes.set(attributeName, attribute);
    }
    attached.attributes.set("name", characterVector([name]));
    this.#userSearchEnvironments.set(name, attached);
    this.#searchPath.splice(normalizedPosition - 1, 0, name);
    this.#invalidateSearchEnvironments(true);
    this.#rebuildAttachedSearchBindings();
    return attached;
  }

  #detachSearchEnvironment(identifier: number | string): string {
    const index =
      typeof identifier === "number"
        ? Math.trunc(identifier) - 1
        : this.#searchPath.indexOf(identifier);
    if (index < 1 || index >= this.#searchPath.length - 1) {
      throw new REvaluationError("NRE2265", "invalid 'name' argument");
    }
    const entry = this.#searchPath[index] ?? "";
    this.#searchPath.splice(index, 1);
    this.#userSearchEnvironments.delete(entry);
    if (entry.startsWith("package:")) {
      const record = this.#packages.get(entry.slice("package:".length));
      if (record !== undefined) record.attached = false;
    }
    this.#invalidateSearchEnvironments(true);
    this.#rebuildAttachedSearchBindings();
    return entry;
  }

  #attachedUserSearchBinding(name: string): RBinding | undefined {
    for (const entry of this.#searchPath) {
      const environment = this.#userSearchEnvironments.get(entry);
      const binding = environment?.bindings.get(name);
      if (binding !== undefined) return binding;
    }
    return undefined;
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
      for (const exportedName of runtimePackageExportNames(record)) {
        const binding = runtimePackageExportBinding(record, exportedName);
        if (binding !== undefined) setBinding(environment, exportedName, binding);
      }
      for (const [bindingName, binding] of record.dataEnvironment?.bindings ?? []) {
        setBinding(environment, bindingName, binding);
      }
    }
    const entry = `package:${name}`;
    environment.attributes.set("name", characterVector([entry]));
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
    const user = this.#userSearchEnvironments.get(entry);
    if (user !== undefined) return user;
    this.#ensureSearchEnvironments();
    return this.#searchEnvironments.get(entry);
  }

  #environmentName(environment: REnvironment): string | undefined {
    if (environment === this.#globalEnvironment) return "R_GlobalEnv";
    if (environment === this.#baseEnvironment || environment === this.#baseNamespaceEnvironment) {
      return "base";
    }
    if (environment === this.#emptyEnvironment) return "R_EmptyEnv";
    const namespace = this.#namespaceName(environment);
    if (namespace !== undefined) return namespace;
    for (const [name, candidate] of this.#userSearchEnvironments) {
      if (candidate === environment) return name;
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
      const user = this.#userSearchEnvironments.get(entry);
      if (user !== undefined) {
        for (const [name, binding] of user.bindings) setBinding(environment, name, binding);
      }
      if (entry.startsWith("package:")) {
        const name = entry.slice("package:".length);
        const staticExports = this.#staticNamespaceExports(name);
        const record = this.#packages.get(name);
        const source =
          staticExports === undefined ? record?.namespace : this.#staticNamespaceEnvironment(name);
        const exports =
          staticExports === undefined
            ? record === undefined
              ? []
              : runtimePackageExportNames(record)
            : this.#registeredNamespaceExportNames(name, staticExports);
        if (source !== undefined) {
          for (const exportedName of exports) {
            const binding =
              staticExports === undefined
                ? record === undefined
                  ? undefined
                  : runtimePackageExportBinding(record, exportedName)
                : source.bindings.get(exportedName);
            if (binding !== undefined) setBinding(environment, exportedName, binding);
          }
        }
        if (record !== undefined) {
          for (const [bindingName, binding] of record.dataEnvironment?.bindings ?? []) {
            setBinding(environment, bindingName, binding);
          }
        }
        environment.attributes.set("name", characterVector([entry]));
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
    argumentIndex = 0,
    methodLookupEnvironment = this.#globalEnvironment,
    dispatchGeneric?: string,
    methodArgumentClasses?: readonly (readonly string[])[],
    sourceCall?: CallExpressionNode,
    sourceCallerEnvironment?: REnvironment,
  ): Promise<EvaluationResult | undefined> {
    if (this.#s3DispatchSuppressionDepth > 0) return undefined;
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
        : arguments_.map((argument, index) =>
            index === argumentIndex
              ? {
                  ...argument,
                  promise: createForcedPromise(
                    object,
                    argument.promise.environment,
                    argument.promise.expression,
                  ),
                }
              : argument,
          );
    return this.#invokeS3MethodIfPresentResult(
      generic,
      this.#baseEnvironment,
      runtimeClassNames(object),
      0,
      methodArguments,
      context,
      includeDefault,
      methodLookupEnvironment,
      dispatchGeneric,
      methodArgumentClasses,
      sourceCall,
      sourceCallerEnvironment,
    );
  }

  async #dispatchOperatorS3(
    operator: string,
    operands: readonly RValue[],
    environment: REnvironment,
    spans: readonly SourceSpan[],
    context: EvaluationContext,
  ): Promise<EvaluationResult | undefined> {
    if (this.#s3DispatchSuppressionDepth > 0) return undefined;
    if (!PRIMITIVE_S3_GENERICS.has(operator)) return undefined;
    const arguments_: ClosureCallFrame["arguments"] = operands.map((operand, index) => {
      const span = spans[index];
      return span === undefined
        ? { promise: createForcedPromise(operand, environment) }
        : { promise: createForcedPromise(operand, environment), span };
    });
    if (operands.some((operand) => isVector(operand) && operand.s4 === true)) {
      const binding = lookupBinding(this.#baseEnvironment, operator);
      if (binding !== undefined) {
        const callable = await this.#force(binding, context);
        if (isCallableValue(callable)) {
          return this.#invokeCallableResult(callable, arguments_, context, undefined, environment);
        }
      }
    }
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
          environment,
          generic === "Ops" ? operator : undefined,
          operands.map(runtimeClassNames),
        );
        if (dispatched !== undefined) return dispatched;
      }
    }
    return undefined;
  }

  async #nextS3MethodResult(
    generic: string | undefined,
    object: RValue | undefined,
    extraArguments: readonly BuiltinCallArgument[] | undefined,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const frame = this.#s3DispatchFrames.at(-1);
    if (frame === undefined) {
      throw new REvaluationError("NRE2215", "NextMethod() used outside S3 method dispatch.");
    }
    const activeMethodCall = this.#closureCallFrames.at(-1);
    const arguments_ = frame.arguments.map((argument) => {
      if (activeMethodCall === undefined) return argument;
      const matchedParameter = [...activeMethodCall.matched].find(
        ([, promise]) => promise === argument.promise,
      );
      if (matchedParameter === undefined) return argument;
      const current = lookupBinding(activeMethodCall.environment, matchedParameter[0]);
      if (current === undefined || current.type === "active-binding") return argument;
      return {
        ...argument,
        promise:
          current.type === "promise"
            ? current
            : createForcedPromise(
                current,
                argument.promise.environment,
                argument.promise.expression,
              ),
      };
    });
    if (object !== undefined) {
      const previous = arguments_[0];
      arguments_[0] = {
        ...(previous?.name === undefined ? {} : { name: previous.name }),
        promise: createForcedPromise(
          object,
          previous?.promise.environment ?? this.#globalEnvironment,
        ),
        ...(previous?.span === undefined ? {} : { span: previous.span }),
      };
    }
    for (const argument of extraArguments ?? []) {
      const existing =
        argument.name === undefined
          ? -1
          : arguments_.findIndex((candidate) => candidate.name === argument.name);
      if (existing < 0) arguments_.push(argument);
      else arguments_[existing] = argument;
    }
    const requestedGeneric = generic ?? frame.dispatchGeneric;
    const registryGeneric =
      frame.group.length > 0 && requestedGeneric === frame.dispatchGeneric
        ? frame.generic
        : requestedGeneric;
    const selected = await this.#invokeS3MethodIfPresentResult(
      registryGeneric,
      frame.genericEnvironment,
      frame.classes,
      frame.classIndex + 1,
      arguments_,
      context,
      true,
      frame.methodLookupEnvironment,
      registryGeneric === frame.generic && frame.group.length > 0 ? requestedGeneric : undefined,
    );
    if (selected !== undefined) return selected;
    const effectiveGeneric = requestedGeneric;
    if (registryGeneric === frame.generic && frame.group.length > 0) {
      const genericBinding = lookupBinding(this.#baseEnvironment, effectiveGeneric);
      const genericCallable =
        genericBinding === undefined ? undefined : await this.#force(genericBinding, context);
      if (genericCallable !== undefined && isCallableValue(genericCallable)) {
        const defaultArguments = [...arguments_];
        const firstArgument = defaultArguments[0];
        if (firstArgument !== undefined) {
          const firstValue = await this.#force(firstArgument.promise, context);
          defaultArguments[0] = {
            ...firstArgument,
            promise: createForcedPromise(
              firstValue,
              firstArgument.promise.environment,
              firstArgument.promise.expression,
            ),
          };
        }
        this.#s3DispatchSuppressionDepth += 1;
        try {
          return await this.#invokeCallableResult(
            genericCallable,
            defaultArguments,
            context,
            undefined,
            frame.methodLookupEnvironment,
          );
        } finally {
          this.#s3DispatchSuppressionDepth -= 1;
        }
      }
    }
    const builtinDefaultBinding = lookupBinding(this.#baseEnvironment, effectiveGeneric);
    const builtinDefault =
      builtinDefaultBinding === undefined
        ? undefined
        : await this.#force(builtinDefaultBinding, context);
    if (builtinDefault?.type === "builtin") {
      const defaultArguments = [...arguments_];
      const firstArgument = defaultArguments[0];
      if (firstArgument !== undefined) {
        const firstValue = await this.#force(firstArgument.promise, context);
        if (objectClasses(firstValue) !== undefined) {
          const unclassBinding = lookupBinding(this.#baseEnvironment, "unclass");
          const unclassCallable =
            unclassBinding === undefined ? undefined : await this.#force(unclassBinding, context);
          if (unclassCallable !== undefined && isCallableValue(unclassCallable)) {
            const unclassed = await this.#invokeCallable(
              unclassCallable,
              [{ promise: createForcedPromise(firstValue, frame.methodLookupEnvironment) }],
              context,
            );
            defaultArguments[0] = {
              ...firstArgument,
              promise: createForcedPromise(
                unclassed,
                firstArgument.promise.environment,
                firstArgument.promise.expression,
              ),
            };
          }
        }
      }
      return this.#invokeCallableResult(
        builtinDefault,
        defaultArguments,
        context,
        undefined,
        frame.methodLookupEnvironment,
      );
    }
    if (PRIMITIVE_S3_GENERICS.has(effectiveGeneric)) {
      const primitive = this.#baseEnvironment.bindings.get(effectiveGeneric);
      if (primitive?.type === "builtin") {
        return this.#invokeCallableResult(
          primitive,
          arguments_,
          context,
          undefined,
          frame.methodLookupEnvironment,
        );
      }
    }
    throw new REvaluationError(
      "NRE2216",
      `No applicable method for '${effectiveGeneric}' and classes ${frame.classes.join(", ")}.`,
    );
  }

  async #invokeS3MethodResult(
    generic: string,
    genericEnvironment: REnvironment,
    methodLookupEnvironment: REnvironment,
    classes: readonly string[],
    startIndex: number,
    arguments_: ClosureCallFrame["arguments"],
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const result = await this.#invokeS3MethodIfPresentResult(
      generic,
      genericEnvironment,
      classes,
      startIndex,
      arguments_,
      context,
      true,
      methodLookupEnvironment,
    );
    if (result !== undefined) return result;
    throw new REvaluationError(
      "NRE2216",
      `No applicable method for '${generic}' and classes ${classes.join(", ")}.`,
    );
  }

  async #invokeS3MethodIfPresentResult(
    generic: string,
    genericEnvironment: REnvironment,
    classes: readonly string[],
    startIndex: number,
    arguments_: ClosureCallFrame["arguments"],
    context: EvaluationContext,
    includeDefault = true,
    methodLookupEnvironment = this.#globalEnvironment,
    dispatchGeneric?: string,
    methodArgumentClasses?: readonly (readonly string[])[],
    sourceCall?: CallExpressionNode,
    sourceCallerEnvironment?: REnvironment,
  ): Promise<EvaluationResult | undefined> {
    const end = includeDefault ? classes.length : classes.length - 1;
    for (let index = startIndex; index <= end; index += 1) {
      const className = classes[index];
      const methodName = className === undefined ? `${generic}.default` : `${generic}.${className}`;
      const binding =
        lookupBinding(methodLookupEnvironment, methodName) ??
        this.#registeredS3Methods.get(
          this.#s3RegistrationKey(genericEnvironment, generic, className ?? "default"),
        );
      if (binding === undefined) continue;
      const callable = await this.#force(binding, context);
      const dispatchFrame: S3DispatchFrame = {
        generic,
        dispatchGeneric: dispatchGeneric ?? generic,
        group:
          dispatchGeneric !== undefined && IMPLICIT_S3_GROUP_GENERICS.has(generic) ? generic : "",
        methodNames:
          methodArgumentClasses === undefined
            ? [methodName]
            : methodArgumentClasses.map((argumentClasses) =>
                className !== undefined && argumentClasses.includes(className) ? methodName : "",
              ),
        genericEnvironment,
        methodLookupEnvironment,
        classes,
        classIndex: index,
        arguments: arguments_,
      };
      this.#s3DispatchFrames.push(dispatchFrame);
      try {
        const genericFrame = this.#closureCallFrames.at(-1);
        const genericCall = sourceCall ?? genericFrame?.call;
        const methodCall =
          genericCall === undefined
            ? undefined
            : {
                ...genericCall,
                callee: {
                  kind: "Identifier" as const,
                  name: methodName,
                  span: genericCall.callee.span,
                },
              };
        return await this.#invokeCallableResult(
          callable,
          arguments_,
          context,
          methodCall,
          sourceCallerEnvironment ?? genericFrame?.callerEnvironment,
          dispatchFrame,
        );
      } finally {
        this.#s3DispatchFrames.pop();
      }
    }
    return undefined;
  }

  async #force(binding: RBinding, context: EvaluationContext): Promise<RValue> {
    if (binding.type === "active-binding") {
      return this.#invokeCallable(binding.callable, [], context);
    }
    if (binding.type !== "promise") return binding;
    const packageData = binding.packageData;
    if (packageData !== undefined) {
      if (binding.state === "forced") {
        if (binding.value === undefined) {
          throw new REvaluationError("NRE2011", "A forced promise has no memoized value.");
        }
        this.#invalidateMutableVectorOwnership(binding.value);
        return binding.value;
      }
      if (binding.state === "forcing") {
        throw new REvaluationError("NRE2010", "Promise is already under evaluation.");
      }
      const record = this.#packages.get(packageData.package);
      if (record === undefined) {
        throw new REvaluationError(
          "NRE2221",
          `There is no installed package called '${packageData.package}'.`,
        );
      }
      binding.state = "forcing";
      try {
        const value = await this.#loadPackageDataset(
          record,
          packageData.dataset,
          packageData.resource ?? packageData.dataset,
          binding,
          context,
        );
        binding.value = value;
        binding.state = "forced";
        this.#invalidateMutableVectorOwnership(value);
        return value;
      } catch (error) {
        binding.state = "unforced";
        throw error;
      }
    }
    const value = await forcePromise(binding, async (expression, environment) =>
      this.#evaluateValue(expression, environment, context),
    );
    this.#invalidateMutableVectorOwnership(value);
    return value;
  }

  async #assignBinding(
    environment: REnvironment,
    name: string,
    value: RValue,
    context: EvaluationContext,
    claimMutableVector = false,
  ): Promise<void> {
    const existing = environment.bindings.get(name);
    if (existing?.type !== "active-binding") {
      if (existing !== undefined && existing.type !== "promise") {
        const owner = this.#mutableVectorOwners.get(existing);
        if (owner?.environment === environment && owner.name === name && existing !== value) {
          this.#mutableVectorOwners.delete(existing);
        }
      }
      if (!claimMutableVector) this.#invalidateMutableVectorOwnership(value);
      setBinding(environment, name, value);
      if (
        claimMutableVector &&
        this.#closureCallFrames.some((frame) => frame.environment === environment) &&
        mutableAtomicVector(value)
      ) {
        this.#mutableVectorOwners.set(value, { environment, name });
      }
      return;
    }
    this.#invalidateMutableVectorOwnership(value);
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

  #invalidateMutableVectorOwnership(value: RValue): void {
    this.#mutableVectorOwners.delete(value);
  }

  #ownsMutableVector(value: RValue, environment: REnvironment, name: string): boolean {
    const owner = this.#mutableVectorOwners.get(value);
    return owner?.environment === environment && owner.name === name;
  }

  async #forceDetailed(promise: RPromise, context: EvaluationContext): Promise<EvaluationResult> {
    if (promise.state === "forced") {
      if (promise.value === undefined) {
        throw new REvaluationError("NRE2011", "A forced promise has no memoized value.");
      }
      this.#invalidateMutableVectorOwnership(promise.value);
      return { value: promise.value, visible: true };
    }
    if (promise.packageData !== undefined) {
      return { value: await this.#force(promise, context), visible: true };
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
      this.#invalidateMutableVectorOwnership(result.value);
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
    if (
      (value.type === "language" || value.type === "symbol") &&
      value.capturedPromise !== undefined &&
      this.#closureCallFrames.some(
        (frame) => frame.environment === value.capturedPromise?.environment,
      )
    ) {
      const captured = await this.#forceDetailed(value.capturedPromise, context);
      return this.#evaluateLanguageValueResult(captured.value, environment, context);
    }
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
    const census = censusRuntimeMemory(this.#runtimeMemoryRoots(), () => context.checkpoint());
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

  async #collectGarbage(
    reset: boolean,
    full: boolean,
    context: EvaluationContext,
  ): Promise<RuntimeMemoryStatistics> {
    const reachable = censusRuntimeMemory(this.#runtimeMemoryRoots(), () =>
      context.checkpoint(),
    ).reachableEnvironmentIds;
    await this.#runEnvironmentFinalizers(false, reachable, context);
    return this.#memoryStatistics(reset, full, context);
  }

  #registerEnvironmentFinalizer(
    environment: REnvironment,
    finalizer: RClosure,
    onExit: boolean,
    context: EvaluationContext,
  ): void {
    context.checkpoint();
    if (this.#environmentFinalizers.length >= this.#limits.maxVectorLength) {
      throw new RResourceLimitError("NRL4011", "Environment finalizer registry limit exceeded.", {
        details: { maxVectorLength: this.#limits.maxVectorLength },
      });
    }
    this.#environmentFinalizers.push({ environment, finalizer, onExit });
  }

  async #runEnvironmentFinalizers(
    sessionExit: boolean,
    reachableEnvironmentIds: ReadonlySet<number> | undefined,
    context: EvaluationContext,
  ): Promise<void> {
    const selected = new Set<RegisteredEnvironmentFinalizer>();
    for (const registration of this.#environmentFinalizers) {
      if (
        (sessionExit && registration.onExit) ||
        (!sessionExit && !reachableEnvironmentIds?.has(registration.environment.id))
      ) {
        selected.add(registration);
      }
    }
    if (selected.size === 0) return;

    for (let index = this.#environmentFinalizers.length - 1; index >= 0; index -= 1) {
      const registration = this.#environmentFinalizers[index];
      if (registration !== undefined && selected.has(registration)) {
        this.#environmentFinalizers.splice(index, 1);
      }
    }
    const registrations = [...selected];
    for (let index = registrations.length - 1; index >= 0; index -= 1) {
      const registration = registrations[index];
      if (registration === undefined) continue;
      context.checkpoint();
      try {
        await this.#invokeCallable(
          registration.finalizer,
          [
            {
              promise: createForcedPromise(registration.environment, this.#globalEnvironment),
            },
          ],
          context,
          undefined,
          this.#globalEnvironment,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context.writeOutput({ stream: "stderr", text: `Error in finalizer: ${message}\n` });
      }
    }
  }

  #runtimeMemoryRoots(): readonly unknown[] {
    return [
      this.#globalEnvironment,
      this.#baseNamespaceEnvironment,
      this.#builtinState,
      this.#controlFrames,
      this.#closureCallFrames,
      this.#activeGlobalCallingHandlers,
      this.#registeredS3Methods,
      ...[...this.#packages.values()].map((record) => record.namespace),
      ...[...this.#packages.values()].map((record) => record.dataEnvironment),
      ...[...this.#staticPackages.values()].map((record) => record.namespace),
      ...this.#builtinPackageNamespaces.values(),
    ];
  }

  #lifecycleContext(): EvaluationContext {
    return new EvaluationContext(this.#limits, { cancelled: false }, () =>
      runtimeOutputRouter(this.#builtinState),
    );
  }

  #installBuiltins(): void {
    for (const definition of this.#builtins) {
      const builtin: RBuiltin = {
        type: "builtin",
        definition,
        ...(definition.attributes === undefined
          ? {}
          : { attributes: new Map(definition.attributes) }),
      };
      const packageName = definition.package;
      const environment =
        packageName === "base"
          ? this.#baseEnvironment
          : this.#builtinPackageNamespaces.get(packageName);
      if (environment === undefined) {
        throw new REvaluationError(
          "NRE2254",
          `Builtin package namespace '${packageName}' is not registered.`,
        );
      }
      setBinding(environment, definition.name, builtin);
    }
    const grDevices = this.#builtinPackageNamespaces.get("grDevices");
    const colors = grDevices?.bindings.get("colors");
    if (colors !== undefined && grDevices !== undefined) setBinding(grDevices, "colours", colors);
    const stats = this.#builtinPackageNamespaces.get("stats");
    const optimize = stats?.bindings.get("optimize");
    if (optimize !== undefined && stats !== undefined) setBinding(stats, "optimise", optimize);
    const listObjects = this.#baseEnvironment.bindings.get("ls");
    if (listObjects !== undefined) setBinding(this.#baseEnvironment, "objects", listObjects);
    setBinding(this.#baseEnvironment, "pi", doubleVector([Math.PI]));
    this.#baseEnvironment.lockedBindings.add("pi");
    setBinding(this.#baseEnvironment, "T", logicalVector([1]));
    setBinding(this.#baseEnvironment, "F", logicalVector([0]));
    setBinding(this.#baseEnvironment, ".GlobalEnv", this.#globalEnvironment);
    this.#baseEnvironment.lockedBindings.add(".GlobalEnv");
    setBinding(this.#baseEnvironment, ".BaseNamespaceEnv", this.#baseNamespaceEnvironment);
    this.#baseEnvironment.lockedBindings.add(".BaseNamespaceEnv");
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
    setBinding(
      this.#baseEnvironment,
      "month.abb",
      characterVector([
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ]),
    );
    setBinding(
      this.#baseEnvironment,
      "month.name",
      characterVector([
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ]),
    );
    setBinding(this.#baseEnvironment, ".Machine", machineConstants());
    setBinding(this.#baseEnvironment, ".Platform", platformConstants());
    setBinding(
      this.#baseEnvironment,
      ".leap.seconds",
      withAttribute(
        withClasses(
          doubleVector([
            78796800, 94694400, 126230400, 157766400, 189302400, 220924800, 252460800, 283996800,
            315532800, 362793600, 394329600, 425865600, 489024000, 567993600, 631152000, 662688000,
            709948800, 741484800, 773020800, 820454400, 867715200, 915148800, 1136073600,
            1230768000, 1341100800, 1435708800, 1483228800,
          ]),
          ["POSIXct", "POSIXt"],
        ),
        "tzone",
        characterVector(["GMT"]),
      ),
    );
    const version = rVersionValue();
    setBinding(this.#baseEnvironment, "R.version", version);
    setBinding(this.#baseEnvironment, "version", version);
    this.#baseEnvironment.lockedBindings.add("R.version");
    this.#baseEnvironment.lockedBindings.add("version");
    setBinding(this.#baseEnvironment, ".Library", characterVector([NATIVR_SYSTEM_LIBRARY_PATH]));
    setBinding(this.#baseEnvironment, ".Library.site", characterVector([]));
    const knownS3Generics = [
      "Math",
      "Ops",
      "Summary",
      "Complex",
      "matrixOps",
      "as.character",
      "as.data.frame",
      "as.environment",
      "as.matrix",
      "as.vector",
      "cbind",
      "labels",
      "print",
      "rbind",
      "rep",
      "seq",
      "seq.int",
      "plot",
      "sequence",
      "solve",
      "summary",
      "t",
      "edit",
      "str",
      "contour",
      "hist",
      "identify",
      "image",
      "lines",
      "pairs",
      "points",
      "text",
      "add1",
      "AIC",
      "anova",
      "biplot",
      "coef",
      "confint",
      "deviance",
      "df.residual",
      "drop1",
      "extractAIC",
      "fitted",
      "formula",
      "logLik",
      "model.frame",
      "model.matrix",
      "predict",
      "profile",
      "qqnorm",
      "residuals",
      "se.contrast",
      "terms",
      "update",
      "vcov",
    ];
    setBinding(
      this.#baseEnvironment,
      ".knownS3Generics",
      withNames(characterVector(knownS3Generics.map(() => "base")), knownS3Generics),
    );
    setBinding(
      this.#baseEnvironment,
      ".S3PrimitiveGenerics",
      characterVector([
        "anyNA",
        "as.character",
        "as.complex",
        "as.double",
        "as.environment",
        "as.integer",
        "as.logical",
        "as.call",
        "as.numeric",
        "as.raw",
        "c",
        "dim",
        "dim<-",
        "dimnames",
        "dimnames<-",
        "is.array",
        "is.finite",
        "is.infinite",
        "is.matrix",
        "is.na",
        "is.nan",
        "is.numeric",
        "length",
        "length<-",
        "levels<-",
        "log2",
        "log10",
        "names",
        "names<-",
        "rep",
        "seq.int",
        "xtfrm",
      ]),
    );
    setBinding(this.#baseEnvironment, ".sys.timezone", characterVector([""], [1]));
    this.#baseEnvironment.lockedBindings.add(".sys.timezone");
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

  #installBuiltinS3Methods(): void {
    const genericNames = ["Ops", "$", ...this.#builtins.map(({ name }) => name)].sort(
      (left, right) => right.length - left.length,
    );
    for (const definition of this.#builtins) {
      const generic = genericNames.find((candidate) => definition.name.startsWith(`${candidate}.`));
      if (generic === undefined) continue;
      const className = definition.name.slice(generic.length + 1);
      const packageName = definition.package;
      const namespace =
        packageName === "base"
          ? this.#baseEnvironment
          : this.#builtinPackageNamespaces.get(packageName);
      const method = namespace?.bindings.get(definition.name);
      if (method === undefined) continue;
      this.#setRegisteredS3Method(
        this.#s3RegistrationKey(this.#baseEnvironment, generic, className),
        method,
      );
    }
  }

  #syncBaseNamespaceBindings(): void {
    this.#baseNamespaceEnvironment.locked = false;
    this.#baseNamespaceEnvironment.bindings.clear();
    this.#baseNamespaceEnvironment.lockedBindings.clear();
    for (const [name, binding] of this.#baseEnvironment.bindings) {
      this.#baseNamespaceEnvironment.bindings.set(name, binding);
    }
    for (const name of this.#baseEnvironment.lockedBindings) {
      this.#baseNamespaceEnvironment.lockedBindings.add(name);
    }
    this.#baseNamespaceEnvironment.locked = this.#baseEnvironment.locked;
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

function promiseCallAst(promise: RPromise, fallbackSpan: SourceSpan): AstNode {
  if (promise.expression !== null) return promise.expression;
  if (promise.missing) {
    return {
      kind: "UnsupportedExpression",
      feature: "missing argument",
      span: fallbackSpan,
    };
  }
  if (promise.value !== undefined) return languageValueAst(promise.value);
  throw new RUnsupportedFeatureError(
    "NRU6130",
    "match.call() cannot yet reconstruct a call argument supplied only as a host runtime value.",
    { span: fallbackSpan },
  );
}

function quotePromiseCallAst(promise: RPromise, fallbackSpan: SourceSpan): RValue {
  const value = quoteLanguageAst(promiseCallAst(promise, fallbackSpan));
  return value.type === "language" || value.type === "symbol"
    ? { ...value, capturedPromise: promise }
    : value;
}

function matchCallExpression(
  parameters: readonly FunctionParameter[],
  call: CallExpressionNode,
  sourceArguments: readonly CallArgument[],
  expandDots: boolean,
): RLanguage {
  const dotsIndex = parameters.findIndex((parameter) => parameter.name === "...");
  const hasDots = dotsIndex >= 0;
  const regularParameters = parameters.filter((parameter) => parameter.name !== "...");
  const positionalParameters = hasDots ? parameters.slice(0, dotsIndex) : regularParameters;
  const partialParameters = positionalParameters;
  const matched = new Map<string, CallArgument>();
  const matchedArgumentIndexes = new Set<number>();

  for (const [argumentIndex, argument] of sourceArguments.entries()) {
    if (argument.name === undefined) continue;
    const parameter = regularParameters.find((candidate) => candidate.name === argument.name);
    if (parameter === undefined) continue;
    if (matched.has(parameter.name)) {
      throw new REvaluationError(
        "NRE2004",
        `Formal argument '${parameter.name}' matched by multiple actual arguments.`,
        { span: argument.span },
      );
    }
    matched.set(parameter.name, argument);
    matchedArgumentIndexes.add(argumentIndex);
  }

  for (const [argumentIndex, argument] of sourceArguments.entries()) {
    if (argument.name === undefined || matchedArgumentIndexes.has(argumentIndex)) continue;
    const candidates = partialParameters.filter((parameter) =>
      parameter.name.startsWith(argument.name ?? ""),
    );
    if (candidates.length > 1) {
      throw new REvaluationError(
        "NRE2007",
        `Argument '${argument.name}' matches multiple formal arguments.`,
        { span: argument.span },
      );
    }
    const parameter = candidates[0];
    if (parameter === undefined) continue;
    if (matched.has(parameter.name)) {
      throw new REvaluationError(
        "NRE2004",
        `Formal argument '${parameter.name}' matched by multiple actual arguments.`,
        { span: argument.span },
      );
    }
    matched.set(parameter.name, argument);
    matchedArgumentIndexes.add(argumentIndex);
  }

  let positionalIndex = 0;
  for (const [argumentIndex, argument] of sourceArguments.entries()) {
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
      throw new REvaluationError("NRE2005", "Unused positional argument.", {
        span: argument.span,
      });
    }
    matched.set(parameter.name, argument);
    matchedArgumentIndexes.add(argumentIndex);
    positionalIndex += 1;
  }

  if (!hasDots) {
    const unused = sourceArguments.find(
      (argument, argumentIndex) => !matchedArgumentIndexes.has(argumentIndex),
    );
    if (unused !== undefined) {
      throw new REvaluationError(
        "NRE2005",
        unused.name === undefined
          ? "Unused positional argument."
          : `Unused argument '${unused.name}'.`,
        { span: unused.span },
      );
    }
  }

  const arguments_: CallArgument[] = [];
  for (const parameter of parameters) {
    if (parameter.name !== "...") {
      const argument = matched.get(parameter.name);
      if (argument === undefined) continue;
      arguments_.push({ name: parameter.name, value: argument.value, span: argument.span });
      continue;
    }
    const entries = sourceArguments.filter(
      (_argument, argumentIndex) => !matchedArgumentIndexes.has(argumentIndex),
    );
    if (entries.length === 0) continue;
    if (expandDots) {
      arguments_.push(...entries);
      continue;
    }
    const values = entries.map((entry) => quoteLanguageAst(entry.value));
    const names = entries.map((entry) => entry.name ?? "");
    const pairlist = pairlistValue(values, names);
    const display: CallExpressionNode = {
      kind: "CallExpression",
      callee: { kind: "Identifier", name: "pairlist", span: parameter.span },
      arguments: entries,
      span: parameter.span,
    };
    arguments_.push({
      name: "...",
      value: {
        kind: "ConstantExpression",
        value: pairlist,
        display,
        span: parameter.span,
      },
      span: parameter.span,
    });
  }

  return {
    type: "language",
    expression: { ...call, arguments: Object.freeze(arguments_) },
  };
}

function unsupported(feature: string, span?: SourceSpan): RUnsupportedFeatureError {
  return new RUnsupportedFeatureError(
    "NRU6001",
    `The current NativR subset does not support ${feature}.`,
    span === undefined ? { details: { feature } } : { span, details: { feature } },
  );
}

function runtimeClassNames(value: RValue): readonly string[] {
  const explicit = objectClasses(value);
  if (explicit !== undefined) return explicit;
  if (value.type === "formula") return ["formula"];
  if (value.type === "symbol") return ["name"];
  if (value.type === "language") return ["call"];
  if (value.type === "null") return ["NULL"];
  if (value.type === "expression") return ["expression"];
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
  const targetDimensions = isDataFrame(target) ? [0, 0] : vectorDimensions(target);
  const indexDimensions = vectorDimensions(index);
  return (
    targetDimensions !== undefined &&
    indexDimensions?.length === 2 &&
    indexDimensions[1] === targetDimensions.length
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
  if (node.kind === "UnsupportedExpression" && node.feature === "dots") return "...";
  throw new RTypeMismatchError("NRT3116", `A ${role} must be a static name.`, { span: node.span });
}

function s4SlotPosition(
  target: RValue,
  name: string,
): { readonly target: RList; readonly index: number } {
  if (target.type !== "list" || target.s4 !== true) {
    throw new RTypeMismatchError("NRT3360", "The @ operator requires an S4 object.", {
      details: {
        type: target.type,
        classes: objectClasses(target) ?? [],
        s4: "s4" in target && target.s4 === true,
      },
    });
  }
  const names = target.attributes.get("names");
  const index = names?.type === "character" ? names.values.indexOf(name) : -1;
  if (index < 0) {
    const className = objectClasses(target)?.[0] ?? "S4";
    throw new REvaluationError(
      "NRE2260",
      `No slot of name '${name}' for this object of class '${className}'.`,
    );
  }
  return { target, index };
}

function extractS4Slot(target: RValue, name: string, context: EvaluationContext): RValue {
  if (isVector(target) && target.type !== "list" && target.s4 === true) {
    context.checkpoint();
    if (name === ".Data") {
      const attributes = new Map<string, RValue>();
      for (const structural of ["names", "dim", "dimnames", "tsp"]) {
        const value = target.attributes.get(structural);
        if (value !== undefined) attributes.set(structural, value);
      }
      return { ...target, attributes, s4: false };
    }
    const value = target.attributes.get(name);
    if (value !== undefined) return value;
    const className = objectClasses(target)?.[0] ?? "S4";
    throw new REvaluationError(
      "NRE2260",
      `No slot of name '${name}' for this object of class '${className}'.`,
    );
  }
  const resolved = s4SlotPosition(target, name);
  context.checkpoint();
  return resolved.target.values[resolved.index] ?? R_NULL;
}

function replaceS4Slot(
  target: RValue,
  name: string,
  replacement: RValue,
  context: EvaluationContext,
  state: ReadonlyMap<string, unknown>,
): RValue {
  const validator = state.get(S4_SLOT_REPLACEMENT_VALIDATOR_STATE_KEY) as
    S4SlotReplacementValidator | undefined;
  if (validator !== undefined) validator(target, name, replacement, "@");
  else if (replacement.type === "null") {
    throw new RTypeMismatchError("NRT3361", "An S4 slot cannot be removed with NULL.");
  }
  if (isVector(target) && target.type !== "list" && target.s4 === true) {
    context.checkpoint();
    if (name === ".Data") {
      if (!isVector(replacement)) {
        throw new RTypeMismatchError("NRT3361", "The .Data slot requires a vector value.");
      }
      const attributes = new Map(replacement.attributes);
      for (const [attributeName, value] of target.attributes) {
        if (!["names", "dim", "dimnames", "tsp"].includes(attributeName)) {
          attributes.set(attributeName, value);
        }
      }
      return { ...replacement, attributes, s4: true };
    }
    const attributes = new Map(target.attributes);
    attributes.set(name, replacement);
    return { ...target, attributes };
  }
  const resolved = s4SlotPosition(target, name);
  const values = [...resolved.target.values];
  values[resolved.index] = replacement;
  context.allocate(values.length);
  return { ...resolved.target, values: Object.freeze(values) };
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

function scalarLogicalState(
  value: RValue,
  operator: string,
  span?: SourceSpan,
): boolean | undefined {
  if (
    (operator === "&&" || operator === "||") &&
    isAtomic(value) &&
    value.type !== "character" &&
    value.length === 0
  ) {
    return undefined;
  }
  if (!isAtomic(value) || value.type === "character" || value.length !== 1) {
    throw new RTypeMismatchError(
      "NRT3113",
      `Operator '${operator}' requires one logical or numeric value on each side.`,
      {
        ...(span === undefined ? {} : { span }),
        details: { type: value.type, ...("length" in value ? { length: value.length } : {}) },
      },
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
  if (!isAtomic(value)) {
    throw new RTypeMismatchError("NRT3113", "argument is not interpretable as logical", {
      span,
      details: { type: value.type },
    });
  }
  if (value.length === 0) {
    throw new RTypeMismatchError("NRT3113", "argument is of length zero", {
      span,
      details: { type: value.type, length: value.length },
    });
  }
  if (value.length > 1) {
    throw new RTypeMismatchError("NRT3113", "the condition has length > 1", {
      span,
      details: { type: value.type, length: value.length },
    });
  }
  if (value.type === "character") {
    const item = value.values[0];
    if (item === "TRUE" || item === "T" || item === "true") return true;
    if (item === "FALSE" || item === "F" || item === "false") return false;
    throw new RTypeMismatchError("NRT3113", "argument is not interpretable as logical", {
      span,
      details: { type: value.type, length: value.length },
    });
  }
  const state = scalarLogicalState(value, construct, span);
  if (state === undefined) {
    throw new REvaluationError("NRE2207", "missing value where TRUE/FALSE needed", { span });
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
    case "externalptr":
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
    expression: node,
    ...(response === undefined ? {} : { response }),
    terms: [...new Set(state.terms)],
    variables: [...variables],
    intercept: state.intercept,
    environment,
    attributes: new Map<string, RValue>([
      ["class", characterVector(["formula"])],
      [".Environment", environment],
    ]),
  };
}

function formulaAsLanguage(value: RLanguage | RFormula): RLanguage {
  if (value.type === "language") return value;
  return {
    type: "language",
    expression: value.expression ?? legacyFormulaExpression(value),
    ...(value.attributes === undefined ? {} : { attributes: value.attributes }),
  };
}

function replaceLanguageMember(
  target: RLanguage,
  name: string,
  replacement: RValue,
  context: EvaluationContext,
): RValue {
  const replaced = replaceListMember(languageEntries(target), name, replacement, context);
  if (replaced.type !== "list" && replaced.type !== "pairlist") throw new Error();
  const rebuilt = languageFromEntries(replaced);
  return rebuilt.type === "language" && target.attributes !== undefined
    ? { ...rebuilt, attributes: target.attributes }
    : rebuilt;
}

function isFirstLanguageEntry(index: RValue | undefined): boolean {
  return (
    index !== undefined &&
    (index.type === "integer" || index.type === "double") &&
    index.length === 1 &&
    !isMissing(index, 0) &&
    (index.values[0] ?? 0) === 1
  );
}

function languageTailPairlist(original: RLanguage | RFormula, entries: RValue): RPairlist {
  if (entries.type !== "list" && entries.type !== "pairlist") {
    throw new TypeError("Language replacement must preserve list-like entry storage.");
  }
  const pairlist = pairlistValue(entries.values, vectorNames(entries));
  const originalAttributes = formulaAsLanguage(original).attributes;
  if (originalAttributes === undefined || originalAttributes.size === 0) return pairlist;
  return {
    ...pairlist,
    attributes: new Map([...pairlist.attributes, ...originalAttributes]),
  };
}

function restoreFormulaAfterLanguageReplacement(
  original: RFormula,
  rebuilt: RLanguage | typeof R_NULL,
): RValue {
  if (
    rebuilt.type !== "language" ||
    rebuilt.expression.kind !== "FormulaExpression" ||
    original.environment === null
  ) {
    return rebuilt;
  }
  const normalized = normalizeFormula(rebuilt.expression, original.environment);
  if (normalized.type !== "formula") throw new Error();
  return {
    ...normalized,
    ...(original.attributes === undefined ? {} : { attributes: original.attributes }),
  };
}

function legacyFormulaExpression(
  value: RFormula,
): Extract<AstNode, { readonly kind: "FormulaExpression" }> {
  const terms = value.terms.map((name): AstNode => ({
    kind: "Identifier",
    name,
    span: SYNTHETIC_SOURCE_SPAN,
  }));
  let right: AstNode =
    terms[0] ??
    ({
      kind: "IntegerLiteral",
      value: value.intercept ? 1 : 0,
      span: SYNTHETIC_SOURCE_SPAN,
    } satisfies AstNode);
  for (const term of terms.slice(1)) {
    right = {
      kind: "BinaryExpression",
      operator: "+",
      left: right,
      right: term,
      span: SYNTHETIC_SOURCE_SPAN,
    };
  }
  return {
    kind: "FormulaExpression",
    ...(value.response === undefined
      ? {}
      : {
          left: {
            kind: "Identifier" as const,
            name: value.response,
            span: SYNTHETIC_SOURCE_SPAN,
          },
        }),
    right,
    span: SYNTHETIC_SOURCE_SPAN,
  };
}

function collectFormulaTerms(
  node: AstNode,
  state: { intercept: boolean; terms: string[] },
  sign: 1 | -1,
): void {
  const parenthesized = parenthesizedFormulaBody(node);
  if (parenthesized !== undefined) {
    collectFormulaTerms(parenthesized, state, sign);
    return;
  }
  if (node.kind === "ConstantExpression") {
    collectFormulaTerms(node.display, state, sign);
    return;
  }
  if (node.kind === "NullLiteral") return;
  if (
    node.kind === "UnaryExpression" &&
    (node.operator === "+" || node.operator === "-") &&
    (node.operand.kind === "DoubleLiteral" || node.operand.kind === "IntegerLiteral") &&
    (node.operand.value === 0 || node.operand.value === 1)
  ) {
    collectFormulaTerms(node.operand, state, node.operator === "-" ? (sign === 1 ? -1 : 1) : sign);
    return;
  }
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
    updateFormulaTerms(state, expandedFormulaTerms(node), sign);
    return;
  }
  if (node.kind === "BinaryExpression" && node.operator === ":") {
    updateFormulaTerms(state, expandedFormulaTerms(node), sign);
    return;
  }
  if (node.kind === "BinaryExpression" && node.operator === "/") {
    updateFormulaTerms(state, expandedFormulaTerms(node), sign);
    return;
  }
  updateFormulaTerms(state, [formulaLabel(node)], sign);
}

function expandedFormulaTerms(node: AstNode): string[] {
  const parenthesized = parenthesizedFormulaBody(node);
  if (parenthesized !== undefined) return expandedFormulaTerms(parenthesized);
  if (node.kind === "BinaryExpression" && node.operator === "+") {
    return [...expandedFormulaTerms(node.left), ...expandedFormulaTerms(node.right)];
  }
  if (node.kind === "BinaryExpression" && node.operator === "*") {
    const left = expandedFormulaTerms(node.left);
    const right = expandedFormulaTerms(node.right);
    return [
      ...new Set([
        ...left,
        ...right,
        ...left.flatMap((leftTerm) => right.map((rightTerm) => `${leftTerm}:${rightTerm}`)),
      ]),
    ].sort((leftTerm, rightTerm) => leftTerm.split(":").length - rightTerm.split(":").length);
  }
  if (node.kind === "BinaryExpression" && node.operator === ":") {
    const left = expandedFormulaTerms(node.left);
    const right = expandedFormulaTerms(node.right);
    return left.flatMap((leftTerm) => right.map((rightTerm) => `${leftTerm}:${rightTerm}`));
  }
  if (node.kind === "BinaryExpression" && node.operator === "/") {
    const left = expandedFormulaTerms(node.left);
    const right = expandedFormulaTerms(node.right);
    return [
      ...new Set([
        ...left,
        ...left.flatMap((leftTerm) => right.map((rightTerm) => `${leftTerm}:${rightTerm}`)),
      ]),
    ];
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
    case "ComplexLiteral":
      return `${String(node.imaginary)}i`;
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
    case "CallExpression": {
      const parenthesizedArgument = node.arguments[0];
      if (
        node.callee.kind === "Identifier" &&
        node.callee.name === "(" &&
        node.arguments.length === 1 &&
        parenthesizedArgument !== undefined &&
        parenthesizedArgument.name === undefined
      ) {
        return `(${formulaLabel(parenthesizedArgument.value)})`;
      }
      return `${formulaLabel(node.callee)}(${node.arguments
        .map((argument) =>
          argument.name === undefined
            ? formulaLabel(argument.value)
            : `${argument.name} = ${formulaLabel(argument.value)}`,
        )
        .join(", ")})`;
    }
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
    case "FormulaExpression":
      return node.left === undefined
        ? `~ ${formulaLabel(node.right)}`
        : `${formulaLabel(node.left)} ~ ${formulaLabel(node.right)}`;
    case "PipeExpression":
      return `${formulaLabel(node.left)} ${node.operator} ${formulaLabel(node.right)}`;
    case "ConstantExpression":
      return formulaLabel(node.display);
    case "Program":
    case "Block":
    case "AssignmentExpression":
    case "ReplacementExpression":
    case "FunctionExpression":
    case "IfExpression":
    case "ForExpression":
    case "WhileExpression":
    case "RepeatExpression":
    case "BreakExpression":
    case "NextExpression":
    case "ReturnExpression":
      return deparseAst(node);
    case "UnsupportedExpression":
      if (node.feature === "missing argument") return "";
      throw unsupported(`formula language form (${node.feature})`, node.span);
    default:
      return assertNever(node);
  }
}

function parenthesizedFormulaBody(node: AstNode): AstNode | undefined {
  const argument = node.kind === "CallExpression" ? node.arguments[0] : undefined;
  if (
    node.kind !== "CallExpression" ||
    node.callee.kind !== "Identifier" ||
    node.callee.name !== "(" ||
    node.arguments.length !== 1 ||
    argument === undefined ||
    argument.name !== undefined
  ) {
    return undefined;
  }
  return argument.value;
}

function collectFormulaVariables(node: AstNode, output: Set<string>): void {
  switch (node.kind) {
    case "Program":
    case "Block":
      for (const expression of node.body) collectFormulaVariables(expression, output);
      return;
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
    case "AssignmentExpression":
      if (node.target.name !== ".") output.add(node.target.name);
      collectFormulaVariables(node.value, output);
      return;
    case "ReplacementExpression":
      collectFormulaVariables(node.target, output);
      collectFormulaVariables(node.value, output);
      return;
    case "CallExpression":
      for (const argument of node.arguments) collectFormulaVariables(argument.value, output);
      return;
    case "FunctionExpression":
      for (const parameter of node.parameters) {
        if (parameter.name !== "." && parameter.name !== "...") output.add(parameter.name);
        if (parameter.defaultValue !== undefined) {
          collectFormulaVariables(parameter.defaultValue, output);
        }
      }
      collectFormulaVariables(node.body, output);
      return;
    case "IfExpression":
      collectFormulaVariables(node.condition, output);
      collectFormulaVariables(node.consequence, output);
      if (node.alternative !== undefined) collectFormulaVariables(node.alternative, output);
      return;
    case "ForExpression":
      if (node.variable.kind === "Identifier" && node.variable.name !== ".") {
        output.add(node.variable.name);
      } else {
        collectFormulaVariables(node.variable, output);
      }
      collectFormulaVariables(node.sequence, output);
      collectFormulaVariables(node.body, output);
      return;
    case "WhileExpression":
      collectFormulaVariables(node.condition, output);
      collectFormulaVariables(node.body, output);
      return;
    case "RepeatExpression":
      collectFormulaVariables(node.body, output);
      return;
    case "ReturnExpression":
      if (node.value !== undefined) collectFormulaVariables(node.value, output);
      return;
    case "BreakExpression":
    case "NextExpression":
      return;
    case "SubsetExpression":
      collectFormulaVariables(node.target, output);
      if (node.operator !== "$" && node.operator !== "@") {
        for (const argument of node.arguments) collectFormulaVariables(argument.value, output);
      }
      return;
    case "NamespaceExpression":
    case "DoubleLiteral":
    case "ComplexLiteral":
    case "IntegerLiteral":
    case "StringLiteral":
    case "LogicalLiteral":
    case "NullLiteral":
    case "MissingLiteral":
      return;
    case "FormulaExpression":
      if (node.left !== undefined) collectFormulaVariables(node.left, output);
      collectFormulaVariables(node.right, output);
      return;
    case "PipeExpression":
      collectFormulaVariables(node.left, output);
      collectFormulaVariables(node.right, output);
      return;
    case "ConstantExpression":
      collectFormulaVariables(node.display, output);
      return;
    case "UnsupportedExpression":
      if (node.feature === "missing argument") return;
      throw unsupported(`formula variable language form (${node.feature})`, node.span);
    default:
      return assertNever(node);
  }
}

function memoryReportingTrigger(used: number, previous: number): number {
  if (previous >= used) return previous;
  const target = Math.max(1_024, Math.ceil(used * 1.5));
  return Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(target / 1_024) * 1_024);
}
