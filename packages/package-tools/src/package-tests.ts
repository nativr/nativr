import type { PackageSourceFile } from "./source.js";

export const PACKAGE_TESTS_RESOURCE_PATH = ".nativr/tests-v1.json";
export const PACKAGE_TESTS_RESOURCE_ROOT = ".nativr/tests";

export interface PackageTestScript {
  readonly path: string;
  readonly expectedOutput: string;
}

export interface PackageTestsManifest {
  readonly format: "nativr-package-tests";
  readonly formatVersion: 1;
  readonly scripts: readonly PackageTestScript[];
}

export interface ExtractedPackageTests {
  readonly manifest: PackageTestsManifest;
  readonly resources: readonly { readonly path: string; readonly data: string }[];
}

/** Preserve source-package tests as inert, bounded resources for explicit P6 execution. */
export function extractPackageTests(
  files: readonly PackageSourceFile[],
): ExtractedPackageTests | undefined {
  const testFiles = files
    .filter((file) => /^tests\/[^/].*/u.test(file.path))
    .sort((left, right) => compareCPath(left.path, right.path));
  const paths = new Set(testFiles.map((file) => file.path));
  const scripts = testFiles
    .filter((file) => /^tests\/[^/]+\.[Rr]$/u.test(file.path))
    .map((file) => {
      const expected = file.path.replace(/\.[Rr]$/u, ".Rout.save");
      return Object.freeze({
        path: file.path.slice("tests/".length),
        expectedOutput: paths.has(expected) ? expected.slice("tests/".length) : "",
      });
    });
  if (scripts.length === 0) return undefined;
  return Object.freeze({
    manifest: Object.freeze({
      format: "nativr-package-tests",
      formatVersion: 1,
      scripts: Object.freeze(scripts),
    }),
    resources: Object.freeze(
      testFiles.map((file) =>
        Object.freeze({
          path: `${PACKAGE_TESTS_RESOURCE_ROOT}/${file.path.slice("tests/".length)}`,
          data: Buffer.from(file.data).toString("base64"),
        }),
      ),
    ),
  });
}

function compareCPath(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
