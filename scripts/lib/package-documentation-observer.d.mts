import type {
  DocumentationProbe,
  DocumentationCheck,
} from "../../packages/package-tools/src/rd-check.js";

export interface DocumentationObservation {
  readonly schemaVersion: 1;
  readonly policy: "loaded-documentation-signatures-v2";
  readonly sourceSha256: string;
  readonly actual: DocumentationCapture;
  readonly expected: DocumentationCapture;
  readonly exportsStatus: DocumentationCheck["status"];
  readonly functions: readonly {
    readonly id: string;
    readonly status: DocumentationCheck["status"];
  }[];
  readonly limitations: readonly string[];
}
export interface DocumentationCapture {
  readonly status: "completed" | "failed" | "invalid-output";
  readonly exports: readonly string[] | null;
  readonly states:
    readonly ("match" | "mismatch" | "unknown" | "active" | "missing" | "noncallable")[] | null;
}
export function observePackageDocumentation(
  name: string,
  probes: readonly DocumentationProbe[],
  options: {
    actual: (source: string) => Promise<{ status: string; stdout: string }>;
    expected: (source: string) => Promise<{ status: string; stdout: string }>;
  },
): Promise<DocumentationObservation>;
