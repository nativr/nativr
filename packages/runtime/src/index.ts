export { EvaluationContext, DEFAULT_RUNTIME_LIMITS } from "./context.js";
export {
  createEnvironment,
  createForcedPromise,
  createPromise,
  forcePromise,
  lookupBinding,
  setBinding,
} from "./environment.js";
export {
  NativRError,
  REvaluationError,
  RParseError,
  RResourceLimitError,
  RRuntimeDisposedError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
} from "./errors.js";
export type { NativRErrorOptions } from "./errors.js";
export { Evaluator } from "./evaluator.js";
export type { DetailedEvaluationResult, EvaluationResult, EvaluatorOptions } from "./evaluator.js";
export {
  characterVector,
  doubleVector,
  integerVector,
  isAtomic,
  isMissing,
  listValue,
  logicalVector,
  missingValue,
  R_NULL,
} from "./values.js";
export type {
  BuiltinCallArgument,
  BuiltinDefinition,
  BuiltinInvocation,
  BuiltinKind,
  BuiltinMetadata,
  CancellationToken,
  OperatorContext,
  RAttributes,
  RBuiltin,
  RBinding,
  RCharacterVector,
  RClosure,
  RDoubleVector,
  REnvironment,
  RIntegerVector,
  RList,
  RLogicalVector,
  RNull,
  RPromise,
  RuntimeLimits,
  RuntimeOperators,
  RValue,
  RVectorBase,
  RWarning,
} from "./values.js";
