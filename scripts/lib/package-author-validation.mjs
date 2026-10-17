// Independently specified dot-atom/quoted local part and dotted domain grammar.
// Native DESCRIPTION diagnostics, not deliverability or full RFC conformance, are the target.
export const packageEmailPattern =
  '(?:[A-Za-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:[.][A-Za-z0-9!#$%&\'*+/=?^_`{|}~-]+)*|"(?:[^"\\\\\r\n]|\\\\[^\r\n])+")@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)*';
const maintainerPattern = new RegExp(`<(${packageEmailPattern})>$`, "u");

export function assessEffectiveAuthorFields(fields, observation) {
  const verified =
    observation?.outcome === "match" &&
    observation.actual?.status === "completed" &&
    observation.expected?.status === "completed" &&
    observation.actual.fields !== null &&
    observation.actual.fields !== undefined &&
    observation.actual.fields.author === observation.expected.fields?.author &&
    observation.actual.fields.maintainer === observation.expected.fields?.maintainer;
  const expression = Boolean(fields.get("Authors@R")?.trim());
  const resolve = (key, property) =>
    fields.has(key)
      ? fields.get(key)
      : verified
        ? observation.actual.fields[property]
        : expression
          ? undefined
          : "";
  const author = resolve("Author", "author");
  const maintainer = resolve("Maintainer", "maintainer");
  const check = (id, value, passed, message) => ({
    id,
    status: value === undefined ? "unexecuted" : passed ? "passed" : "failed",
    message,
  });
  return {
    schemaVersion: 1,
    policy: "effective-author-fields-v1",
    checks: [
      check(
        "DESCRIPTION:effective:Author",
        author,
        Boolean(author?.trim()),
        "An explicit or independently verified derived Author field must be nonempty.",
      ),
      check(
        "DESCRIPTION:effective:Maintainer",
        maintainer,
        Boolean(maintainer?.trim()),
        "An explicit or independently verified derived Maintainer field must be nonempty.",
      ),
      check(
        "DESCRIPTION:maintainer-address",
        maintainer,
        maintainer !== undefined && maintainerPattern.test(maintainer.trim()),
        "The final angle-bracketed Maintainer address must satisfy the observed email grammar.",
      ),
    ],
    limitations: [
      "This does not establish full metadata validity, email deliverability, internationalized email support, or RFC conformance. Authors@R roles are assessed separately.",
      "Derived values require completed matching native evidence; absent or failed observations remain unexecuted. Present empty explicit fields retain precedence.",
    ],
  };
}
