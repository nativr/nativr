import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  BEHAVIORAL_DIMENSIONS,
  DOMAIN_IDS,
  SOURCE_KEYS,
  buildCallableDomainInventory,
  checkCallableDomainInventory,
  serializeCallableDomainInventory,
} from "../lib/callable-domain-inventory.mjs";

const reference = (name, formals = ["x"]) => ({ name, type: "closure", callable: true, formals });
const runtime = (name) => ({ name, compatibility: "behavioral" });
function fixture() {
  return {
    profiles: {
      schemaVersion: 1,
      normative: { id: "r-4.6.1", version: "4.6.1" },
      platformProfile: { id: "browser-admissible" },
    },
    capabilities: {
      targetRVersion: "4.6.1",
      semanticProfileVersion: "0.379.0",
      languageSubsetVersion: "0.379.0",
      packages: [
        { name: "base", functions: [runtime("rep"), runtime("Foo"), runtime("ownedInternal")] },
        { name: "graphics", functions: [runtime("shared")] },
      ],
    },
    surface: {
      schemaVersion: 1,
      provenance: { implementationBodiesCollected: false },
      reference: { version: "R version 4.6.1 (owned fixture)", platform: "owned-fixture" },
      packages: [
        {
          name: "base",
          exports: [
            reference("rep"),
            reference("unknown"),
            reference("Foo", []),
            reference("foo", null),
            reference("shared"),
            { name: "constant", type: "integer", callable: false },
          ],
        },
        { name: "graphics", exports: [reference("shared")] },
      ],
    },
    foundation: [
      { id: "owned-rep-boundary", code: "TRUE", expected: true },
      { id: "owned-host-boundary", code: "TRUE", expected: true, rOracle: false },
    ],
    oracleV2: [
      { id: "owned-rep", code: "rep(1L, 2L)", policy: "exact", bindingEvidence: ["base::rep"] },
    ],
    domains: {
      schemaVersion: 1,
      targetRVersion: "4.6.1",
      domains: DOMAIN_IDS.map((id) => ({
        id,
        label: id,
        requirement: `Owned requirement for ${id}.`,
      })),
    },
    annotations: {
      schemaVersion: 1,
      targetRVersion: "4.6.1",
      entries: [
        {
          binding: "base::rep",
          domains: ["vector-semantics", "calls-promises"],
          remainingGaps: ["Full behavior remains unassessed."],
        },
      ],
    },
  };
}
const sources = (documents) =>
  Object.fromEntries(SOURCE_KEYS.map((key) => [key, `${JSON.stringify(documents[key])}\n`]));
const build = (documents = fixture()) => buildCallableDomainInventory(sources(documents));
const row = (report, binding) => report.callables.find((entry) => entry.binding === binding);
const reject = (mutate, pattern) => {
  const documents = fixture();
  mutate(documents);
  assert.throws(() => build(documents), pattern);
};
const matrix = (suite = "oracle-v2", caseId = "owned-rep") => ({
  dimension: "ordinary",
  evidence: [{ suite, caseId }],
  remainingGaps: ["Additional ordinary cases remain unassessed."],
});

