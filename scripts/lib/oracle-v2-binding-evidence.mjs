const shadowableName = /^[A-Za-z.][A-Za-z0-9._]*$/;

export function collectOracleV2BindingEvidence(cases, capabilities, surface) {
  if (
    typeof capabilities.targetRVersion !== "string" ||
    !surface.reference.version.startsWith(`R version ${capabilities.targetRVersion} (`)
  ) {
    throw new Error("Oracle-v2 binding evidence requires a matching normative GNU R surface.");
  }
  const allRegistered = new Set(
    capabilities.packages.flatMap((entry) =>
      entry.functions.map((item) => `${entry.name}::${item.name}`),
    ),
  );
  const registered = new Set(
    capabilities.packages.flatMap((entry) =>
      entry.functions
        .filter((item) => item.compatibility === "behavioral")
        .map((item) => `${entry.name}::${item.name}`),
    ),
  );
  const referenceCallable = new Set(
    surface.packages.flatMap((entry) =>
      entry.exports.filter((item) => item.callable).map((item) => `${entry.name}::${item.name}`),
    ),
  );
  const registeredOwners = new Map();
  for (const binding of allRegistered) {
    const name = binding.slice(binding.indexOf("::") + 2);
    registeredOwners.set(name, (registeredOwners.get(name) ?? 0) + 1);
  }
  const referenceOwners = new Map();
  for (const binding of referenceCallable) {
    const name = binding.slice(binding.indexOf("::") + 2);
    referenceOwners.set(name, (referenceOwners.get(name) ?? 0) + 1);
  }
  const casesByBinding = new Map();
  const ids = new Set();

  for (const testCase of cases) {
    if (
      typeof testCase.id !== "string" ||
      testCase.id.length === 0 ||
      ids.has(testCase.id) ||
      typeof testCase.code !== "string" ||
      testCase.code.length === 0
    ) {
      throw new Error("Oracle-v2 binding evidence requires unique case IDs and nonempty code.");
    }
    ids.add(testCase.id);
    const bindings = testCase.bindingEvidence;
    if (bindings === undefined) continue;
    if (testCase.policy !== "exact" || !Array.isArray(bindings) || bindings.length === 0) {
      throw new Error(`Oracle-v2 case '${testCase.id}' has invalid binding evidence.`);
    }
    const withinCase = new Set();
    for (const binding of bindings) {
      if (typeof binding !== "string") {
        throw new Error(`Oracle-v2 case '${testCase.id}' has a non-string binding association.`);
      }
      const match = /^([^:]+)::([^:]+)$/.exec(binding);
      if (
        match === null ||
        !shadowableName.test(match[2]) ||
        withinCase.has(binding) ||
        !registered.has(binding) ||
        !referenceCallable.has(binding) ||
        registeredOwners.get(match[2]) !== 1 ||
        referenceOwners.get(match[2]) !== 1
      ) {
        throw new Error(
          `Oracle-v2 case '${testCase.id}' has unregistered, non-callable, ambiguous, duplicate, or non-shadowable binding '${binding}'.`,
        );
      }
      withinCase.add(binding);
      const linked = casesByBinding.get(binding) ?? [];
      linked.push(testCase.id);
      casesByBinding.set(binding, linked);
    }
  }

  return [...casesByBinding]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([binding, caseIds]) => ({ binding, cases: caseIds.sort() }));
}

export function shadowedOracleV2Code(code, binding, marker, behavior) {
  const name = binding.slice(binding.indexOf("::") + 2);
  if (behavior !== "error" && behavior !== "value") {
    throw new Error(`Unknown Oracle-v2 binding shadow behavior '${behavior}'.`);
  }
  const replacement =
    behavior === "error"
      ? `${name === "stop" ? "base::stop" : "stop"}(${JSON.stringify(marker)})`
      : JSON.stringify(marker);
  return `\`${name}\` <- function(...) ${replacement}\n${code}`;
}
