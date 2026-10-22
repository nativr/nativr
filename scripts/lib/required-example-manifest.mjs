import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";

export const requiredExampleTitle =
  "runs the required Worker examples without evaluation network traffic";
export const requiredExampleSourcePath = "tests/e2e/playground.spec.ts";
export const requiredExampleManifestPath = "tests/e2e/helpers/required-example-profile-cases.json";
export const maximumManifestSourceBytes = 1024 * 1024;

export class RequiredExampleManifestError extends Error {
  constructor(code) {
    super(code);
    this.name = "RequiredExampleManifestError";
    this.code = code;
  }
}
const requireThat = (condition, code) => {
  if (!condition) throw new RequiredExampleManifestError(code);
};
const named = (node, name) => ts.isIdentifier(node) && node.text === name;
const string = (node) => node && ts.isStringLiteral(node);
// Playwright's default role name match is case-insensitive substring matching.
// Keep the owned control's current accessible label as a preflight boundary too.
const maySelectRun = (name) =>
  /^Run/u.test(name) || "run ctrl ↵".includes(name.trim().replace(/\s+/gu, " ").toLowerCase());

// This recognizes the reviewed owned fixture syntax, not arbitrary JavaScript control flow.
export function deriveRequiredExampleManifest(input) {
  requireThat(typeof input === "string", "MANIFEST_SOURCE");
  requireThat(Buffer.byteLength(input) <= maximumManifestSourceBytes, "MANIFEST_SOURCE_LIMIT");
  const source = input.replace(/\r\n?/gu, "\n");
  const sf = ts.createSourceFile(
    requiredExampleSourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  requireThat(sf.parseDiagnostics.length === 0, "MANIFEST_PARSE");
  const imports = sf.statements.filter(
    (node) =>
      ts.isImportDeclaration(node) &&
      string(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "./helpers/required-example-profile.js",
  );
  requireThat(imports.length === 1, "MANIFEST_IMPORT");
  const bindings = imports[0].importClause?.namedBindings;
  requireThat(bindings && ts.isNamedImports(bindings), "MANIFEST_IMPORT");
  for (const name of ["test", "expect", "profiledRun"])
    requireThat(
      bindings.elements.some((entry) => !entry.propertyName && entry.name.text === name),
      "MANIFEST_IMPORT",
    );
  const targets = sf.statements.filter(
    (node) =>
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      named(node.expression.expression, "test") &&
      string(node.expression.arguments[0]) &&
      node.expression.arguments[0].text === requiredExampleTitle,
  );
  requireThat(targets.length === 1, "MANIFEST_TARGET");
  const target = targets[0].expression;
  const callback = target.arguments[1];
  requireThat(
    target.arguments.length === 2 &&
      callback &&
      ts.isArrowFunction(callback) &&
      ts.isBlock(callback.body) &&
      callback.parameters.length === 1 &&
      callback.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword),
    "MANIFEST_CALLBACK",
  );
  const parameter = callback.parameters[0].name;
  requireThat(
    ts.isObjectBindingPattern(parameter) &&
      parameter.elements.length === 1 &&
      named(parameter.elements[0].name, "page") &&
      !parameter.elements[0].propertyName,
    "MANIFEST_CALLBACK",
  );

  const allProfileCalls = new Set();
  const timeoutCalls = [];
  function inspect(node) {
    if (ts.isIdentifier(node) && node.text === "profiledRun")
      requireThat(
        ts.isCallExpression(node.parent) && node.parent.expression === node,
        "MANIFEST_PROFILE_REFERENCE",
      );
    if (ts.isCallExpression(node)) {
      if (named(node.expression, "profiledRun")) allProfileCalls.add(node);
      if (ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (named(node.expression.expression, "test") && method === "setTimeout")
          timeoutCalls.push(node);
        // Only the currently reviewed static non-Run example/preview clicks may bypass profiling.
        if (method === "click") {
          const locator = node.expression.expression;
          requireThat(
            ts.isCallExpression(locator) &&
              ts.isPropertyAccessExpression(locator.expression) &&
              locator.expression.name.text === "getByRole" &&
              string(locator.arguments[0]) &&
              locator.arguments[0].text === "button" &&
              locator.arguments.length === 2 &&
              ts.isObjectLiteralExpression(locator.arguments[1]),
            "MANIFEST_UNPROFILED_ACTIVATION",
          );
          const nameProperties = locator.arguments[1].properties.filter(
            (property) =>
              ts.isPropertyAssignment(property) &&
              (named(property.name, "name") ||
                (string(property.name) && property.name.text === "name")),
          );
          requireThat(
            nameProperties.length === 1 &&
              string(nameProperties[0].initializer) &&
              !maySelectRun(nameProperties[0].initializer.text),
            "MANIFEST_UNPROFILED_ACTIVATION",
          );
          requireThat(
            locator.arguments[1].properties.every((property) => ts.isPropertyAssignment(property)),
            "MANIFEST_UNPROFILED_ACTIVATION",
          );
        }
        if (["press", "pressSequentially", "dispatchEvent", "dblclick", "tap"].includes(method))
          throw new RequiredExampleManifestError("MANIFEST_UNPROFILED_ACTIVATION");
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(callback.body);
  requireThat(
    timeoutCalls.length === 1 &&
      timeoutCalls[0].arguments.length === 1 &&
      ts.isNumericLiteral(timeoutCalls[0].arguments[0]) &&
      Number(timeoutCalls[0].arguments[0].text) === 120000 &&
      ts.isExpressionStatement(timeoutCalls[0].parent) &&
      timeoutCalls[0].parent.parent === callback.body,
    "MANIFEST_TIMEOUT",
  );

  const sites = [];
  const seen = new Set();
  const consumed = new Set();
  const containsProfile = (node) => {
    if (allProfileCalls.has(node)) return true;
    return ts.forEachChild(node, containsProfile) === true;
  };
  function sequence(statement) {
    if (ts.isBlock(statement)) return statement.statements.flatMap(sequence);
    if (ts.isForOfStatement(statement)) {
      requireThat(
        !statement.awaitModifier &&
          ts.isArrayLiteralExpression(statement.expression) &&
          statement.expression.elements.length > 0 &&
          statement.expression.elements.length <= 32 &&
          statement.expression.elements.every((element) => ts.isStringLiteral(element)) &&
          ts.isVariableDeclarationList(statement.initializer) &&
          (statement.initializer.flags & ts.NodeFlags.Const) !== 0 &&
          statement.initializer.declarations.length === 1 &&
          ts.isIdentifier(statement.initializer.declarations[0].name),
        "MANIFEST_LOOP",
      );
      const iteration = sequence(statement.statement);
      requireThat(
        iteration.length * statement.expression.elements.length <= 512,
        "MANIFEST_SAMPLE_LIMIT",
      );
      return Array.from({ length: statement.expression.elements.length }, () => iteration).flat();
    }
    requireThat(
      ts.isExpressionStatement(statement) || ts.isVariableStatement(statement),
      "MANIFEST_CONTROL_FLOW",
    );
    if (ts.isExpressionStatement(statement) && ts.isAwaitExpression(statement.expression)) {
      const call = statement.expression.expression;
      if (ts.isCallExpression(call) && named(call.expression, "profiledRun")) {
        requireThat(
          call.arguments.length === 2 &&
            named(call.arguments[0], "page") &&
            string(call.arguments[1]) &&
            /^required-\d{3}$/u.test(call.arguments[1].text),
          "MANIFEST_PROFILE_CALL",
        );
        const id = call.arguments[1].text;
        requireThat(!seen.has(id), "MANIFEST_DUPLICATE_ID");
        seen.add(id);
        consumed.add(call);
        sites.push({
          id,
          occurrences: 0,
          line: sf.getLineAndCharacterOfPosition(call.getStart(sf)).line + 1,
        });
        return [id];
      }
    }
    requireThat(!containsProfile(statement), "MANIFEST_PROFILE_CONTEXT");
    return [];
  }
  const ordered = sequence(callback.body);
  requireThat(ordered.length > 0 && ordered.length <= 512, "MANIFEST_SAMPLE_LIMIT");
  requireThat(consumed.size === allProfileCalls.size, "MANIFEST_PROFILE_CONTEXT");
  const counts = new Map();
  const sampleIds = ordered.map((id) => {
    const count = (counts.get(id) ?? 0) + 1;
    requireThat(count <= 99, "MANIFEST_SAMPLE_LIMIT");
    counts.set(id, count);
    return `${id}:${count}`;
  });
  for (const site of sites) site.occurrences = counts.get(site.id);
  return {
    schemaVersion: 1,
    testTitle: requiredExampleTitle,
    sourcePath: requiredExampleSourcePath,
    sourceHashPolicy: "lf-normalized-utf8",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    runSites: sites,
    sampleIds,
  };
}

export function verifyRequiredExampleManifest(source, manifest) {
  const expected = deriveRequiredExampleManifest(source);
  requireThat(isDeepStrictEqual(manifest, expected), "MANIFEST_STALE");
  return expected;
}

export function parseRequiredExampleManifestArgs(args) {
  requireThat(
    Array.isArray(args) &&
      (args.length === 0 || (args.length === 1 && ["--check", "--write"].includes(args[0]))),
    "MANIFEST_ARGUMENTS",
  );
  return args[0] === "--write" ? "write" : "check";
}
