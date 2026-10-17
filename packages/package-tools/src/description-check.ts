import { parseDcf, parsePackageDependencies } from "./dcf.js";

export interface PackageDescriptionCheck {
  readonly id: string;
  readonly status: "passed" | "failed" | "unexecuted";
  readonly message: string;
}

export interface PackageDescriptionAssessment {
  readonly schemaVersion: 1;
  readonly policy:
    | "description-structure-v1"
    | "description-structure-v2"
    | "description-structure-v3"
    | "description-structure-v4";
  readonly checks: readonly PackageDescriptionCheck[];
  readonly limitations: readonly string[];
}

/** Independent structural checks from Writing R Extensions 1.1.1 and 1.1.3. */
export function inspectPackageDescription(source: string): PackageDescriptionAssessment {
  const checks: PackageDescriptionCheck[] = [];
  const add = (id: string, passed: boolean, message: string): void => {
    checks.push({ id, status: passed ? "passed" : "failed", message });
  };
  const limitations = [
    "Authors@R evaluation, maintainer email validation, license validity, prose quality and field-specific checks remain unexecuted.",
    "Dependency syntax does not establish availability, namespace use, or transitive closure.",
  ];
  let fields: ReadonlyMap<string, string>;
  try {
    fields = parseDcf(source);
    add(
      "DESCRIPTION:dcf-record",
      fields.size > 0,
      "DESCRIPTION must contain one nonempty DCF record.",
    );
  } catch (error) {
    add("DESCRIPTION:dcf-record", false, error instanceof Error ? error.message : String(error));
    return { schemaVersion: 1, policy: "description-structure-v4", checks, limitations };
  }
  for (const name of ["Package", "Version", "Title", "Description", "License"]) {
    add(
      `DESCRIPTION:required:${name}`,
      Boolean(fields.get(name)?.trim()),
      `Required field '${name}' must be nonempty.`,
    );
  }
  for (const name of ["Author", "Maintainer"]) {
    if (fields.get(name)?.trim())
      add(`DESCRIPTION:required:${name}`, true, `Explicit '${name}' field is present.`);
    else if (fields.get("Authors@R")?.trim())
      checks.push({
        id: `DESCRIPTION:required:${name}`,
        status: "unexecuted",
        message: `Deriving '${name}' requires evaluation and validation of Authors@R.`,
      });
    else add(`DESCRIPTION:required:${name}`, false, `Missing '${name}' and Authors@R.`);
  }
  // Strict native DESCRIPTION diagnostics check punctuation, not linguistic quality.
  // Required-field checks above independently reject missing or empty prose.
  add(
    "DESCRIPTION:title-punctuation",
    !(fields.get("Title") ?? "").endsWith("."),
    "Title must not end in an ASCII period.",
  );
  add(
    "DESCRIPTION:description-punctuation",
    /[.!?]["')]?$/u.test(fields.get("Description") ?? ""),
    "Description must end in sentence punctuation, optionally followed by one closing quote or parenthesis.",
  );
  add(
    "DESCRIPTION:reserved-priority",
    !/^(?:base|recommended)$/iu.test(fields.get("Priority") ?? ""),
    "Priority values 'base' and 'recommended' are reserved, irrespective of case.",
  );
  add(
    "DESCRIPTION:package-name",
    /^[A-Za-z][A-Za-z0-9.]*[A-Za-z0-9]$/u.test(fields.get("Package") ?? ""),
    "Package names require at least two ASCII characters, an initial letter, and no trailing dot.",
  );
  add(
    "DESCRIPTION:version",
    /^[0-9]+(?:[.-][0-9]+)+$/u.test(fields.get("Version") ?? ""),
    "Package versions require at least two nonnegative integer components separated by single dots or hyphens.",
  );
  const vignetteBuilder = fields.get("VignetteBuilder");
  if (vignetteBuilder !== undefined)
    add(
      "DESCRIPTION:vignette-builder-syntax",
      /^[A-Za-z0-9.,]+$/u.test(
        vignetteBuilder
          .split(",")
          .map((entry) => entry.trim())
          .join(","),
      ),
      "VignetteBuilder permits comma-separated ASCII alphanumeric/dot tokens; this syntax check does not establish package availability.",
    );
  for (const kind of ["Depends", "Imports", "Suggests", "Enhances", "LinkingTo"] as const) {
    const value = fields.get(kind);
    if (value === undefined || value.trim() === "") continue;
    try {
      const entries = value.split(",").map((entry) => entry.trim());
      if (kind !== "LinkingTo" && entries.length > 1 && entries.at(-1) === "") entries.pop();
      if (entries.some((entry) => !entry)) throw new Error("Empty dependency entry.");
      if (kind !== "LinkingTo") {
        for (const entry of entries) {
          const match =
            /^([A-Za-z][A-Za-z0-9.]*[A-Za-z0-9]|R)(?:[ \t]+\((>=|<=|==|>|<|!=)[ \t]+([^\s()]+)\))?$/u.exec(
              entry,
            );
          if (match === null) throw new Error(`Malformed ${kind} dependency '${entry}'.`);
          const version = match[3];
          if (
            version !== undefined &&
            !/^[0-9]+(?:[.-][0-9]+)+$/u.test(version) &&
            !(match[1] === "R" && /^r[0-9]+$/u.test(version))
          )
            throw new Error(`Malformed dependency version '${version}'.`);
        }
      }
      // The documented R revision constraint is syntax, not a numeric package version.
      const ordinary = entries.filter(
        (entry) => !/^R\s*\(\s*(?:>=|<=|==|>|<|!=)\s*r[0-9]+\s*\)$/u.test(entry),
      );
      const dependencies = parsePackageDependencies(new Map([[kind, ordinary.join(",")]]));
      if (
        dependencies.some(
          (entry) => entry.name !== "R" && !/^[A-Za-z][A-Za-z0-9.]*[A-Za-z0-9]$/u.test(entry.name),
        )
      )
        throw new Error("Invalid dependency package name.");
      add(
        `DESCRIPTION:dependency-syntax:${kind}`,
        true,
        `Parsed ${entries.length} dependency requirements; availability is checked separately.`,
      );
    } catch (error) {
      add(
        `DESCRIPTION:dependency-syntax:${kind}`,
        false,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return { schemaVersion: 1, policy: "description-structure-v4", checks, limitations };
}
