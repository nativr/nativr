export interface OrderedOutputEvent {
  readonly stream: "stdout" | "stderr";
  readonly text: string;
}

export type OrderedOutputStatus =
  "complete" | "incomplete" | "inconsistent" | "ambiguous" | "unbounded" | "undecodable";

export type OrderedOutputAlignment =
  | { readonly status: "complete"; readonly events: readonly OrderedOutputEvent[] }
  | { readonly status: Exclude<OrderedOutputStatus, "complete">; readonly reason: string };

export function alignOrderedOutput(
  stdout: Uint8Array,
  stderr: Uint8Array,
  merged: Uint8Array,
  options?: { readonly maxFrontier?: number; readonly maxStates?: number },
): OrderedOutputAlignment;
