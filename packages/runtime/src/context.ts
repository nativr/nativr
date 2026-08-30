import { REvaluationError, RResourceLimitError } from "./errors.js";
import type {
  CancellationToken,
  OperatorContext,
  RBrowseEvent,
  RDataViewEvent,
  RGraphicsEvent,
  ROutput,
  RuntimeOutputRouter,
  RWarning,
  RuntimeLimits,
} from "./values.js";

/** Safe default limits for interactive browser evaluation. */
export const DEFAULT_RUNTIME_LIMITS: RuntimeLimits = Object.freeze({
  maxSteps: 100_000,
  maxCallDepth: 100,
  maxVectorLength: 1_000_000,
  maxAllocatedElements: 10_000_000,
  maxOutputBytes: 1_000_000,
  maxPackageResourceBytes: 192 * 1024 * 1024,
});

/** Named, reviewable resource budgets for common browser-runtime workloads. */
export type RuntimeProfile = "interactive-safe" | "package-test" | "large-browser";

export const RUNTIME_LIMIT_PROFILES: Readonly<Record<RuntimeProfile, RuntimeLimits>> =
  Object.freeze({
    "interactive-safe": DEFAULT_RUNTIME_LIMITS,
    "package-test": Object.freeze({
      maxSteps: 100_000_000,
      maxCallDepth: 200,
      maxVectorLength: 4_000_000,
      maxAllocatedElements: 750_000_000,
      maxOutputBytes: 32_000_000,
      maxPackageResourceBytes: 256 * 1024 * 1024,
    }),
    "large-browser": Object.freeze({
      maxSteps: 10_000_000,
      maxCallDepth: 250,
      maxVectorLength: 10_000_000,
      maxAllocatedElements: 100_000_000,
      maxOutputBytes: 64_000_000,
      maxPackageResourceBytes: 512 * 1024 * 1024,
    }),
  });

