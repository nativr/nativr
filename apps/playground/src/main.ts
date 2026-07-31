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
    else if (event.kind === "segments") drawSegments(event);
    else if (event.kind === "points") drawPoints(event);
    else if (event.kind === "polygon") drawPolygons(event);
    else if (event.kind === "box") drawBox(event);
    else if (event.kind === "boxplot") drawBoxplot(event);
    else drawLegend(event);
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

function drawPoints(event: Extract<PublicGraphicsEvent, { readonly kind: "points" }>): void {
  if (graphicsContext === null) return;
  const xScale = graphics.width / (graphicsWindow.xlim[1] - graphicsWindow.xlim[0]);
  const yScale = graphics.height / (graphicsWindow.ylim[1] - graphicsWindow.ylim[0]);
  const context = graphicsContext;
  const polygon = (
    centerX: number,
    centerY: number,
    vertices: readonly (readonly [number, number])[],
  ): void => {
    const first = vertices[0];
    if (first === undefined) return;
    context.beginPath();
    context.moveTo(centerX + first[0], centerY + first[1]);
    for (const vertex of vertices.slice(1)) {
      context.lineTo(centerX + vertex[0], centerY + vertex[1]);
    }
    context.closePath();
  };
  const square = (x: number, y: number, radius: number): void =>
    polygon(x, y, [
      [-radius, -radius],
      [radius, -radius],
      [radius, radius],
      [-radius, radius],
    ]);
  const diamond = (x: number, y: number, radius: number): void =>
    polygon(x, y, [
      [0, -radius],
      [radius, 0],
      [0, radius],
      [-radius, 0],
    ]);
  const triangle = (x: number, y: number, radius: number, upward: boolean): void => {
    const direction = upward ? 1 : -1;
    polygon(x, y, [
      [0, -direction * radius],
      [radius, direction * radius],
      [-radius, direction * radius],
    ]);
  };
  const circle = (x: number, y: number, radius: number): void => {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
  };
  const plus = (x: number, y: number, radius: number): void => {
    context.beginPath();
    context.moveTo(x - radius, y);
    context.lineTo(x + radius, y);
    context.moveTo(x, y - radius);
    context.lineTo(x, y + radius);
    context.stroke();
  };
  const cross = (x: number, y: number, radius: number): void => {
    context.beginPath();
    context.moveTo(x - radius, y - radius);
    context.lineTo(x + radius, y + radius);
    context.moveTo(x - radius, y + radius);
    context.lineTo(x + radius, y - radius);
    context.stroke();
  };

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const point of event.points) {
    const x = (point.x - graphicsWindow.xlim[0]) * xScale;
    const y = graphics.height - (point.y - graphicsWindow.ylim[0]) * yScale;
    const radius = Math.max(1, 4 * point.size);
    context.strokeStyle = point.color;
    context.fillStyle = point.fill;
    context.lineWidth = point.lineWidth;
    if (typeof point.symbol === "string") {
      if (point.symbol === ".") {
        context.fillStyle = point.color;
        const side = Math.max(1, point.size);
        context.fillRect(x - side / 2, y - side / 2, side, side);
      } else {
        context.fillStyle = point.color;
        context.font = `${Math.max(1, 12 * point.size)}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(point.symbol, x, y);
      }
      continue;
    }
    switch (point.symbol) {
      case 0:
        square(x, y, radius);
        context.stroke();
        break;
      case 1:
        circle(x, y, radius);
        context.stroke();
        break;
      case 2:
        triangle(x, y, radius, true);
        context.stroke();
        break;
      case 3:
        plus(x, y, radius);
        break;
      case 4:
        cross(x, y, radius);
        break;
      case 5:
        diamond(x, y, radius);
        context.stroke();
        break;
      case 6:
        triangle(x, y, radius, false);
        context.stroke();
        break;
      case 7:
        square(x, y, radius);
        context.stroke();
        cross(x, y, radius);
        break;
      case 8:
        plus(x, y, radius);
        cross(x, y, radius);
        break;
      case 9:
        diamond(x, y, radius);
        context.stroke();
        plus(x, y, radius);
        break;
      case 10:
        circle(x, y, radius);
        context.stroke();
        plus(x, y, radius);
        break;
      case 11:
        triangle(x, y, radius, true);
        context.stroke();
        triangle(x, y, radius, false);
        context.stroke();
        break;
      case 12:
        square(x, y, radius);
        context.stroke();
        plus(x, y, radius);
        break;
      case 13:
        circle(x, y, radius);
        context.stroke();
        cross(x, y, radius);
        break;
      case 14:
        square(x, y, radius);
        context.stroke();
        triangle(x, y, radius, false);
        context.stroke();
        break;
      case 15:
        context.fillStyle = point.color;
        square(x, y, radius);
        context.fill();
        break;
      case 16:
        context.fillStyle = point.color;
        circle(x, y, radius);
        context.fill();
        break;
      case 17:
        context.fillStyle = point.color;
        triangle(x, y, radius, true);
        context.fill();
        break;
      case 18:
        context.fillStyle = point.color;
        diamond(x, y, radius);
        context.fill();
        break;
      case 19:
        context.fillStyle = point.color;
        circle(x, y, radius);
        context.fill();
        context.stroke();
        break;
      case 20:
        context.fillStyle = point.color;
        circle(x, y, (radius * 2) / 3);
        context.fill();
        break;
      case 21:
        circle(x, y, radius);
        context.fill();
        context.stroke();
        break;
      case 22:
        square(x, y, radius);
        context.fill();
        context.stroke();
        break;
      case 23:
        diamond(x, y, radius);
        context.fill();
        context.stroke();
        break;
      case 24:
        triangle(x, y, radius, true);
        context.fill();
        context.stroke();
        break;
      case 25:
        triangle(x, y, radius, false);
        context.fill();
        context.stroke();
        break;
    }
  }
  context.restore();
}

function drawPolygons(event: Extract<PublicGraphicsEvent, { readonly kind: "polygon" }>): void {
  if (graphicsContext === null) return;
  const xScale = graphics.width / (graphicsWindow.xlim[1] - graphicsWindow.xlim[0]);
  const yScale = graphics.height / (graphicsWindow.ylim[1] - graphicsWindow.ylim[0]);
  graphicsContext.save();
  graphicsContext.lineCap = "round";
  graphicsContext.lineJoin = "round";
  for (const polygon of event.polygons) {
    const firstX = polygon.x[0];
    const firstY = polygon.y[0];
    if (firstX === undefined || firstY === undefined) continue;
    graphicsContext.beginPath();
    graphicsContext.moveTo(
      (firstX - graphicsWindow.xlim[0]) * xScale,
      graphics.height - (firstY - graphicsWindow.ylim[0]) * yScale,
    );
    for (let index = 1; index < polygon.x.length; index += 1) {
      const x = polygon.x[index];
      const y = polygon.y[index];
      if (x === undefined || y === undefined) continue;
      graphicsContext.lineTo(
        (x - graphicsWindow.xlim[0]) * xScale,
        graphics.height - (y - graphicsWindow.ylim[0]) * yScale,
      );
    }
    graphicsContext.closePath();
    if (!polygon.fill.endsWith("00")) {
      graphicsContext.fillStyle = polygon.fill;
      graphicsContext.fill(polygon.fillRule);
    }
    if (!polygon.border.endsWith("00")) {
      const dashScale = Math.max(1, polygon.lineWidth);
      const dashes =
        polygon.lineType === "solid"
          ? []
          : [...polygon.lineType].map((digit) => Number.parseInt(digit, 16) * dashScale);
      graphicsContext.strokeStyle = polygon.border;
      graphicsContext.lineWidth = polygon.lineWidth;
      graphicsContext.setLineDash(dashes);
      graphicsContext.stroke();
    }
  }
  graphicsContext.restore();
}

function drawBox(event: Extract<PublicGraphicsEvent, { readonly kind: "box" }>): void {
  if (graphicsContext === null) return;
  const inset = event.lineWidth / 2;
  const left = inset;
  const right = graphics.width - inset;
  const top = inset;
  const bottom = graphics.height - inset;
  const endpoints = {
    top: [left, top, right, top],
    right: [right, top, right, bottom],
    bottom: [right, bottom, left, bottom],
    left: [left, bottom, left, top],
  } as const;
  const dashScale = Math.max(1, event.lineWidth);
  const dashes =
    event.lineType === "solid"
      ? []
      : [...event.lineType].map((digit) => Number.parseInt(digit, 16) * dashScale);

  graphicsContext.save();
  graphicsContext.strokeStyle = event.color;
  graphicsContext.lineWidth = event.lineWidth;
  graphicsContext.lineCap = "butt";
  graphicsContext.lineJoin = "miter";
  graphicsContext.setLineDash(dashes);
  for (const edge of event.edges) {
    const [x0, y0, x1, y1] = endpoints[edge];
    graphicsContext.beginPath();
    graphicsContext.moveTo(x0, y0);
    graphicsContext.lineTo(x1, y1);
    graphicsContext.stroke();
  }
  graphicsContext.restore();
}

function drawBoxplot(event: Extract<PublicGraphicsEvent, { readonly kind: "boxplot" }>): void {
  if (graphicsContext === null) return;
  const xScale = graphics.width / (graphicsWindow.xlim[1] - graphicsWindow.xlim[0]);
  const yScale = graphics.height / (graphicsWindow.ylim[1] - graphicsWindow.ylim[0]);
  const xPixel = (value: number): number => (value - graphicsWindow.xlim[0]) * xScale;
  const yPixel = (value: number): number =>
    graphics.height - (value - graphicsWindow.ylim[0]) * yScale;

  graphicsContext.save();
  graphicsContext.lineCap = "butt";
  graphicsContext.lineJoin = "miter";
  for (const group of event.groups) {
    const [lowerWhisker, lowerHinge, median, upperHinge, upperWhisker] = group.stats;
    const [lowerConfidence, upperConfidence] = group.confidence;
    const halfWidth = group.width / 2;
    const innerHalfWidth = halfWidth / 2;
    const point = (category: number, value: number): readonly [number, number] =>
      event.horizontal ? [xPixel(value), yPixel(category)] : [xPixel(category), yPixel(value)];
    const body = event.notch
      ? [
          point(group.center - halfWidth, lowerHinge),
          point(group.center - halfWidth, lowerConfidence),
          point(group.center - innerHalfWidth, median),
          point(group.center - halfWidth, upperConfidence),
          point(group.center - halfWidth, upperHinge),
          point(group.center + halfWidth, upperHinge),
          point(group.center + halfWidth, upperConfidence),
          point(group.center + innerHalfWidth, median),
          point(group.center + halfWidth, lowerConfidence),
          point(group.center + halfWidth, lowerHinge),
        ]
      : [
          point(group.center - halfWidth, lowerHinge),
          point(group.center - halfWidth, upperHinge),
          point(group.center + halfWidth, upperHinge),
          point(group.center + halfWidth, lowerHinge),
        ];
    graphicsContext.strokeStyle = group.border;
    graphicsContext.fillStyle = group.fill;
    graphicsContext.lineWidth = group.lineWidth;
    graphicsContext.setLineDash(legendLineDashes(group.lineType, group.lineWidth));
    graphicsContext.beginPath();
    const first = body[0];
    if (first === undefined) continue;
    graphicsContext.moveTo(first[0], first[1]);
    for (const coordinate of body.slice(1)) graphicsContext.lineTo(coordinate[0], coordinate[1]);
    graphicsContext.closePath();
    graphicsContext.fill();
    graphicsContext.stroke();

    const line = (start: readonly [number, number], end: readonly [number, number]): void => {
      graphicsContext?.beginPath();
      graphicsContext?.moveTo(start[0], start[1]);
      graphicsContext?.lineTo(end[0], end[1]);
      graphicsContext?.stroke();
    };
    line(point(group.center, lowerWhisker), point(group.center, lowerHinge));
    line(point(group.center, upperHinge), point(group.center, upperWhisker));
    line(
      point(group.center - innerHalfWidth, lowerWhisker),
      point(group.center + innerHalfWidth, lowerWhisker),
    );
    line(
      point(group.center - innerHalfWidth, upperWhisker),
      point(group.center + innerHalfWidth, upperWhisker),
    );
    line(
      point(group.center - (event.notch ? innerHalfWidth : halfWidth), median),
      point(group.center + (event.notch ? innerHalfWidth : halfWidth), median),
    );
    graphicsContext.setLineDash([]);
    for (const outlier of group.outliers) {
      const [x, y] = point(group.center, outlier);
      graphicsContext.beginPath();
      graphicsContext.arc(x, y, Math.max(2.5, group.lineWidth * 1.5), 0, Math.PI * 2);
      graphicsContext.stroke();
    }
  }
  graphicsContext.restore();
}

function drawLegend(event: Extract<PublicGraphicsEvent, { readonly kind: "legend" }>): void {
  if (graphicsContext === null) return;
  const fontSize = Math.max(8, 13 * event.cex);
  const rowHeight = fontSize * 1.5;
  const symbolWidth = fontSize * 2.4;
  const padding = fontSize * 0.55;
  const rows = Math.ceil(event.entries.length / event.columns);
  graphicsContext.save();
  graphicsContext.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  graphicsContext.textBaseline = "middle";
  const maximumTextWidth = Math.max(
    1,
    ...event.entries.map((entry) => graphicsContext?.measureText(entry.label).width ?? 0),
    event.title === undefined ? 0 : graphicsContext.measureText(event.title).width,
  );
  const columnWidth = symbolWidth + maximumTextWidth + padding;
  const width = event.columns * columnWidth + padding * 2;
  const height = (rows + (event.title === undefined ? 0 : 1)) * rowHeight + padding * 2;
  const [left, top] = legendCanvasTopLeft(event, width, height);

  if (event.box) {
    graphicsContext.fillStyle = event.background;
    graphicsContext.fillRect(left, top, width, height);
    graphicsContext.strokeStyle = "#000000FF";
    graphicsContext.lineWidth = 1;
    graphicsContext.setLineDash([]);
    graphicsContext.strokeRect(left, top, width, height);
  }
  if (event.title !== undefined) {
    graphicsContext.fillStyle = event.entries[0]?.textColor ?? "#000000FF";
    graphicsContext.textAlign = "center";
    graphicsContext.fillText(event.title, left + width / 2, top + padding + rowHeight / 2);
  }
  graphicsContext.textAlign = "left";
  const titleRows = event.title === undefined ? 0 : 1;
  for (let index = 0; index < event.entries.length; index += 1) {
    const entry = event.entries[index];
    if (entry === undefined) continue;
    const column = Math.floor(index / rows);
    const row = index % rows;
    const x = left + padding + column * columnWidth;
    const y = top + padding + (titleRows + row + 0.5) * rowHeight;
    if (entry.lineType !== undefined && entry.lineWidth !== undefined) {
      graphicsContext.beginPath();
      graphicsContext.strokeStyle = entry.color;
      graphicsContext.lineWidth = entry.lineWidth;
      graphicsContext.setLineDash(legendLineDashes(entry.lineType, entry.lineWidth));
      graphicsContext.moveTo(x, y);
      graphicsContext.lineTo(x + symbolWidth * 0.72, y);
      graphicsContext.stroke();
    }
    if (entry.pointSymbol !== undefined) {
      drawLegendPoint(x + symbolWidth * 0.36, y, entry.pointSymbol, entry.color, fontSize);
    }
    graphicsContext.fillStyle = entry.textColor;
    graphicsContext.fillText(entry.label, x + symbolWidth, y);
  }
  graphicsContext.restore();
}

function legendCanvasTopLeft(
  event: Extract<PublicGraphicsEvent, { readonly kind: "legend" }>,
  width: number,
  height: number,
): readonly [number, number] {
  if (event.position.kind === "coordinates") {
    const xScale = graphics.width / (graphicsWindow.xlim[1] - graphicsWindow.xlim[0]);
    const yScale = graphics.height / (graphicsWindow.ylim[1] - graphicsWindow.ylim[0]);
    return [
      (event.position.x - graphicsWindow.xlim[0]) * xScale,
      graphics.height - (event.position.y - graphicsWindow.ylim[0]) * yScale,
    ];
  }
  const insetX = event.position.inset[0] * graphics.width;
  const insetY = event.position.inset[1] * graphics.height;
  const left = event.position.value.endsWith("left")
    ? insetX
    : event.position.value.endsWith("right")
      ? graphics.width - insetX - width
      : (graphics.width - width) / 2;
  const top = event.position.value.startsWith("bottom")
    ? graphics.height - insetY - height
    : event.position.value.startsWith("top")
      ? insetY
      : (graphics.height - height) / 2;
  return [left, top];
}

function legendLineDashes(lineType: string, lineWidth: number): readonly number[] {
  if (lineType === "solid") return [];
  const scale = Math.max(1, lineWidth);
  return [...lineType].map((digit) => Number.parseInt(digit, 16) * scale);
}

function drawLegendPoint(x: number, y: number, symbol: string, color: string, size: number): void {
  if (graphicsContext === null) return;
  graphicsContext.strokeStyle = color;
  graphicsContext.fillStyle = color;
  graphicsContext.lineWidth = Math.max(1, size / 12);
  graphicsContext.setLineDash([]);
  const radius = size * 0.28;
  graphicsContext.beginPath();
  if (symbol === "1") {
    graphicsContext.arc(x, y, radius, 0, Math.PI * 2);
    graphicsContext.stroke();
    return;
  }
  if (symbol === "2") {
    graphicsContext.moveTo(x, y - radius);
    graphicsContext.lineTo(x - radius, y + radius);
    graphicsContext.lineTo(x + radius, y + radius);
    graphicsContext.closePath();
    graphicsContext.stroke();
    return;
  }
  if (symbol === "3" || symbol === "4") {
    const diagonal = symbol === "4";
    const offset = diagonal ? radius / Math.sqrt(2) : radius;
    graphicsContext.moveTo(x - offset, y - (diagonal ? offset : 0));
    graphicsContext.lineTo(x + offset, y + (diagonal ? offset : 0));
    graphicsContext.moveTo(x - (diagonal ? offset : 0), y + offset);
    graphicsContext.lineTo(x + (diagonal ? offset : 0), y - offset);
    graphicsContext.stroke();
    return;
  }
  if (/^\d+$/u.test(symbol)) {
    graphicsContext.arc(x, y, radius, 0, Math.PI * 2);
    graphicsContext.fill();
    return;
  }
  graphicsContext.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  graphicsContext.textAlign = "center";
  graphicsContext.textBaseline = "middle";
  graphicsContext.fillText(symbol, x, y);
  graphicsContext.textAlign = "left";
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
