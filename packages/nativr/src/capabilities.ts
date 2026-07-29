import { baseBuiltins, REFERENCE_OPERATOR_MANIFEST } from "@nativr/base";
import { PROTOCOL_VERSION } from "@nativr/protocol";
import type { CapabilityManifest } from "@nativr/protocol";

/** Frozen capability manifest for the initial vertical slice. */
export const CAPABILITIES = Object.freeze({
  nativrVersion: "0.0.0",
  protocolVersion: PROTOCOL_VERSION,
  languageSubsetVersion: "0.1.0",
  syntax: {
    literals: "supported",
    assignment: "supported",
    arithmetic: "supported",
    calls: "supported",
    functions: "supported",
    lexicalClosures: "supported",
    lazyArguments: "supported",
    if: "parsed",
    loops: "parsed",
    return: "parsed",
    subset: "parsed",
    namespace: "parsed",
    formula: "parsed",
    pipe: "parsed",
    ellipsis: "parsed",
    dynamicEvaluation: "unsupported",
  },
  packages: [
    {
      name: "base",
      referenceVersion: "R 4.6.x documented behavior",
      functions: baseBuiltins.map((definition) => ({
        name: definition.name,
        compatibility: definition.metadata.compatibilityLevel,
      })),
    },
  ],
  backends: [...new Set(REFERENCE_OPERATOR_MANIFEST.map((operator) => operator.backend))],
} satisfies CapabilityManifest);
