export interface OptimControls {
  readonly functionScale: number;
  readonly parameterScale: readonly number[];
  readonly derivativeSteps: readonly number[];
  readonly iterationLimit: number;
  readonly absoluteTolerance: number;
  readonly relativeTolerance: number;
  readonly trace: number;
  readonly report: number;
  readonly reflection: number;
  readonly contraction: number;
  readonly expansion: number;
  readonly conjugateGradientType: 1 | 2 | 3;
  readonly temperature: number;
  readonly temperatureIterations: number;
  readonly lbfgsbMemory: number;
  readonly lbfgsbReductionFactor: number;
  readonly lbfgsbProjectedGradientTolerance: number;
}

interface ListLike {
  readonly type: string;
  readonly length: number;
  readonly values: ArrayLike<unknown>;
}

interface NumericLike {
  readonly type: string;
  readonly length: number;
  readonly values: ArrayLike<number>;
  readonly missing?: ArrayLike<number>;
}

export function parseOptimControls(
  value: unknown,
  length: number,
  method: string,
  namesOf: (value: unknown) => readonly string[] | undefined,
  invalid: (message: string) => never,
  unsupported: (message: string) => never,
): OptimControls {
  let functionScale = 1;
  let parameterScale = Array.from({ length }, () => 1);
  let derivativeSteps = Array.from({ length }, () => 1e-3);
  let iterationLimit = method === "Nelder-Mead" ? 500 : method === "SANN" ? 10_000 : 100;
  let absoluteTolerance = Number.NEGATIVE_INFINITY;
  let relativeTolerance = Math.sqrt(Number.EPSILON);
  let trace = 0;
  let report = 10;
  let reflection = 1;
  let contraction = 0.5;
  let expansion = 2;
  let conjugateGradientType: 1 | 2 | 3 = 1;
  let temperature = 10;
  let temperatureIterations = 10;
  let lbfgsbMemory = 5;
  let lbfgsbReductionFactor = 1e7;
  let lbfgsbProjectedGradientTolerance = 0;
  if (value !== undefined) {
    if (!isList(value)) invalid("optim() 'control' must be a list.");
    const names = namesOf(value);
    if (value.length > 0 && names === undefined) invalid("optim() control entries must be named.");
    for (let index = 0; index < value.length; index += 1) {
      const name = names?.[index] ?? "";
      const entry = value.values[index];
      switch (name) {
        case "fnscale":
          functionScale = scalar(entry, name, false, invalid);
          if (functionScale === 0) invalid("optim() control 'fnscale' must be nonzero.");
          break;
        case "parscale":
          parameterScale = vector(entry, name, length, invalid);
          if (parameterScale.some((item) => item <= 0)) invalid("invalid optim() parscale");
          break;
        case "ndeps":
          derivativeSteps = vector(entry, name, length, invalid);
          if (derivativeSteps.some((item) => item <= 0)) invalid("invalid optim() ndeps");
          break;
        case "maxit":
          iterationLimit = scalar(entry, name, false, invalid);
          if (!Number.isInteger(iterationLimit) || iterationLimit < 0 || iterationLimit > 10_000)
            invalid("invalid optim() maxit");
          break;
        case "abstol":
          absoluteTolerance = scalar(entry, name, true, invalid);
          break;
        case "reltol":
          relativeTolerance = scalar(entry, name, false, invalid);
          if (relativeTolerance <= 0) invalid("invalid optim() reltol");
          break;
        case "trace":
          trace = scalar(entry, name, false, invalid);
          if (!Number.isInteger(trace) || trace < 0) invalid("invalid optim() trace");
          if (trace !== 0 && method !== "BFGS") {
            unsupported(`optim(method = "${method}") trace output`);
          }
          break;
        case "REPORT": {
          report = scalar(entry, name, false, invalid);
          if (!Number.isInteger(report) || report <= 0) invalid("invalid optim() REPORT");
          break;
        }
        case "alpha":
          reflection = scalar(entry, name, false, invalid);
          if (reflection <= 0) invalid("invalid optim() alpha");
          break;
        case "beta":
          contraction = scalar(entry, name, false, invalid);
          if (contraction <= 0 || contraction >= 1) invalid("invalid optim() beta");
          break;
        case "gamma":
          expansion = scalar(entry, name, false, invalid);
          if (expansion <= 1) invalid("invalid optim() gamma");
          break;
        case "type": {
          const candidate = scalar(entry, name, false, invalid);
          if (candidate !== 1 && candidate !== 2 && candidate !== 3)
            invalid("invalid optim() CG type");
          if (method === "CG") conjugateGradientType = candidate;
          break;
        }
        case "temp":
          {
            const candidate = scalar(entry, name, false, invalid);
            if (candidate < 0) invalid("invalid optim() temp");
            if (method === "SANN") temperature = candidate;
          }
          break;
        case "tmax":
          {
            const candidate = scalar(entry, name, false, invalid);
            if (candidate < 0) invalid("invalid optim() tmax");
            if (method === "SANN") temperatureIterations = candidate;
          }
          break;
        case "lmm":
          {
            const candidate = scalar(entry, name, false, invalid);
            if (!Number.isInteger(candidate) || candidate < 1) invalid("invalid optim() lmm");
            if (method === "L-BFGS-B") lbfgsbMemory = candidate;
          }
          break;
        case "factr":
          {
            const candidate = scalar(entry, name, false, invalid);
            if (candidate < 0) invalid("invalid optim() factr");
            if (method === "L-BFGS-B") lbfgsbReductionFactor = candidate;
          }
          break;
        case "pgtol":
          {
            const candidate = scalar(entry, name, false, invalid);
            if (candidate < 0) invalid("invalid optim() pgtol");
            if (method === "L-BFGS-B") lbfgsbProjectedGradientTolerance = candidate;
          }
          break;
        case "":
          invalid("optim() control names must be non-empty.");
          break;
        default:
          unsupported(`optim() control '${name}' is unsupported.`);
      }
    }
  }
  return {
    functionScale,
    parameterScale,
    derivativeSteps,
    iterationLimit,
    absoluteTolerance,
    relativeTolerance,
    trace,
    report,
    reflection,
    contraction,
    expansion,
    conjugateGradientType,
    temperature,
    temperatureIterations,
    lbfgsbMemory,
    lbfgsbReductionFactor,
    lbfgsbProjectedGradientTolerance,
  };
}

function isList(value: unknown): value is ListLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "list" &&
    "length" in value &&
    "values" in value
  );
}

function numeric(value: unknown): value is NumericLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value.type === "logical" || value.type === "integer" || value.type === "double") &&
    "length" in value &&
    "values" in value
  );
}

function scalar(
  value: unknown,
  name: string,
  allowInfinity: boolean,
  invalid: (message: string) => never,
): number {
  if (!numeric(value) || value.length !== 1 || value.missing?.[0] === 1)
    invalid(`invalid optim() control '${name}'`);
  const result = value.values[0] ?? Number.NaN;
  if (Number.isNaN(result) || (!allowInfinity && !Number.isFinite(result)))
    invalid(`invalid optim() control '${name}'`);
  return result;
}

function vector(
  value: unknown,
  name: string,
  length: number,
  invalid: (message: string) => never,
): number[] {
  if (!numeric(value) || value.length !== length) invalid(`invalid optim() control '${name}'`);
  const output = Array.from({ length }, (_, index) =>
    value.missing?.[index] === 1 ? Number.NaN : (value.values[index] ?? Number.NaN),
  );
  if (!output.every(Number.isFinite)) invalid(`invalid optim() control '${name}'`);
  return output;
}
