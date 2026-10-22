import { createHash } from "node:crypto";

import { collectOracleV2BindingEvidence } from "./oracle-v2-binding-evidence.mjs";

export const DOMAIN_IDS = Object.freeze([
  "language-syntax",
  "value-types",
  "calls-promises",
  "environments",
  "vector-semantics",
  "conditions",
  "object-systems",
  "core-namespaces",
  "numeric-runtime",
  "data-time",
  "io-platform",
  "package-execution",
  "graphics",
]);
export const BEHAVIORAL_DIMENSIONS = Object.freeze([
  "ordinary",
  "boundaries",
  "errors",
  "attributes",
  "visibility",
  "side-effects",
  "identity",
]);
export const SOURCE_KEYS = Object.freeze([
  "profiles",
  "capabilities",
  "surface",
  "foundation",
  "oracleV2",
  "domains",
  "annotations",
]);
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const fail = (message) => {
  throw new Error(`Callable inventory: ${message}`);
};
const object = (value, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object.`);
  return value;
};
const array = (value, label) => {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  return value;
};
const string = (value, label) => {
  if (typeof value !== "string" || value.trim().length === 0)
    fail(`${label} must be nonempty text.`);
  return value;
};
const uniqueStrings = (value, label, nonempty = true) => {
  const entries = array(value, label).map((entry) => string(entry, label));
  if ((nonempty && entries.length === 0) || new Set(entries).size !== entries.length)
    fail(`${label} must contain distinct${nonempty ? " nonempty" : ""} entries.`);
  return [...entries].sort(compare);
};
const keys = (value, allowed, label) => {
  object(value, label);
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) fail(`${label} has unsupported field '${key}'.`);
};
const version = (value, label) => {
  string(value, label);
  if (!/^\d+\.\d+\.\d+$/.test(value)) fail(`${label} is not an exact release version.`);
  return value;
};
const bindingKey = (packageName, name) => {
  string(packageName, "package name");
  string(name, "callable name");
  if (packageName.includes(":")) fail("a qualified binding cannot contain a colon in its package.");
  return `${packageName}::${name}`;
};
const caseCatalog = (cases, suite) => {
  const result = new Map();
  for (const entry of array(cases, suite)) {
    object(entry, `${suite} case`);
    string(entry.id, `${suite} case ID`);
    string(entry.code, `${suite} case code`);
    if (result.has(entry.id)) fail(`duplicate ${suite} case '${entry.id}'.`);
    result.set(entry.id, entry);
  }
  return result;
};

/** Build declaration-only inventory from exact JSON source bytes. Never executes R or imports dist. */
export function buildCallableDomainInventory(sources) {
  keys(sources, SOURCE_KEYS, "sources");
  const documents = {};
  const sourceDigests = {};
  for (const key of SOURCE_KEYS) {
    const source = string(sources[key], `source '${key}'`);
    try {
      documents[key] = JSON.parse(source);
    } catch {
      fail(`source '${key}' is invalid JSON.`);
    }
    sourceDigests[key] = createHash("sha256").update(source, "utf8").digest("hex");
  }
  const { profiles, capabilities, surface, domains, annotations } = documents;
  object(profiles, "profiles");
  object(capabilities, "capabilities");
  object(surface, "surface");
  if (profiles.schemaVersion !== 1 || surface.schemaVersion !== 1)
    fail("unsupported profile/surface schema.");
  const target = version(profiles.normative?.version, "normative target version");
  string(profiles.normative?.id, "normative profile ID");
  string(profiles.platformProfile?.id, "platform profile ID");
  if (capabilities.targetRVersion !== target)
    fail("capability target version does not match the normative target.");
  const semanticProfileVersion = version(
    capabilities.semanticProfileVersion,
    "semantic profile version",
  );
  if (capabilities.languageSubsetVersion !== semanticProfileVersion)
    fail("language and semantic profile versions differ.");
  if (
    typeof surface.reference?.version !== "string" ||
    !surface.reference.version.startsWith(`R version ${target} (`)
  )
    fail("reference surface version does not match the normative target.");
  string(surface.reference?.platform, "reference platform");
  if (surface.provenance?.implementationBodiesCollected !== false)
    fail("reference surface must declare that no implementation bodies were collected.");
  keys(domains, ["schemaVersion", "targetRVersion", "domains"], "domain catalog");
  keys(annotations, ["schemaVersion", "targetRVersion", "entries"], "annotations");
  if (domains.schemaVersion !== 1 || annotations.schemaVersion !== 1)
    fail("unsupported annotation/domain schema.");
  if (domains.targetRVersion !== target || annotations.targetRVersion !== target)
    fail("annotation/domain target version differs from the normative target.");
  const domainCatalog = new Map();
  for (const domain of array(domains.domains, "domains")) {
    keys(domain, ["id", "label", "requirement"], "domain");
    if (!DOMAIN_IDS.includes(domain.id) || domainCatalog.has(domain.id))
      fail(`unknown or duplicate domain '${domain.id}'.`);
    string(domain.label, "domain label");
    string(domain.requirement, "domain requirement");
    domainCatalog.set(domain.id, domain);
  }
  if (domainCatalog.size !== DOMAIN_IDS.length)
    fail("all thirteen required domains must be declared.");

  const rows = new Map();
  const seenPackages = new Set();
  for (const namespace of array(surface.packages, "reference packages")) {
    string(namespace.name, "reference package name");
    if (seenPackages.has(namespace.name)) fail(`duplicate reference package '${namespace.name}'.`);
    seenPackages.add(namespace.name);
    const names = new Set();
    for (const entry of array(namespace.exports, "reference exports")) {
      const binding = bindingKey(namespace.name, entry.name);
      if (names.has(entry.name)) fail(`duplicate reference binding '${binding}'.`);
      names.add(entry.name);
      if (typeof entry.callable !== "boolean")
        fail(`reference callable flag is invalid for '${binding}'.`);
      if (!entry.callable) continue;
      string(entry.type, "reference callable type");
      if (entry.signature !== undefined && !["args", "unknown"].includes(entry.signature))
        fail(`unsupported signature provenance on '${binding}'.`);
      if (entry.formals !== null) {
        // Repeated formal tags can be observable metadata; retain their order and duplicates.
        array(entry.formals, "reference formals").forEach((formal) =>
          string(formal, "formal name"),
        );
      }
      rows.set(binding, {
        binding,
        package: namespace.name,
        name: entry.name,
        reference: {
          type: entry.type,
          formals: entry.formals,
          ...(entry.signature === undefined ? {} : { signature: entry.signature }),
        },
        runtime: null,
      });
    }
  }
  seenPackages.clear();
  for (const namespace of array(capabilities.packages, "registered packages")) {
    string(namespace.name, "registered package name");
    if (seenPackages.has(namespace.name)) fail(`duplicate registered package '${namespace.name}'.`);
    seenPackages.add(namespace.name);
    const names = new Set();
    for (const entry of array(namespace.functions, "registered functions")) {
      const binding = bindingKey(namespace.name, entry.name);
      if (names.has(entry.name)) fail(`duplicate registered binding '${binding}'.`);
      names.add(entry.name);
      string(entry.compatibility, "registered compatibility classification");
      const row = rows.get(binding) ?? {
        binding,
        package: namespace.name,
        name: entry.name,
        reference: null,
        runtime: null,
      };
      row.runtime = { compatibility: entry.compatibility };
      rows.set(binding, row);
    }
  }
  const foundation = caseCatalog(documents.foundation, "foundation");
  const oracleV2 = caseCatalog(documents.oracleV2, "oracle-v2");
  // Retain the existing exact-policy, callable, owner-ambiguity and shadowability checks.
  const recursiveLinks = new Map(
    collectOracleV2BindingEvidence(documents.oracleV2, capabilities, surface).map(
      ({ binding, cases }) => [binding, [...cases].sort(compare)],
    ),
  );
  const mapped = new Map();
  for (const annotation of array(annotations.entries, "annotation entries")) {
    keys(annotation, ["binding", "domains", "remainingGaps", "matrix"], "annotation");
    const binding = string(annotation.binding, "annotation binding");
    if (!rows.has(binding))
      fail(
        `stale or unknown annotation '${binding}'; it is neither a reference callable nor registered.`,
      );
    if (mapped.has(binding)) fail(`duplicate annotation '${binding}'.`);
    const assignedDomains = uniqueStrings(annotation.domains, `${binding} domains`);
    for (const domain of assignedDomains)
      if (!domainCatalog.has(domain)) fail(`unknown domain '${domain}' on '${binding}'.`);
    const remainingGaps = uniqueStrings(annotation.remainingGaps, `${binding} remaining gaps`);
    const partialDimensions = [];
    const seenDimensions = new Set();
    for (const matrix of array(annotation.matrix ?? [], `${binding} matrix declarations`)) {
      keys(matrix, ["dimension", "evidence", "remainingGaps"], `${binding} matrix declaration`);
      const dimension = matrix.dimension;
      if (!BEHAVIORAL_DIMENSIONS.includes(dimension) || seenDimensions.has(dimension))
        fail(`unknown or duplicate matrix dimension '${dimension}' on '${binding}'.`);
      if (rows.get(binding).runtime === null)
        fail(`matrix evidence cannot be declared for unregistered '${binding}'.`);
      seenDimensions.add(dimension);
      const evidenceKeys = new Set();
      const evidence = array(matrix.evidence, "matrix evidence")
        .map((reference) => {
          keys(reference, ["suite", "caseId"], "matrix case reference");
          if (!["foundation", "oracle-v2"].includes(reference.suite))
            fail(`unknown evidence suite '${reference.suite}'.`);
          const catalog = reference.suite === "foundation" ? foundation : oracleV2;
          const testCase = catalog.get(reference.caseId);
          if (testCase === undefined)
            fail(`stale matrix case '${reference.suite}:${reference.caseId}'.`);
          if (reference.suite === "foundation" && testCase.rOracle === false)
            fail(
              `NativR-only case '${reference.caseId}' cannot establish differential matrix evidence.`,
            );
          if (
            reference.suite === "oracle-v2" &&
            !(recursiveLinks.get(binding) ?? []).includes(reference.caseId)
          )
            fail(
              `recursive matrix case '${reference.caseId}' is not causally linked to '${binding}'.`,
            );
          const key = `${reference.suite}:${reference.caseId}`;
          if (evidenceKeys.has(key)) fail(`duplicate matrix case '${key}'.`);
          evidenceKeys.add(key);
          return { suite: reference.suite, caseId: reference.caseId };
        })
        .sort((a, b) => compare(`${a.suite}:${a.caseId}`, `${b.suite}:${b.caseId}`));
      if (evidence.length === 0)
        fail(`matrix dimension '${dimension}' on '${binding}' has no declared evidence.`);
      partialDimensions.push({
        dimension,
        status: "partial-declared",
        evidence,
        remainingGaps: uniqueStrings(matrix.remainingGaps, "matrix remaining gaps"),
      });
    }
    mapped.set(binding, {
      domains: assignedDomains,
      remainingGaps,
      partialDimensions: partialDimensions.sort((a, b) => compare(a.dimension, b.dimension)),
    });
  }
  for (const binding of recursiveLinks.keys())
    if (!mapped.has(binding))
      fail(`causal-linked binding '${binding}' requires an explicit domain annotation.`);

  const callables = [...rows.values()]
    .sort((a, b) => compare(a.binding, b.binding))
    .map((row) => {
      const annotation = mapped.get(row.binding);
      const partialDimensions = annotation?.partialDimensions ?? [];
      const recursiveCaseIds = recursiveLinks.get(row.binding) ?? [];
      return {
        binding: row.binding,
        reference: row.reference,
        runtime: row.runtime,
        classification:
          annotation === undefined
            ? { status: "pending" }
            : { status: "assigned", domains: annotation.domains },
        completion: "incomplete",
        ...(recursiveCaseIds.length === 0 ? {} : { recursiveCaseIds }),
        ...(partialDimensions.length === 0 ? {} : { matrix: partialDimensions }),
        ...(annotation === undefined ? {} : { remainingGaps: annotation.remainingGaps }),
      };
    });
  const domainRows = DOMAIN_IDS.map((id) => {
    const assigned = callables.filter((row) => row.classification.domains?.includes(id));
    return {
      ...domainCatalog.get(id),
      completion: "incomplete",
      assignedBindings: assigned.length,
      recursiveLinkedBindings: assigned.filter((row) => row.recursiveCaseIds !== undefined).length,
      matrix: BEHAVIORAL_DIMENSIONS.map((dimension) => ({
        dimension,
        pendingBindings: assigned.filter(
          (row) => !(row.matrix ?? []).some((entry) => entry.dimension === dimension),
        ).length,
        partialDeclaredBindings: assigned.filter((row) =>
          (row.matrix ?? []).some((entry) => entry.dimension === dimension),
        ).length,
      })),
    };
  });
  return {
    schemaVersion: 1,
    targetRVersion: target,
    compatibilityProfile: profiles.normative.id,
    platformProfile: profiles.platformProfile.id,
    semanticProfileVersion,
    reference: { version: surface.reference.version, platform: surface.reference.platform },
    sourceDigests,
    requiredBehavioralDimensions: BEHAVIORAL_DIMENSIONS,
    defaults: {
      evidenceStatus: "declarations-only",
      absentRecursiveCaseIds: "no-declared-causal-link",
      absentMatrixDimension: "pending",
      unclassifiedRemainingGap:
        "Domain assignment and the complete behavioral matrix remain unassessed.",
      nullReference: "not-in-reference-export-snapshot",
      nullRuntime: "not-registered",
    },
    notes: [
      "Package-qualified bindings and names are case-sensitive. Name overlap does not establish owner-qualified registration.",
      "This report validates checked-in declarations, not execution or passing results. Live oracle and causal-control gates remain separate.",
      "Behavioral claims require separately recorded passing oracle/causal-control gates for matching profile and case/source identities; source hashes and case links alone are not run evidence.",
      "Causal case links never complete a callable or a domain. Unannotated dimensions remain pending; explicit matrix references remain partial declarations.",
      "Registrations absent from the exported reference snapshot may be internal core methods or extensions; this inventory does not decide which.",
      "Domain membership can overlap. Domain assignment counts are not additive and are not completion percentages.",
      "Platform exclusions are not accepted by schema v1. Adaptation prose alone cannot exclude browser-meaningful behavior.",
    ],
    totals: {
      callableBindings: callables.length,
      referenceCallableBindings: callables.filter((row) => row.reference !== null).length,
      referenceCallableNames: new Set(
        [...rows.values()].filter((row) => row.reference !== null).map((row) => row.name),
      ).size,
      registeredBindings: callables.filter((row) => row.runtime !== null).length,
      qualifiedOverlaps: callables.filter((row) => row.reference !== null && row.runtime !== null)
        .length,
      registeredOutsideExportSnapshot: callables.filter((row) => row.reference === null).length,
      classifiedBindings: mapped.size,
      classificationPendingBindings: callables.length - mapped.size,
      recursiveLinkedBindings: recursiveLinks.size,
      bindingsWithDeclaredMatrixEvidence: callables.filter((row) => row.matrix !== undefined)
        .length,
      incompleteBindings: callables.length,
      incompleteDomains: DOMAIN_IDS.length,
    },
    domains: domainRows,
    callables,
  };
}

export function serializeCallableDomainInventory(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

export function checkCallableDomainInventory(actual, expected) {
  if (actual !== expected) fail('generated report is stale; run "pnpm inventory:render".');
}
