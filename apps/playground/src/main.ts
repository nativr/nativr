import { createR, isNA } from "nativr";
import type { NativRSession, PublicRWarning } from "nativr";

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
];

const source = element<HTMLTextAreaElement>("source");
const runButton = element<HTMLButtonElement>("run");
const resetButton = element<HTMLButtonElement>("reset");
const interruptButton = element<HTMLButtonElement>("interrupt");
const result = element<HTMLElement>("result");
const elapsed = element<HTMLElement>("elapsed");
const warnings = element<HTMLElement>("warnings");
const errors = element<HTMLElement>("errors");
const warningCount = element<HTMLElement>("warning-count");
const errorCount = element<HTMLElement>("error-count");
const status = element<HTMLElement>("runtime-status");
const statusDot = element<HTMLElement>("status-dot");
const exampleList = element<HTMLElement>("example-list");

let runtime: NativRSession | undefined;
let selected = examples[1] ?? examples[0];

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
  setBusy(true);
  result.textContent = "Evaluating…";
  elapsed.textContent = "—";
  try {
    if (selected?.setup !== undefined) await selected.setup(runtime);
    const evaluation = await runtime.evalDetailed(source.value);
    result.textContent = formatValue(evaluation.value);
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
    elapsed.textContent = "—";
    clearMessages();
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
