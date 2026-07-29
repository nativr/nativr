import { RResourceLimitError } from "./errors.js";
import type { CancellationToken, OperatorContext, RWarning, RuntimeLimits } from "./values.js";

/** Safe default limits for interactive browser evaluation. */
export const DEFAULT_RUNTIME_LIMITS: RuntimeLimits = Object.freeze({
  maxSteps: 100_000,
  maxCallDepth: 100,
  maxVectorLength: 1_000_000,
  maxOutputBytes: 1_000_000,
});

/** Mutable accounting state for exactly one evaluation. */
export class EvaluationContext implements OperatorContext {
  public readonly limits: RuntimeLimits;
  public readonly cancellation: CancellationToken;
  public readonly warnings: RWarning[] = [];
  public steps = 0;
  public allocatedElements = 0;
  public callDepth = 0;

  public constructor(limits: RuntimeLimits, cancellation: CancellationToken) {
    this.limits = limits;
    this.cancellation = cancellation;
  }

  public checkpoint(cost = 1): void {
    if (this.cancellation.cancelled) {
      throw new RResourceLimitError("NRL4005", "Evaluation was interrupted.");
    }
    this.steps += cost;
    if (this.steps > this.limits.maxSteps) {
      throw new RResourceLimitError("NRL4001", "Evaluation step limit exceeded.", {
        details: { maxSteps: this.limits.maxSteps },
      });
    }
  }

  public allocate(elements: number): void {
    if (!Number.isSafeInteger(elements) || elements < 0) {
      throw new RResourceLimitError("NRL4002", "Invalid vector allocation request.");
    }
    if (elements > this.limits.maxVectorLength) {
      throw new RResourceLimitError("NRL4002", "Vector length limit exceeded.", {
        details: { maxVectorLength: this.limits.maxVectorLength, requested: elements },
      });
    }
    this.allocatedElements += elements;
    if (this.allocatedElements > this.limits.maxVectorLength * 10) {
      throw new RResourceLimitError("NRL4003", "Evaluation allocation budget exceeded.");
    }
  }

  public warn(warning: RWarning): void {
    this.warnings.push(warning);
  }

  public enterCall(): void {
    this.callDepth += 1;
    if (this.callDepth > this.limits.maxCallDepth) {
      this.callDepth -= 1;
      throw new RResourceLimitError("NRL4004", "Maximum call depth exceeded.", {
        details: { maxCallDepth: this.limits.maxCallDepth },
      });
    }
  }

  public leaveCall(): void {
    this.callDepth = Math.max(0, this.callDepth - 1);
  }
}
