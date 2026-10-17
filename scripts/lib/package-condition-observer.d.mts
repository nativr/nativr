import type { RValueSnapshot } from "@nativr/protocol";
import type { OracleCondition } from "./package-oracle.mjs";

export const packageConditionObserverSetup: string;
export const packageConditionObserverRead: string;
export function decodePackageConditions(
  snapshot: RValueSnapshot,
  completed: boolean,
): {
  conditions: readonly OracleCondition[];
  conditionsComplete: boolean;
};
