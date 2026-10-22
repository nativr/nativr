export type DomainId =
  | "language-syntax"
  | "value-types"
  | "calls-promises"
  | "environments"
  | "vector-semantics"
  | "conditions"
  | "object-systems"
  | "core-namespaces"
  | "numeric-runtime"
  | "data-time"
  | "io-platform"
  | "package-execution"
  | "graphics";
export type BehavioralDimension =
  "ordinary" | "boundaries" | "errors" | "attributes" | "visibility" | "side-effects" | "identity";
export type SourceKey =
  "profiles" | "capabilities" | "surface" | "foundation" | "oracleV2" | "domains" | "annotations";
export const DOMAIN_IDS: readonly DomainId[];
export const BEHAVIORAL_DIMENSIONS: readonly BehavioralDimension[];
export const SOURCE_KEYS: readonly SourceKey[];
export type MatrixDeclaration = {
  dimension: BehavioralDimension;
  status: "partial-declared";
  evidence: { suite: "foundation" | "oracle-v2"; caseId: string }[];
  remainingGaps: string[];
};
export type CallableInventoryRow = {
  binding: string;
  reference: null | { type: string; formals: string[] | null; signature?: "args" | "unknown" };
  runtime: null | { compatibility: string };
  classification: { status: "pending" } | { status: "assigned"; domains: DomainId[] };
  completion: "incomplete";
  recursiveCaseIds?: string[];
  matrix?: MatrixDeclaration[];
  remainingGaps?: string[];
};
export type CallableDomainInventory = {
  schemaVersion: 1;
  targetRVersion: string;
  compatibilityProfile: string;
  platformProfile: string;
  semanticProfileVersion: string;
  reference: { version: string; platform: string };
  sourceDigests: Record<SourceKey, string>;
  requiredBehavioralDimensions: readonly BehavioralDimension[];
  defaults: {
    evidenceStatus: "declarations-only";
    absentRecursiveCaseIds: "no-declared-causal-link";
    absentMatrixDimension: "pending";
    unclassifiedRemainingGap: string;
    nullReference: "not-in-reference-export-snapshot";
    nullRuntime: "not-registered";
  };
  notes: string[];
  totals: {
    callableBindings: number;
    referenceCallableBindings: number;
    referenceCallableNames: number;
    registeredBindings: number;
    qualifiedOverlaps: number;
    registeredOutsideExportSnapshot: number;
    classifiedBindings: number;
    classificationPendingBindings: number;
    recursiveLinkedBindings: number;
    bindingsWithDeclaredMatrixEvidence: number;
    incompleteBindings: number;
    incompleteDomains: number;
  };
  domains: {
    id: DomainId;
    label: string;
    requirement: string;
    completion: "incomplete";
    assignedBindings: number;
    recursiveLinkedBindings: number;
    matrix: {
      dimension: BehavioralDimension;
      pendingBindings: number;
      partialDeclaredBindings: number;
    }[];
  }[];
  callables: CallableInventoryRow[];
};
export function buildCallableDomainInventory(
  sources: Record<SourceKey, string>,
): CallableDomainInventory;
export function serializeCallableDomainInventory(inventory: CallableDomainInventory): string;
export function checkCallableDomainInventory(actual: string, expected: string): void;
