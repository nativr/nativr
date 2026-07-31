import { createR, isComplex, isNA, isRaw } from "@nativr/nativr";
import type {
  NativRSession,
  PublicDataViewEvent,
  PublicGraphicsEvent,
  PublicOutputEvent,
  PublicRWarning,
} from "@nativr/nativr";

import "./styles.css";

interface Example {
  readonly id: string;
  readonly label: string;
  readonly code: string;
  readonly setup?: (runtime: NativRSession) => Promise<void>;
}

const examples: readonly Example[] = [
  { id: "arithmetic", label: "Scalar arithmetic", code: "1 + 1" },
  {
    id: "mean",
    label: "Vector mean",
    code: "x <- c(1, 2, 3, 4, 5)\nmean(x)",
  },
  {
    id: "missing",
    label: "Missing values",
    code: "x <- c(1, NA, 3)\nmean(x, na.rm = TRUE)",
  },
  {
    id: "recycling",
    label: "Recycling warning",
    code: "c(1, 2, 3) + c(10, 20)",
  },
  {
    id: "closure",
    label: "Function + closure",
    code: "f <- function(x) x ^ 2\nf(4)",
  },
  {
    id: "assignment",
    label: "JavaScript assignment",
    code: "mean(x)",
    setup: async (runtime) => {
      await runtime.assign("x", new Float64Array([1, 2, 3, 4]));
    },
  },
  {
    id: "output",
    label: "Print + cat output",
    code: 'print(c(alpha = 1, beta = 2))\ncat("mean =", mean(c(1, 2, 3)), "\\n")',
  },
  {
    id: "raster",
    label: "Browser raster graphic",
    code: "plot.new()\nplot.window(c(0, 2), c(0, 2), asp = 1)\nrasterImage(matrix(c(0, 1, 1, 0), 2, 2), 0, 0, 2, 2, interpolate = FALSE)",
  },
  {
    id: "view",
    label: "Browser data viewer",
    code: "measurements <- data.frame(sample = c('A', 'B', 'C'), value = c(1.2, NA, 3.4))\nView(measurements, 'Measurements')",
  },
];

const source = element<HTMLTextAreaElement>("source");
const runButton = element<HTMLButtonElement>("run");
const resetButton = element<HTMLButtonElement>("reset");
const interruptButton = element<HTMLButtonElement>("interrupt");
const result = element<HTMLElement>("result");
const consoleOutput = element<HTMLElement>("console-output");
const elapsed = element<HTMLElement>("elapsed");
const warnings = element<HTMLElement>("warnings");
const errors = element<HTMLElement>("errors");
const warningCount = element<HTMLElement>("warning-count");
const errorCount = element<HTMLElement>("error-count");
const status = element<HTMLElement>("runtime-status");
const statusDot = element<HTMLElement>("status-dot");
const exampleList = element<HTMLElement>("example-list");
const graphics = element<HTMLCanvasElement>("graphics");
const graphicsEmpty = element<HTMLElement>("graphics-empty");
const graphicsCount = element<HTMLElement>("graphics-count");
const graphicsContext = graphics.getContext("2d");
const dataViews = element<HTMLElement>("data-views");
const dataViewCount = element<HTMLElement>("data-view-count");

let runtime: NativRSession | undefined;
let selected = examples[1] ?? examples[0];
let graphicsWindow: {
  readonly xlim: readonly [number, number];
  readonly ylim: readonly [number, number];
} = { xlim: [0, 1], ylim: [0, 1] };

renderExamples();
selectExample(selected);
void initialize();

runButton.addEventListener("click", () => void run());
resetButton.addEventListener("click", () => void reset());
interruptButton.addEventListener("click", () => void interrupt());
source.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    void run();
  }
});

async function initialize(): Promise<void> {
  setStatus("loading", "Loading parser + Worker…");
  try {
    runtime = await createR();
    enableControls(true);
    setStatus("ready", "Runtime ready");
  } catch (error) {
    setStatus("error", "Initialization failed");
    renderError(error);
  }
}

async function run(): Promise<void> {
  if (runtime === undefined) return;
  clearMessages();
  resetDataViews();
  setBusy(true);
  result.textContent = "Evaluating…";
  elapsed.textContent = "—";
  try {
    if (selected?.setup !== undefined) await selected.setup(runtime);
    const evaluation = await runtime.evalDetailed(source.value);
    result.textContent = formatValue(evaluation.value);
    renderOutput(evaluation.output);
    renderGraphics(evaluation.graphics);
    renderDataViews(evaluation.dataViews);
    elapsed.textContent = `${evaluation.elapsedMs.toFixed(1)} ms`;
    renderWarnings(evaluation.warnings);
    setStatus("ready", "Evaluation complete");
  } catch (error) {
    result.textContent = "Evaluation failed.";
    renderError(error);
    setStatus("error", "Evaluation failed");
  } finally {
    setBusy(false);
  }
}