/** Mutable accounting state for exactly one evaluation. */
export class EvaluationContext implements OperatorContext {
  public readonly limits: RuntimeLimits;
  public readonly cancellation: CancellationToken;
  public readonly warnings: RWarning[] = [];
  public readonly output: ROutput[] = [];
  public readonly dataViews: RDataViewEvent[] = [];
  public readonly browseRequests: RBrowseEvent[] = [];
  public readonly graphics: RGraphicsEvent[] = [];
  public steps = 0;
  public allocatedElements = 0;
  public callDepth = 0;
  public outputBytes = 0;
  #warningSuppressionDepth = 0;
  #cpuDeadline = Number.POSITIVE_INFINITY;
  #elapsedDeadline = Number.POSITIVE_INFINITY;
  #transientTimeLimit = false;
  readonly #interruptModes: ("suspend" | "allow")[] = [];
  readonly #outputSuppressionDepth = new Map<ROutput["stream"], number>();
  readonly #outputCaptures: {
    readonly streams: ReadonlySet<ROutput["stream"]>;
    readonly output: ROutput[];
    bytes: number;
  }[] = [];
  readonly #warningCaptures: RWarning[][] = [];
  readonly #outputRouter: (() => RuntimeOutputRouter | undefined) | undefined;

  public constructor(
    limits: RuntimeLimits,
    cancellation: CancellationToken,
    outputRouter?: () => RuntimeOutputRouter | undefined,
  ) {
    this.limits = limits;
    this.cancellation = cancellation;
    this.#outputRouter = outputRouter;
  }

  public checkpoint(cost = 1): void {
    if (this.cancellation.cancelled && this.#interruptModes.at(-1) !== "suspend") {
      throw new RResourceLimitError("NRL4005", "Evaluation was interrupted.");
    }
    const now = Date.now();
    if (now >= this.#elapsedDeadline) {
      if (this.#transientTimeLimit) this.#clearTimeLimit();
      throw new REvaluationError("NRE2260", "reached elapsed time limit");
    }
    if (now >= this.#cpuDeadline) {
      if (this.#transientTimeLimit) this.#clearTimeLimit();
      throw new REvaluationError("NRE2260", "reached CPU time limit");
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
    if (this.allocatedElements > this.limits.maxAllocatedElements) {
      throw new RResourceLimitError("NRL4003", "Evaluation allocation budget exceeded.", {
        details: {
          maxAllocatedElements: this.limits.maxAllocatedElements,
          allocatedElements: this.allocatedElements,
        },
      });
    }
  }

  public warn(warning: RWarning): void {
    if (this.#warningSuppressionDepth > 0) return;
    const capture = this.#warningCaptures.at(-1);
    if (capture !== undefined) {
      capture.push(warning);
      return;
    }
    this.warnings.push(warning);
  }

  public beginWarningCapture(): void {
    this.#warningCaptures.push([]);
  }

  public endWarningCapture(): readonly RWarning[] {
    const capture = this.#warningCaptures.pop();
    if (capture === undefined) {
      throw new Error("No warning capture is active.");
    }
    return capture;
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
    const outputRouter = this.#outputRouter?.();
    if (outputRouter !== undefined && !outputRouter.routeOutput(output, this.limits)) {
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
    this.#outputCaptures.push({ streams: new Set(streams), output: [], bytes: 0 });
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

  public writeBrowse(event: RBrowseEvent): void {
    const bytes =
      utf8ByteLength(event.url) +
      (event.kind === "file" ? utf8ByteLength(event.mimeType) + event.bytes.byteLength : 0);
    const outputBytes = this.outputBytes + bytes;
    if (outputBytes > this.limits.maxOutputBytes) {
      throw new RResourceLimitError("NRL4007", "Evaluation output size limit exceeded.", {
        details: { maxOutputBytes: this.limits.maxOutputBytes, outputBytes },
      });
    }
    this.outputBytes = outputBytes;
    this.browseRequests.push(event);
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

  public pushInterruptMode(mode: "suspend" | "allow"): void {
    this.#interruptModes.push(mode);
  }

  public popInterruptMode(): void {
    this.#interruptModes.pop();
  }

  public configureTimeLimit(cpuSeconds: number, elapsedSeconds: number, transient: boolean): void {
    const now = Date.now();
    this.#cpuDeadline =
      cpuSeconds > 0 && Number.isFinite(cpuSeconds)
        ? now + cpuSeconds * 1_000
        : Number.POSITIVE_INFINITY;
    this.#elapsedDeadline =
      elapsedSeconds > 0 && Number.isFinite(elapsedSeconds)
        ? now + elapsedSeconds * 1_000
        : Number.POSITIVE_INFINITY;
    this.#transientTimeLimit = transient;
  }

  #clearTimeLimit(): void {
    this.#cpuDeadline = Number.POSITIVE_INFINITY;
    this.#elapsedDeadline = Number.POSITIVE_INFINITY;
    this.#transientTimeLimit = false;
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
  if (event.kind === "points") {
    return event.points.reduce(
      (bytes, point) =>
        bytes +
        96 +
        (typeof point.symbol === "string" ? utf8ByteLength(point.symbol) : 8) +
        utf8ByteLength(point.color) +
        utf8ByteLength(point.fill),
      32,
    );
  }
  if (event.kind === "text") {
    return event.labels.reduce(
      (bytes, label) =>
        bytes +
        128 +
        utf8ByteLength(label.label) +
        utf8ByteLength(label.color) +
        utf8ByteLength(label.family),
      32,
    );
  }
  if (event.kind === "polygon") {
    return event.polygons.reduce(
      (bytes, polygon) =>
        bytes +
        96 +
        (polygon.x.length + polygon.y.length) * 8 +
        utf8ByteLength(polygon.fill) +
        utf8ByteLength(polygon.border) +
        utf8ByteLength(polygon.lineType),
      32,
    );
  }
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
        (entry.fill === undefined ? 0 : utf8ByteLength(entry.fill)) +
        (entry.border === undefined ? 0 : utf8ByteLength(entry.border)) +
        (entry.lineType === undefined ? 0 : utf8ByteLength(entry.lineType)) +
        (entry.pointSymbol === undefined ? 0 : utf8ByteLength(entry.pointSymbol)),
      0,
    )
  );
}
