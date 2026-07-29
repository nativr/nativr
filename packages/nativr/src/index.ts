export { createR } from "./api.js";
export type {
  AssignOptions,
  CreateRAssets,
  CreateROptions,
  EvalOptions,
  NativRSession,
  PublicEvaluationResult,
  PublicOutputEvent,
} from "./api.js";
export { isNA, NA } from "./conversion.js";
export type { JsInputValue, JsValue, NativRNAValue } from "./conversion.js";
export type { CapabilityManifest, PublicRWarning, RValueSnapshot } from "@nativr/protocol";
export {
  NativRError,
  REvaluationError,
  RParseError,
  RResourceLimitError,
  RRuntimeDisposedError,
  RTypeMismatchError,
  RUnsupportedFeatureError,
} from "@nativr/runtime";
