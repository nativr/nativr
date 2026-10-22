export function collectOracleV2BindingEvidence(
  cases: readonly {
    id: string;
    code: string;
    policy: string;
    bindingEvidence?: readonly string[];
  }[],
  capabilities: {
    targetRVersion: string;
    packages: readonly {
      name: string;
      functions: readonly { name: string; compatibility: string }[];
    }[];
  },
  surface: {
    reference: { version: string };
    packages: readonly {
      name: string;
      exports: readonly { name: string; callable: boolean }[];
    }[];
  },
): { binding: string; cases: string[] }[];

export function shadowedOracleV2Code(
  code: string,
  binding: string,
  marker: string,
  behavior: "error" | "value",
): string;
