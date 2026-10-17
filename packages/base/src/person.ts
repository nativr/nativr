import {
  R_NULL,
  RTypeMismatchError,
  RUnsupportedFeatureError,
  characterVector,
  extractVectorElement,
  isAtomic,
  isMissing,
  listValue,
  subsetVector,
  vectorClasses,
  vectorNames,
  withClasses,
} from "@nativr/runtime";
import type { BuiltinInvocation, RCharacterVector, RList, RValue } from "@nativr/runtime";
import { PERSON_ROLES } from "./person-roles.js";

type AtomicVector = Extract<
  RValue,
  { type: "logical" | "integer" | "double" | "complex" | "raw" | "character" }
>;
const fields = ["given", "family", "role", "email", "comment"] as const;
export const PERSON_ARGUMENTS = [
  "given",
  "family",
  "middle",
  "email",
  "role",
  "comment",
  "first",
  "last",
] as const;
export function isPerson(value: RValue): value is RList {
  return value.type === "list" && Boolean(vectorClasses(value)?.includes("person"));
}
const warn = (inv: BuiltinInvocation, message: string): void =>
  inv.context.warn({ code: "NRW1060", message });
const trimField = (value: RCharacterVector): RCharacterVector => ({
  ...value,
  values: Object.freeze(value.values.map((text) => text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/gu, ""))),
});

function clean(
  value: RValue,
  inv: BuiltinInvocation,
  coerce: (value: AtomicVector) => RCharacterVector,
): RValue {
  if (value.type === "null") return value;
  if (!isAtomic(value))
    throw new RTypeMismatchError(
      "NRT3450",
      "Arguments of person() must contain atomic fields or NULL.",
    );
  if (value.type !== "character" && vectorClasses(value)?.length)
    throw new RUnsupportedFeatureError(
      "NRU6313",
      "person() does not yet support class-specific coercion of atomic fields.",
    );
  if (
    value.length === 0 ||
    Array.from({ length: value.length }, (_, i) => isMissing(value, i)).some(Boolean)
  )
    return R_NULL;
  if (value.type !== "character") warn(inv, "Arguments of person() should be character or NULL");
  const converted = trimField(value.type === "character" ? value : coerce(value));
  if (converted.values.every((text) => text === "")) return R_NULL;
  return converted;
}

export function createPerson(
  input: ReadonlyMap<string, RValue>,
  inv: BuiltinInvocation,
  coerce: (value: AtomicVector) => RCharacterVector,
): RValue {
  if (
    input.get("given")?.type !== undefined &&
    input.get("given")?.type !== "null" &&
    ["first", "middle"].some((key) => input.has(key) && input.get(key)?.type !== "null")
  )
    throw new RTypeMismatchError("NRT3450", "Use either 'given' or 'first'/'middle' but not both.");
  if (
    input.get("family")?.type !== undefined &&
    input.get("family")?.type !== "null" &&
    input.has("last") &&
    input.get("last")?.type !== "null"
  )
    throw new RTypeMismatchError("NRT3450", "Use either 'family' or 'last' but not both.");
  for (const [old, modern] of [
    ["first", "given"],
    ["middle", "given"],
    ["last", "family"],
  ])
    if (input.has(old!) && input.get(old!)?.type !== "null")
      warn(inv, `It is recommended to use '${modern}' instead of '${old}'.`);
  const columns = new Map(
    PERSON_ARGUMENTS.map((key) => {
      const value = input.get(key) ?? R_NULL;
      return [key, value.type === "list" ? value.values : [value]] as const;
    }),
  );
  const size = Math.max(1, ...[...columns.values()].map((values) => values.length));
  inv.context.allocate(size * 6);
  const recycled = PERSON_ARGUMENTS.filter((key) => {
    const n = columns.get(key)!.length;
    return n !== 1 && n !== size;
  });
  if (recycled.length)
    warn(
      inv,
      `Not all arguments are of the same length, the following need to be recycled: ${recycled.join(", ")}`,
    );
  const records: RValue[] = [];
  for (let i = 0; i < size; i++) {
    inv.context.checkpoint();
    const at = (key: (typeof PERSON_ARGUMENTS)[number]) => {
      const values = columns.get(key)!;
      return clean(values[i % values.length] ?? R_NULL, inv, coerce);
    };
    let given = at("given"),
      family = at("family");
    const first = at("first"),
      middle = at("middle"),
      last = at("last");
    if (given.type === "null") {
      const names = [first, middle].flatMap((v) => (v.type === "character" ? [...v.values] : []));
      if (names.length) given = characterVector(names);
    }
    if (family.type === "null") family = last;
    const rawRole = columns.get("role")!;
    const raw = rawRole[i % rawRole.length] ?? R_NULL;
    let role = at("role");
    const roleValues = raw.type === "character" ? trimField(raw) : role;
    if (roleValues.type === "character") {
      const invalid = roleValues.values.flatMap((v, j) =>
        isMissing(roleValues, j) ? ["NA"] : !PERSON_ROLES.has(v) ? [v] : [],
      );
      if (invalid.length)
        warn(inv, `Invalid role specification: ${invalid.map((v) => `'${v}'`).join(", ")}.`);
      const valid = roleValues.values.filter(
        (v, j) => !isMissing(roleValues, j) && PERSON_ROLES.has(v),
      );
      role = valid.length ? characterVector(valid) : R_NULL;
    }
    const email = at("email"),
      comment = at("comment");
    if (comment.type === "character")
      for (let j = 0; j < comment.length; j++)
        if (vectorNames(comment)?.[j] === "ORCID" && !validOrcid(comment.values[j]!))
          warn(inv, `Invalid ORCID iD: '${comment.values[j]}'.`);
    const values = [given, family, role, email, comment];
    if (values.some((v) => v.type !== "null")) records.push(listValue(values, fields));
  }
  return withClasses(listValue(records), ["person"]);
}

