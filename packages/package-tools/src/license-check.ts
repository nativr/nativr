import { parseDcf } from "./dcf.js";
import { LICENSE_CATALOG } from "./license-catalog.js";
import type { PackageDescriptionCheck } from "./description-check.js";

type LicenseRow = (typeof LICENSE_CATALOG)[number];
export interface PackageLicenseAssessment {
  readonly schemaVersion: 1;
  readonly policy: "license-structure-v1" | "license-structure-v2";
  readonly referenceVersion: "4.6.1";
  readonly checks: readonly PackageDescriptionCheck[];
  readonly pointers: readonly string[];
  readonly limitations: readonly string[];
}

/** License-expression diagnostics, not legal advice or permission to use package contents. */
export function inspectPackageLicense(
  source: string,
  files?: readonly string[],
  contents?: ReadonlyMap<string, string>,
): PackageLicenseAssessment {
  const checks: PackageDescriptionCheck[] = [];
  const pointers: string[] = [];
  const result = (): PackageLicenseAssessment => ({
    schemaVersion: 1,
    policy: "license-structure-v2",
    referenceVersion: "4.6.1",
    checks,
    pointers,
    limitations: [
      "Legal text, template field meaning, standardization aliases, SPDX expansion and dependency license compatibility are not validated.",
      "Catalog recognition and file presence do not establish legal rights or full package-check completion.",
    ],
  });
  const add = (id: string, passed: boolean, message: string): void => {
    checks.push({ id: `DESCRIPTION:License:${id}`, status: passed ? "passed" : "failed", message });
  };
  let license: string;
  try {
    license = parseDcf(source).get("License") ?? "";
  } catch {
    add("expression", false, "DESCRIPTION cannot be parsed as one DCF record.");
    return result();
  }
  const components = license.split("|").map((value) => value.trim());
  if (components.length > 1 && components.at(-1) === "") components.pop();
  let recognized = true;
  let template = true;
  let extensible = true;
  const requiredFields = new Set<string>();
  for (const component of components) {
    if (/^file (LICENSE|LICENCE)$/u.test(component)) {
      pointers.push(component.slice(5));
      continue;
    }
    const extension = /\s*\+\s*file (LICENSE|LICENCE)$/u.exec(component);
    const base = extension === null ? component : component.slice(0, extension.index).trim();
    const rows = matchLicense(base);
    if (rows.some((row) => ["MIT", "BSD_2_clause", "BSD_3_clause"].includes(row.abbreviation))) {
      requiredFields.add("YEAR");
      requiredFields.add("COPYRIGHT HOLDER");
      if (rows.some((row) => row.abbreviation === "BSD_3_clause"))
        requiredFields.add("ORGANIZATION");
    }
    if (rows.length === 0 && base !== "Unlimited") recognized = false;
    if (extension !== null) {
      pointers.push(extension[1]!);
      if (rows.length === 0 || rows.some((row) => !row.extensible)) extensible = false;
    } else if (
      rows.some((row) => ["MIT", "BSD_2_clause", "BSD_3_clause"].includes(row.abbreviation))
    )
      template = false;
  }
  add(
    "expression",
    recognized,
    "License components must match the pinned R license catalog, Unlimited, or a recognized file pointer.",
  );
  add(
    "template-extension",
    template,
    "Template licenses require an explicit + file LICENSE or + file LICENCE reference.",
  );
  add(
    "permitted-extension",
    extensible,
    "Additional file terms must be allowed by every selected catalog license version.",
  );
  if (files === undefined)
    checks.push({
      id: "DESCRIPTION:License:file-references",
      status: "unexecuted",
      message: "File-reference checks require the package file inventory.",
    });
  else
    add(
      "file-references",
      pointers.every((pointer) => files.includes(pointer)),
      "Referenced license files must exist at the package root.",
    );
  if (requiredFields.size > 0 && pointers.length > 0) {
    const content = contents?.get(pointers[0]!);
    if (content === undefined) {
      checks.push({
        id: "DESCRIPTION:License:template-records",
        status: "unexecuted",
        message: "Template-record checks require the first referenced file's contents.",
      });
    } else {
      try {
        const records = parseTemplateRecords(content);
        add("template-dcf", true, "Template file has valid DCF record syntax.");
        const missing = records.flatMap((record, index) => {
          const fields = [...requiredFields].filter((field) => !record.get(field)?.trim());
          return fields.length === 0 ? [] : [`Record: ${index + 1} Field(s): ${fields.join(", ")}`];
        });
        add(
          "template-fields",
          missing.length === 0,
          missing.length === 0
            ? "Every template record contains the required fields."
            : missing.join("; "),
        );
      } catch {
        add("template-dcf", false, "Template file is not valid DCF.");
      }
    }
  }
  return result();
}

/** Template DCF permits multiple records and repeated fields, unlike DESCRIPTION admission. */
function parseTemplateRecords(source: string): readonly ReadonlyMap<string, string>[] {
  const records: Map<string, string>[] = [];
  let record = new Map<string, string>();
  let field: string | undefined;
  for (const line of source.replaceAll("\r\n", "\n").split("\n")) {
    if (/^[ \t]*$/u.test(line)) {
      if (record.size > 0) records.push(record);
      record = new Map();
      field = undefined;
      continue;
    }
    if (/^[ \t]/u.test(line)) {
      if (field === undefined) throw new Error("Orphan DCF continuation.");
      const text = line.trim();
      record.set(field, `${record.get(field) ?? ""}\n${text === "." ? "" : text}`);
      continue;
    }
    const match = /^([^:]+):[ \t]*(.*)$/u.exec(line);
    if (match === null) throw new Error("Malformed DCF field.");
    field = match[1]!;
    record.set(field, match[2]!.trim());
  }
  if (record.size > 0) records.push(record);
  return records;
}

function matchLicense(specification: string): readonly LicenseRow[] {
  const exact = LICENSE_CATALOG.filter((row) =>
    [
      row.name,
      row.abbreviation,
      row.short,
      ...(row.version
        ? [
            `${row.name} ${row.version}`,
            `${row.name} version ${row.version}`,
            `${row.abbreviation} ${row.version}`,
            `${row.abbreviation}-${row.version}`,
          ]
        : []),
    ]
      .filter(Boolean)
      .includes(specification),
  );
  if (exact.length > 0) return exact;
  const restriction = /^(.*?)\s+\((.*)\)$/u.exec(specification);
  if (restriction === null) return [];
  const constraints = restriction[2]!
    .split(",")
    .map((item) => /^\s*(>=|<=|==|!=|>|<)\s+([0-9]+(?:\.[0-9]+)*)\s*$/u.exec(item));
  if (constraints.some((item) => item === null)) return [];
  return LICENSE_CATALOG.filter(
    (row) =>
      row.version &&
      [row.name, row.abbreviation].some((name) => name === restriction[1]) &&
      constraints.every((item) => {
        const left = row.version.split(".").map(Number),
          right = item![2]!.split(".").map(Number);
        let compare = 0;
        for (let index = 0; index < Math.max(left.length, right.length); index++) {
          compare = Math.sign((left[index] ?? 0) - (right[index] ?? 0));
          if (compare) break;
        }
        switch (item![1]) {
          case ">=":
            return compare >= 0;
          case "<=":
            return compare <= 0;
          case "==":
            return compare === 0;
          case "!=":
            return compare !== 0;
          case ">":
            return compare > 0;
          default:
            return compare < 0;
        }
      }),
  );
}