test("joins exact owners and case-sensitive names without promoting absent exports to extensions", () => {
  const result = build();
  assert.deepEqual(result.totals, {
    callableBindings: 7,
    referenceCallableBindings: 6,
    referenceCallableNames: 5,
    registeredBindings: 4,
    qualifiedOverlaps: 3,
    registeredOutsideExportSnapshot: 1,
    classifiedBindings: 1,
    classificationPendingBindings: 6,
    recursiveLinkedBindings: 1,
    bindingsWithDeclaredMatrixEvidence: 0,
    incompleteBindings: 7,
    incompleteDomains: 13,
  });
  assert.equal(row(result, "base::shared").runtime, null);
  assert.equal(row(result, "graphics::shared").runtime.compatibility, "behavioral");
  assert.equal(row(result, "base::Foo").runtime.compatibility, "behavioral");
  assert.equal(row(result, "base::foo").runtime, null);
  assert.equal(row(result, "base::ownedInternal").reference, null);
  assert.equal(result.defaults.nullReference, "not-in-reference-export-snapshot");
  assert.equal(row(result, "base::constant"), undefined);
});
test("retains unknown signatures separately from zero-argument signatures", () => {
  const result = build();
  assert.deepEqual(row(result, "base::Foo").reference.formals, []);
  assert.equal(row(result, "base::foo").reference.formals, null);
});
test("unmapped reference callables stay pending and unimplemented", () => {
  const pending = row(build(), "base::unknown");
  assert.deepEqual(pending.classification, { status: "pending" });
  assert.equal(pending.completion, "incomplete");
  assert.equal(pending.recursiveCaseIds, undefined);
  assert.equal(pending.matrix, undefined);
  assert.equal(pending.runtime, null);
  assert.deepEqual(build().requiredBehavioralDimensions, BEHAVIORAL_DIMENSIONS);
  assert.equal(build().defaults.absentMatrixDimension, "pending");
  assert.equal(build().defaults.nullRuntime, "not-registered");
});
test("causal links and behavioral registration alone never complete rows or domains", () => {
  const result = build();
  const linked = row(result, "base::rep");
  assert.equal(result.defaults.evidenceStatus, "declarations-only");
  assert.deepEqual(linked.recursiveCaseIds, ["owned-rep"]);
  assert.equal(linked.completion, "incomplete");
  assert.equal(linked.matrix, undefined);
  assert.ok(result.domains.every((entry) => entry.completion === "incomplete"));
  assert.equal(result.domains.find((entry) => entry.id === "graphics").assignedBindings, 0);
});
test("explicit matrix evidence is partial declared evidence with remaining gaps", () => {
  const documents = fixture();
  documents.annotations.entries[0].matrix = [
    matrix(),
    { ...matrix("foundation", "owned-rep-boundary"), dimension: "boundaries" },
  ];
  const result = build(documents);
  const linked = row(result, "base::rep");
  assert.equal(result.totals.bindingsWithDeclaredMatrixEvidence, 1);
  assert.equal(linked.completion, "incomplete");
  assert.equal(
    BEHAVIORAL_DIMENSIONS.filter(
      (dimension) => !linked.matrix.some((entry) => entry.dimension === dimension),
    ).length,
    5,
  );
  assert.ok(linked.matrix.every((entry) => entry.status === "partial-declared"));
  assert.equal(
    result.domains
      .find((entry) => entry.id === "vector-semantics")
      .matrix.find((entry) => entry.dimension === "ordinary").partialDeclaredBindings,
    1,
  );
});
test("even all seven declared dimensions cannot establish full completion", () => {
  const documents = fixture();
  documents.annotations.entries[0].matrix = BEHAVIORAL_DIMENSIONS.map((dimension) => ({
    ...matrix(),
    dimension,
  }));
  const result = row(build(documents), "base::rep");
  assert.equal(result.completion, "incomplete");
  assert.equal(result.matrix.length, 7);
});
test("reference-only callables may be classified without invented implementation/evidence", () => {
  const documents = fixture();
  documents.annotations.entries.push({
    binding: "base::unknown",
    domains: ["value-types"],
    remainingGaps: ["Implementation and complete evidence are absent."],
  });
  const result = row(build(documents), "base::unknown");
  assert.equal(result.classification.status, "assigned");
  assert.equal(result.runtime, null);
  assert.equal(result.recursiveCaseIds, undefined);
});
test("namespace operators and other unsupported shadow names remain inventory rows", () => {
  const documents = fixture();
  documents.surface.packages[0].exports.push(reference("::"), reference(":::"), reference("$"));
  const result = build(documents);
  assert.equal(row(result, "base::::").reference.type, "closure");
  assert.equal(row(result, "base:::::").reference.type, "closure");
  assert.equal(row(result, "base::$").classification.status, "pending");
});
test("input order does not affect rows; exact-byte provenance correctly changes", () => {
  const original = fixture();
  const reordered = structuredClone(original);
  reordered.surface.packages.reverse();
  reordered.surface.packages.forEach((entry) => entry.exports.reverse());
  reordered.capabilities.packages.reverse();
  reordered.capabilities.packages.forEach((entry) => entry.functions.reverse());
  reordered.domains.domains.reverse();
  reordered.annotations.entries[0].domains.reverse();
  const first = build(original),
    second = build(reordered);
  assert.deepEqual(first.callables, second.callables);
  assert.deepEqual(first.domains, second.domains);
  assert.deepEqual(first.totals, second.totals);
  assert.notEqual(first.sourceDigests.surface, second.sourceDigests.surface);
  assert.equal(first.sourceDigests.foundation, second.sourceDigests.foundation);
});
test("source digests cover exact bytes and generation/checking is deterministic", () => {
  const inputs = sources(fixture());
  const first = buildCallableDomainInventory(inputs),
    second = buildCallableDomainInventory(inputs);
  const rendered = serializeCallableDomainInventory(first);
  assert.equal(rendered, serializeCallableDomainInventory(second));
  for (const key of SOURCE_KEYS)
    assert.equal(first.sourceDigests[key], createHash("sha256").update(inputs[key]).digest("hex"));
  assert.doesNotThrow(() => checkCallableDomainInventory(rendered, rendered));
  assert.throws(() => checkCallableDomainInventory(`${rendered} `, rendered), /stale/);
});
for (const [label, mutate, pattern] of [
  [
    "capability target mismatch",
    (d) => {
      d.capabilities.targetRVersion = "4.6.0";
    },
    /target version/,
  ],
  [
    "surface target mismatch",
    (d) => {
      d.surface.reference.version = "R version 4.6.0 (owned)";
    },
    /surface version/,
  ],
  [
    "domain target mismatch",
    (d) => {
      d.domains.targetRVersion = "4.6.0";
    },
    /domain target version/,
  ],
  [
    "annotation target mismatch",
    (d) => {
      d.annotations.targetRVersion = "4.6.0";
    },
    /domain target version/,
  ],
  [
    "unsynchronized semantic profiles",
    (d) => {
      d.capabilities.languageSubsetVersion = "0.378.0";
    },
    /profile versions differ/,
  ],
  [
    "unproven source provenance",
    (d) => {
      d.surface.provenance.implementationBodiesCollected = true;
    },
    /implementation bodies/,
  ],
  [
    "unsupported input schema",
    (d) => {
      d.surface.schemaVersion = 2;
    },
    /unsupported.*schema/,
  ],
  [
    "unknown mapping binding",
    (d) => {
      d.annotations.entries[0].binding = "other::rep";
    },
    /stale or unknown annotation/,
  ],
  [
    "stale case-sensitive mapping",
    (d) => {
      d.annotations.entries[0].binding = "base::REP";
    },
    /stale or unknown annotation/,
  ],
  [
    "duplicate mapping",
    (d) => {
      d.annotations.entries.push(structuredClone(d.annotations.entries[0]));
    },
    /duplicate annotation/,
  ],
  [
    "missing causal mapping",
    (d) => {
      d.annotations.entries = [];
    },
    /requires an explicit domain annotation/,
  ],
  [
    "unknown domain",
    (d) => {
      d.annotations.entries[0].domains = ["invented"];
    },
    /unknown domain/,
  ],
  [
    "duplicate domain membership",
    (d) => {
      d.annotations.entries[0].domains.push("vector-semantics");
    },
    /distinct/,
  ],
  [
    "missing domain declaration",
    (d) => {
      d.domains.domains.pop();
    },
    /all thirteen/,
  ],
  [
    "duplicate domain declaration",
    (d) => {
      d.domains.domains.push(d.domains.domains[0]);
    },
    /duplicate domain/,
  ],
  [
    "empty remaining gaps",
    (d) => {
      d.annotations.entries[0].remainingGaps = [];
    },
    /remaining gaps.*distinct/,
  ],
  [
    "unsupported completion claim",
    (d) => {
      d.annotations.entries[0].completion = "complete";
    },
    /unsupported field 'completion'/,
  ],
  [
    "unsupported domain completion claim",
    (d) => {
      d.domains.domains[0].completion = "complete";
    },
    /unsupported field 'completion'/,
  ],
  [
    "inferred platform exclusion",
    (d) => {
      d.annotations.entries[0].platformExclusion = "browser";
    },
    /unsupported field 'platformExclusion'/,
  ],
  [
    "duplicate reference namespace",
    (d) => {
      d.surface.packages.push(d.surface.packages[0]);
    },
    /duplicate reference package/,
  ],
  [
    "duplicate reference name",
    (d) => {
      d.surface.packages[0].exports.push(reference("rep"));
    },
    /duplicate reference binding/,
  ],
  [
    "duplicate registered namespace",
    (d) => {
      d.capabilities.packages.push(d.capabilities.packages[0]);
    },
    /duplicate registered package/,
  ],
  [
    "duplicate registered name",
    (d) => {
      d.capabilities.packages[0].functions.push(runtime("rep"));
    },
    /duplicate registered binding/,
  ],
  [
    "duplicate foundation ID",
    (d) => {
      d.foundation.push(d.foundation[0]);
    },
    /duplicate foundation case/,
  ],
  [
    "duplicate oracle ID",
    (d) => {
      d.oracleV2.push(d.oracleV2[0]);
    },
    /duplicate oracle-v2 case/,
  ],
  [
    "unregistered causal link",
    (d) => {
      d.oracleV2[0].bindingEvidence = ["base::unknown"];
    },
    /unregistered.*binding/,
  ],
  [
    "non-reference causal link",
    (d) => {
      d.oracleV2[0].bindingEvidence = ["base::ownedInternal"];
    },
    /unregistered.*binding/,
  ],
  [
    "unsupported causal policy",
    (d) => {
      d.oracleV2[0].policy = "numeric-tolerance";
    },
    /invalid binding evidence/,
  ],
  [
    "ambiguous reference-name causal link",
    (d) => {
      d.oracleV2[0].bindingEvidence = ["graphics::shared"];
    },
    /ambiguous/,
  ],
  [
    "ambiguous registered-name causal link",
    (d) => {
      d.capabilities.packages[1].functions.push(runtime("rep"));
    },
    /ambiguous/,
  ],
  [
    "non-shadowable causal name",
    (d) => {
      d.surface.packages[0].exports.push(reference("$"));
      d.capabilities.packages[0].functions.push(runtime("$"));
      d.oracleV2[0].bindingEvidence = ["base::$"];
    },
    /non-shadowable/,
  ],
  [
    "stale explicit case ID",
    (d) => {
      d.annotations.entries[0].matrix = [matrix("oracle-v2", "missing")];
    },
    /stale matrix case/,
  ],
  [
    "unsupported evidence suite",
    (d) => {
      d.annotations.entries[0].matrix = [matrix("invented")];
    },
    /unknown evidence suite/,
  ],
  [
    "NativR-only differential claim",
    (d) => {
      d.annotations.entries[0].matrix = [matrix("foundation", "owned-host-boundary")];
    },
    /NativR-only/,
  ],
  [
    "unlinked recursive matrix claim",
    (d) => {
      d.oracleV2.push({ id: "unlinked", code: "TRUE", policy: "exact" });
      d.annotations.entries[0].matrix = [matrix("oracle-v2", "unlinked")];
    },
    /not causally linked/,
  ],
  [
    "unregistered matrix claim",
    (d) => {
      d.annotations.entries.push({
        binding: "base::unknown",
        domains: ["value-types"],
        remainingGaps: ["Missing implementation"],
        matrix: [matrix("foundation", "owned-rep-boundary")],
      });
    },
    /unregistered/,
  ],
  [
    "unknown matrix dimension",
    (d) => {
      d.annotations.entries[0].matrix = [{ ...matrix(), dimension: "complete" }];
    },
    /unknown.*matrix dimension/,
  ],
  [
    "duplicate matrix dimension",
    (d) => {
      d.annotations.entries[0].matrix = [matrix(), matrix()];
    },
    /duplicate matrix dimension/,
  ],
  [
    "empty matrix evidence",
    (d) => {
      d.annotations.entries[0].matrix = [{ ...matrix(), evidence: [] }];
    },
    /no declared evidence/,
  ],
  [
    "duplicate matrix case",
    (d) => {
      const m = matrix();
      m.evidence.push(m.evidence[0]);
      d.annotations.entries[0].matrix = [m];
    },
    /duplicate matrix case/,
  ],
  [
    "empty matrix remaining gaps",
    (d) => {
      d.annotations.entries[0].matrix = [{ ...matrix(), remainingGaps: [] }];
    },
    /matrix remaining gaps.*distinct/,
  ],
  [
    "malformed matrix declarations",
    (d) => {
      d.annotations.entries[0].matrix = {};
    },
    /matrix declarations must be an array/,
  ],
])
  test(`rejects ${label}`, () => reject(mutate, pattern));

test("rejects missing, malformed and unexpected source documents", () => {
  const inputs = sources(fixture());
  const missing = { ...inputs };
  delete missing.annotations;
  assert.throws(() => buildCallableDomainInventory(missing), /source 'annotations'/);
  assert.throws(() => buildCallableDomainInventory({ ...inputs, surface: "{" }), /invalid JSON/);
  assert.throws(
    () => buildCallableDomainInventory({ ...inputs, liveResults: "{}" }),
    /unsupported field 'liveResults'/,
  );
});