function validOrcid(value: string): boolean {
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/u.test(value)) return false;
  const digits = value.replaceAll("-", "");
  let total = 0;
  for (const digit of digits.slice(0, 15)) total = (total + Number(digit)) * 2;
  const check = (12 - (total % 11)) % 11;
  return digits[15] === (check === 10 ? "X" : String(check));
}

function persons(value: RValue): RList {
  if (!isPerson(value))
    throw new RTypeMismatchError("NRT3450", "method is only applicable to 'person' objects");
  return value;
}

export function personField(value: RValue, name: RValue): RValue {
  const x = persons(value);
  if (name.type !== "character" || name.length !== 1 || isMissing(name, 0))
    throw new RTypeMismatchError("NRT3450", "'arg' must be NULL or a character vector");
  const matches = fields.filter((field) => field.startsWith(name.values[0]!));
  if (matches.length !== 1)
    throw new RTypeMismatchError(
      "NRT3450",
      `'arg' should be one of ${fields.map((field) => `"${field}"`).join(", ")}`,
    );
  const index = fields.indexOf(matches[0]!);
  const values = x.values.map((record) =>
    record.type === "list" ? (record.values[index] ?? R_NULL) : R_NULL,
  );
  return values.length === 0 ? R_NULL : values.length === 1 ? values[0]! : listValue(values);
}

export function subsetPerson(
  value: RValue,
  index: RValue | undefined,
  field: RValue | undefined,
  element: boolean,
  inv: BuiltinInvocation,
): RValue {
  const x = persons(value);
  const subset =
    element && index !== undefined
      ? listValue([extractVectorElement(x, index, inv.context)])
      : subsetVector(x, index, inv.context);
  if (subset.type !== "list") throw new RTypeMismatchError("NRT3450", "Invalid person subset.");
  if (subset.values.some((record) => record.type === "null")) warn(inv, "subscript out of bounds");
  const result = withClasses(listValue(subset.values.filter((record) => record.type !== "null")), [
    "person",
  ]);
  return field === undefined ? result : personField(result, field);
}

export function formatPerson(
  value: RValue,
  options: ReadonlyMap<string, RValue>,
  inv: BuiltinInvocation,
): RValue {
  const x = persons(value);
  const style = options.get("style");
  if (style !== undefined && (style.type !== "character" || style.values[0] !== "text"))
    throw new RUnsupportedFeatureError(
      "NRU6313",
      "person formatting currently supports text style only.",
    );
  const include =
    options.get("include") ?? characterVector(["given", "family", "email", "role", "comment"]);
  if (include.type !== "character")
    throw new RTypeMismatchError("NRT3450", "Invalid person format fields.");
  const defaults: Record<string, readonly string[]> = {
    given: ["", ""],
    family: ["", ""],
    email: ["<", ">"],
    role: ["[", "]"],
    comment: ["(", ")"],
  };
  const settings = (key: string, field: string): RValue | undefined => {
    const list = options.get(key);
    return list?.type === "list" ? list.values[vectorNames(list)?.indexOf(field) ?? -1] : undefined;
  };
  inv.context.allocate(x.length);
  return characterVector(
    x.values.map((record) => {
      if (record.type !== "list") throw new RTypeMismatchError("NRT3450", "Invalid person record.");
      return include.values
        .flatMap((field) => {
          const index = fields.indexOf(field as (typeof fields)[number]);
          const part = record.values[index];
          if (part?.type !== "character" || part.length === 0) return [];
          let values = [...part.values];
          if (field === "comment")
            values = values.map((text, i) => {
              const name = vectorNames(part)?.[i];
              if (!name) return text;
              if (name === "ROR")
                throw new RUnsupportedFeatureError(
                  "NRU6313",
                  "ROR comment formatting is not implemented.",
                );
              return `${name}: ${name === "ORCID" && validOrcid(text) ? `<https://orcid.org/${text}>` : text}`;
            });
          const collapse = settings("collapse", field);
          const first =
            collapse?.type === "logical" && (isMissing(collapse, 0) || collapse.values[0] === 0);
          const separator =
            collapse?.type === "character"
              ? (collapse.values[0] ?? "")
              : field === "given" || field === "family"
                ? " "
                : ", ";
          const braces = settings("braces", field);
          const pair = braces?.type === "character" ? braces.values : (defaults[field] ?? ["", ""]);
          return [
            `${pair[0] ?? ""}${first ? values[0] : values.join(separator)}${pair[1] ?? pair[0] ?? ""}`,
          ];
        })
        .join(" ");
    }),
  );
}