async function reset(): Promise<void> {
  if (runtime === undefined) return;
  try {
    await runtime.reset();
    result.textContent = "Session reset. User bindings were cleared.";
    consoleOutput.textContent = "No textual output.";
    elapsed.textContent = "—";
    clearMessages();
    resetGraphics();
    resetDataViews();
    setStatus("ready", "Session reset");
  } catch (error) {
    renderError(error);
  }
}

async function interrupt(): Promise<void> {
  if (runtime === undefined) return;
  try {
    await runtime.interrupt();
    result.textContent = "Evaluation interrupted. Worker state was reset.";
    resetGraphics();
    resetDataViews();
    setStatus("ready", "Worker restarted");
  } catch (error) {
    renderError(error);
  }
}

function renderExamples(): void {
  for (const example of examples) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.example = example.id;
    button.textContent = example.label;
    button.addEventListener("click", () => selectExample(example));
    exampleList.append(button);
  }
}

function selectExample(example: Example | undefined): void {
  if (example === undefined) return;
  selected = example;
  source.value = example.code;
  for (const button of exampleList.querySelectorAll("button")) {
    const active = button.getAttribute("data-example") === example.id;
    button.setAttribute("aria-pressed", String(active));
  }
  source.focus();
}

function renderWarnings(items: readonly PublicRWarning[]): void {
  warnings.replaceChildren();
  warningCount.textContent = String(items.length);
  if (items.length === 0) {
    warnings.append(emptyMessage("No warnings."));
    return;
  }
  for (const warning of items) {
    const item = document.createElement("p");
    item.className = "message warning";
    item.textContent = `${warning.code} · ${warning.message}`;
    warnings.append(item);
  }
}

function renderOutput(items: readonly PublicOutputEvent[]): void {
  consoleOutput.textContent =
    items.length === 0 ? "No textual output." : items.map((item) => item.text).join("");
}

function renderGraphics(events: readonly PublicGraphicsEvent[]): void {
  graphicsCount.textContent = String(events.length);
  if (events.length === 0 || graphicsContext === null) return;
  graphicsEmpty.hidden = true;
  for (const event of events) {
    if (event.kind === "new-page") {
      graphicsContext.save();
      graphicsContext.setTransform(1, 0, 0, 1, 0, 0);
      graphicsContext.clearRect(0, 0, graphics.width, graphics.height);
      graphicsContext.fillStyle = "white";
      graphicsContext.fillRect(0, 0, graphics.width, graphics.height);
      graphicsContext.restore();
      graphicsWindow = { xlim: [0, 1], ylim: [0, 1] };
      continue;
    }
    if (event.kind === "window") {
      graphicsWindow = event;
      continue;
    }
    if (event.kind === "raster") drawRaster(event);
    else drawSegments(event);
  }
}

function renderDataViews(events: readonly PublicDataViewEvent[]): void {
  dataViews.replaceChildren();
  dataViewCount.textContent = String(events.length);
  if (events.length === 0) {
    dataViews.append(emptyMessage("No data-view events."));
    return;
  }
  for (const event of events) {
    const section = document.createElement("section");
    section.className = "data-view";
    const title = document.createElement("h3");
    title.textContent = event.title;
    const scroller = document.createElement("div");
    scroller.className = "data-view-scroll";
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    if (event.rowNames !== undefined) {
      const rowNameHeader = document.createElement("th");
      rowNameHeader.scope = "col";
      rowNameHeader.textContent = "row.names";
      headerRow.append(rowNameHeader);
    }
    for (const column of event.columns) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = column.name;
      headerRow.append(cell);
    }
    head.append(headerRow);
    table.append(head);
    const body = document.createElement("tbody");
    const rowCount = event.columns[0]?.values.length ?? event.rowNames?.length ?? 0;
    for (let row = 0; row < rowCount; row += 1) {
      const tableRow = document.createElement("tr");
      if (event.rowNames !== undefined) {
        const rowName = document.createElement("th");
        rowName.scope = "row";
        rowName.textContent = event.rowNames[row] ?? String(row + 1);
        tableRow.append(rowName);
      }
      for (const column of event.columns) {
        const cell = document.createElement("td");
        cell.textContent = column.values[row] ?? "";
        tableRow.append(cell);
      }
      body.append(tableRow);
    }
    table.append(body);
    scroller.append(table);
    section.append(title, scroller);
    dataViews.append(section);
  }
}

