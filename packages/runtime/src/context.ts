import { RResourceLimitError } from "./errors.js";
import type {
  CancellationToken,
  OperatorContext,
  RDataViewEvent,
  RGraphicsEvent,
  ROutput,
  RWarning,
  RuntimeLimits,
} from "./values.js";

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
  public readonly output: ROutput[] = [];
  public readonly dataViews: RDataViewEvent[] = [];
  public readonly graphics: RGraphicsEvent[] = [];
  public steps = 0;
  public allocatedElements = 0;
  public callDepth = 0;
  public outputBytes = 0;
  #warningSuppressionDepth = 0;
  readonly #outputSuppressionDepth = new Map<ROutput["stream"], number>();
  readonly #outputCaptures: {
    readonly streams: ReadonlySet<ROutput["stream"]>;
    readonly output: ROutput[];
    bytes: number;
  }[] = [];

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
    if (this.#warningSuppressionDepth > 0) return;
    this.warnings.push(warning);
  }

  public writeOutput(output: ROutput): void {
    if ((this.#outputSuppressionDepth.get(output.stream) ?? 0) > 0) return;
    const bytes = utf8ByteLength(output.text);
    for (let index = this.#outputCaptures.length - 1; index >= 0; index -= 1) {
      const capture = this.#outputCaptures[index];
      if (capture === undefined || !capture.streams.has(output.stream)) continue;
      const outputBytes = capture.bytes + bytes;
      if (outputBytes > this.limits.maxOutputBytes) {
        throw new RResourceLimitError("NRL4007", "Evaluation output size limit exceeded.", {
          details: { maxOutputBytes: this.limits.maxOutputBytes, outputBytes },
        });
      }
      capture.bytes = outputBytes;
      capture.output.push(output);
      return;
    }
    const outputBytes = this.outputBytes + bytes;
    if (outputBytes > this.limits.maxOutputBytes) {
      throw new RResourceLimitError("NRL4007", "Evaluation output size limit exceeded.", {
        details: { maxOutputBytes: this.limits.maxOutputBytes, outputBytes },
      });
    }
    this.outputBytes = outputBytes;
    this.output.push(output);
  }

  public beginOutputCapture(streams: readonly ROutput["stream"][]): void {
    this.#outputCaptures.push({
      streams: new Set(streams),
      output: [],
      bytes: 0,
    });
  }

  public endOutputCapture(): readonly ROutput[] {
    return this.#outputCaptures.pop()?.output ?? [];
  }

  public writeDataView(event: RDataViewEvent): void {
    const bytes =
      utf8ByteLength(event.title) +
      (event.rowNames ?? []).reduce((total, value) => total + utf8ByteLength(value), 0) +
      event.columns.reduce(
        (total, column) =>
          total +
          utf8ByteLength(column.name) +
          column.values.reduce((sum, value) => sum + utf8ByteLength(value), 0),
        0,
      );
    const outputBytes = this.outputBytes + bytes;
    if (outputBytes > this.limits.maxOutputBytes) {
      throw new RResourceLimitError("NRL4007", "Evaluation output size limit exceeded.", {
        details: { maxOutputBytes: this.limits.maxOutputBytes, outputBytes },
      });
    }
    this.outputBytes = outputBytes;
    this.dataViews.push(event);
  }

  public writeGraphics(event: RGraphicsEvent): void {
    const bytes = graphicsEventByteLength(event);
    const outputBytes = this.outputBytes + bytes;
    if (outputBytes > this.limits.maxOutputBytes) {
      throw new RResourceLimitError("NRL4007", "Evaluation output size limit exceeded.", {
        details: { maxOutputBytes: this.limits.maxOutputBytes, outputBytes },
      });
    }
    this.outputBytes = outputBytes;
    this.graphics.push(event);
  }

  public pushWarningSuppression(): void {
    this.#warningSuppressionDepth += 1;
  }

  public popWarningSuppression(): void {
    this.#warningSuppressionDepth = Math.max(0, this.#warningSuppressionDepth - 1);
  }

  public isWarningSuppressed(): boolean {
    return this.#warningSuppressionDepth > 0;
  }

  public pushOutputSuppression(stream: ROutput["stream"]): void {
    this.#outputSuppressionDepth.set(stream, (this.#outputSuppressionDepth.get(stream) ?? 0) + 1);
  }

  public popOutputSuppression(stream: ROutput["stream"]): void {
    const depth = Math.max(0, (this.#outputSuppressionDepth.get(stream) ?? 0) - 1);
    if (depth === 0) this.#outputSuppressionDepth.delete(stream);
    else this.#outputSuppressionDepth.set(stream, depth);
  }

  public isOutputSuppressed(stream: ROutput["stream"]): boolean {
    return (this.#outputSuppressionDepth.get(stream) ?? 0) > 0;
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

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function graphicsEventByteLength(event: RGraphicsEvent): number {
  if (event.kind === "raster") return event.rgba.byteLength;
  if (event.kind === "segments") return event.segments.length * 64;
  if (event.kind === "box") {
    return (
      64 + event.edges.length * 8 + utf8ByteLength(event.color) + utf8ByteLength(event.lineType)
    );
  }
  if (event.kind === "boxplot") {
    return event.groups.reduce(
      (bytes, group) =>
        bytes +
        192 +
        group.outliers.length * 16 +
        utf8ByteLength(group.label) +
        utf8ByteLength(group.border) +
        utf8ByteLength(group.fill) +
        utf8ByteLength(group.lineType),
      32,
    );
  }
  if (event.kind !== "legend") return 0;
  return (
    64 +
    (event.title === undefined ? 0 : utf8ByteLength(event.title)) +
    event.entries.reduce(
      (bytes, entry) =>
        bytes +
        96 +
        utf8ByteLength(entry.label) +
        utf8ByteLength(entry.textColor) +
        utf8ByteLength(entry.color) +
        (entry.lineType === undefined ? 0 : utf8ByteLength(entry.lineType)) +
        (entry.pointSymbol === undefined ? 0 : utf8ByteLength(entry.pointSymbol)),
      0,
    )
  );
}
