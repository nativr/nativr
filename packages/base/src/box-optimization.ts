export interface BoxOptimizationEvaluation {
  readonly value: number;
  readonly gradient: Float64Array;
}

export interface BoxOptimizationOptions {
  readonly memory: number;
  readonly relativeReductionFactor: number;
  readonly projectedGradientTolerance: number;
  readonly maxIterations: number;
  readonly maxEvaluations: number;
}

export interface BoxOptimizationResult {
  readonly point: Float64Array;
  readonly value: number;
  readonly gradient: Float64Array;
  readonly functionCount: number;
  readonly gradientCount: number;
  readonly iterations: number;
  readonly converged: boolean;
  readonly reason:
    | "relative-reduction"
    | "projected-gradient"
    | "iteration-limit"
    | "evaluation-limit"
    | "abnormal-termination";
}

export interface BoxOptimizationBackend {
  readonly implementation: "lbfgsb-2.1-wasm";
  minimize(
    initial: Float64Array,
    lower: Float64Array,
    upper: Float64Array,
    evaluate: (
      point: Float64Array,
    ) => BoxOptimizationEvaluation | Promise<BoxOptimizationEvaluation>,
    options: BoxOptimizationOptions,
  ): Promise<BoxOptimizationResult>;
}

export const BOX_OPTIMIZATION_BACKEND_STATE_KEY = "base.boxOptimizationBackend";