function drawRaster(event: Extract<PublicGraphicsEvent, { readonly kind: "raster" }>): void {
  if (graphicsContext === null) return;
  const bitmap = document.createElement("canvas");
  bitmap.width = event.width;
  bitmap.height = event.height;
  const bitmapContext = bitmap.getContext("2d");
  if (bitmapContext === null) return;
  const pixels = new ImageData(
    new Uint8ClampedArray(event.rgba.buffer, event.rgba.byteOffset, event.rgba.byteLength).slice(),
    event.width,
    event.height,
  );
  bitmapContext.putImageData(pixels, 0, 0);

  const xScale = graphics.width / (graphicsWindow.xlim[1] - graphicsWindow.xlim[0]);
  const yScale = graphics.height / (graphicsWindow.ylim[1] - graphicsWindow.ylim[0]);
  const anchorX = (event.xleft - graphicsWindow.xlim[0]) * xScale;
  const anchorY = graphics.height - (event.ybottom - graphicsWindow.ylim[0]) * yScale;
  const width = event.xright - event.xleft;
  const height = event.ytop - event.ybottom;
  const radians = (event.angle * Math.PI) / 180;
  const ux = xScale * Math.cos(radians) * width;
  const uy = -yScale * Math.sin(radians) * width;
  const vx = -xScale * Math.sin(radians) * height;
  const vy = -yScale * Math.cos(radians) * height;

  graphicsContext.save();
  graphicsContext.imageSmoothingEnabled = event.interpolate;
  graphicsContext.setTransform(
    ux / event.width,
    uy / event.width,
    -vx / event.height,
    -vy / event.height,
    anchorX + vx,
    anchorY + vy,
  );
  graphicsContext.drawImage(bitmap, 0, 0);
  graphicsContext.restore();
}

function drawSegments(event: Extract<PublicGraphicsEvent, { readonly kind: "segments" }>): void {
  if (graphicsContext === null) return;
  const xScale = graphics.width / (graphicsWindow.xlim[1] - graphicsWindow.xlim[0]);
  const yScale = graphics.height / (graphicsWindow.ylim[1] - graphicsWindow.ylim[0]);
  graphicsContext.save();
  graphicsContext.lineCap = "round";
  graphicsContext.lineJoin = "round";
  for (const segment of event.segments) {
    const dashScale = Math.max(1, segment.lineWidth);
    const dashes =
      segment.lineType === "solid"
        ? []
        : [...segment.lineType].map((digit) => Number.parseInt(digit, 16) * dashScale);
    graphicsContext.beginPath();
    graphicsContext.strokeStyle = segment.color;
    graphicsContext.lineWidth = segment.lineWidth;
    graphicsContext.setLineDash(dashes);
    graphicsContext.moveTo(
      (segment.x0 - graphicsWindow.xlim[0]) * xScale,
      graphics.height - (segment.y0 - graphicsWindow.ylim[0]) * yScale,
    );
    graphicsContext.lineTo(
      (segment.x1 - graphicsWindow.xlim[0]) * xScale,
      graphics.height - (segment.y1 - graphicsWindow.ylim[0]) * yScale,
    );
    graphicsContext.stroke();
  }
  graphicsContext.restore();
}

function resetGraphics(): void {
  graphicsCount.textContent = "0";
  graphicsEmpty.hidden = false;
  graphicsWindow = { xlim: [0, 1], ylim: [0, 1] };
  graphicsContext?.clearRect(0, 0, graphics.width, graphics.height);
}

function resetDataViews(): void {
  dataViewCount.textContent = "0";
  dataViews.replaceChildren(emptyMessage("No data-view events."));
}

function renderError(error: unknown): void {
  errors.replaceChildren();
  errorCount.textContent = "1";
  const item = document.createElement("p");
  item.className = "message error";
  if (error instanceof Error) {
    const code =
      "code" in error && typeof (error as { readonly code?: unknown }).code === "string"
        ? `${(error as { readonly code: string }).code} · `
        : "";
    item.textContent = `${code}${error.message}`;
  } else {
    item.textContent = String(error);
  }
  errors.append(item);
}

function clearMessages(): void {
  consoleOutput.textContent = "No textual output.";
  warnings.replaceChildren(emptyMessage("No warnings."));
  errors.replaceChildren(emptyMessage("No errors."));
  warningCount.textContent = "0";
  errorCount.textContent = "0";
}

function emptyMessage(text: string): HTMLParagraphElement {
  const item = document.createElement("p");
  item.className = "empty";
  item.textContent = text;
  return item;
}

function formatValue(value: unknown): string {
  if (isNA(value)) return "NA";
  if (isComplex(value)) {
    return `${String(value.real)}${value.imaginary < 0 ? "" : "+"}${String(value.imaginary)}i`;
  }
  if (isRaw(value)) {
    return Array.from(value.bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
  }
  if (typeof value === "number" && Number.isNaN(value)) return "NaN";
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatValue(item)).join(", ")}]`;
  }
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function setBusy(busy: boolean): void {
  runButton.disabled = busy;
  interruptButton.disabled = !busy;
  resetButton.disabled = busy;
  if (busy) setStatus("running", "Evaluating in Worker…");
}

function enableControls(enabled: boolean): void {
  runButton.disabled = !enabled;
  resetButton.disabled = !enabled;
  interruptButton.disabled = true;
}

function setStatus(state: "loading" | "ready" | "running" | "error", text: string): void {
  status.textContent = text;
  statusDot.dataset.state = state;
}

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (value === null) throw new Error(`Missing required playground element #${id}`);
  return value as T;
}
