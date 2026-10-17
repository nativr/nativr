import { describe, expect, it } from "vitest";

import {
  comparePackageCheckObservation,
  createPackageCheckReport,
  PACKAGE_CHECK_STAGES,
  type PackageCheckComparisonOptions,
  type PackageCheckEvidence,
  type PackageCheckObservation,
  type PackageCheckStage,
  type PackageCheckTransportAdaptation,
} from "../src/index.js";

const comparison: PackageCheckComparisonOptions = { policyVersion: 1, adaptations: [] };
const crlfTransport: PackageCheckTransportAdaptation = {
  id: "oracle-text-crlf-v1",
  probeLiteralHex: "610a620d0a630d640d0d0a65",
  stdoutHex: "610d0a620d0d0a630d640d0d0d0a65",
  stderrHex: "610d0a620d0d0a630d640d0d0d0a65",
};

function observation(overrides: Partial<PackageCheckObservation> = {}): PackageCheckObservation {
  return {
    status: "completed",
    freshSession: true,
    outputComplete: true,
    conditionsComplete: true,
    stdout: "[1] 2\n",
    stderr: "",
    conditions: [],
    outputOrder: [{ stream: "stdout", text: "[1] 2\n" }],
    ...overrides,
  };
}

function evidence(overrides: Partial<PackageCheckEvidence> = {}): PackageCheckEvidence {
  const stages: PackageCheckStage[] = PACKAGE_CHECK_STAGES.map((id) => ({
    id,
    status: "passed",
    reason: `Independently observed ${id} check completed.`,
    discovered: [`${id}:criterion`],
    executed: [`${id}:criterion`],
  }));
  const replace = (stage: PackageCheckStage): void => {
    stages[stages.findIndex((entry) => entry.id === stage.id)] = stage;
  };
  replace({
    id: "examples",
    status: "inapplicable",
    reason: "Archive inventory contains no example blocks.",
    discovered: [],
    executed: [],
  });
  replace({
    id: "package-tests",
    status: "passed",
    reason: "Every discovered script completed.",
    discovered: ["tests/probe.R"],
    executed: ["tests/probe.R"],
  });
  for (const id of ["test-output", "output-order", "conditions"] as const) {
    replace({
      id,
      status: "passed",
      reason: "Every test observation compared.",
      discovered: ["test:tests/probe.R"],
      executed: ["test:tests/probe.R"],
    });
  }
  return {
    package: { name: "independentFixture", version: "1.0.0" },
    provenance: {
      sourceSha256: "a".repeat(64),
      artifactSha256: "b".repeat(64),
      oracle: { implementation: "GNU R", version: "4.6.1" },
      semanticProfile: "0.301.0",
      capabilitySha256: "c".repeat(64),
      runtimeLimits: {
        maxSteps: 100_000,
        maxCallDepth: 100,
        maxVectorLength: 10_000,
        maxOutputBytes: 10_000,
        maxPackageResourceBytes: 100_000,
      },
    },
    stages,
    observations: [
      { kind: "test", path: "tests/probe.R", actual: observation(), expected: observation() },
    ],
    comparison,
    ...overrides,
  };
}

describe("exact package-check observations", () => {
  it("compares exact whitespace and line endings without applying a display adaptation", () => {
    const actual = observation({
      stdout: "a b\r\n",
      outputOrder: [{ stream: "stdout", text: "a b\r\n" }],
    });
    const expected = observation({
      stdout: "a  b\n",
      outputOrder: [{ stream: "stdout", text: "a  b\n" }],
    });
    const result = comparePackageCheckObservation(actual, expected, comparison);
    expect(result.outcome).toBe("mismatch");
    expect(result.rawDifference).toEqual({
      field: "stdout",
      index: 2,
      expected: " b\n",
      actual: "b\r\n",
    });
    expect(result.adaptedDifference).toEqual(result.rawDifference);
    expect(result.adaptations).toEqual([]);
  });

  it("keeps bytecode identity differences visible under the initial policy", () => {
    const expected = observation({
      stdout: "[1] 2\n<bytecode: 0x123>\n",
      outputOrder: [{ stream: "stdout", text: "[1] 2\n<bytecode: 0x123>\n" }],
    });
    expect(comparePackageCheckObservation(observation(), expected, comparison)).toMatchObject({
      outcome: "mismatch",
      rawDifference: { field: "stdout", index: 6 },
    });
    expect(() =>
      comparePackageCheckObservation(observation(), expected, {
        policyVersion: 1,
        adaptations: [{ id: "remove-lines" }],
      } as unknown as PackageCheckComparisonOptions),
    ).toThrow("transport probe");
  });

  it("compares warning class, message, call, and ordering independently of printed text", () => {
    const warning = {
      kind: "warning" as const,
      classes: ["simpleWarning", "warning", "condition"],
      message: "fixture warning",
      call: "probe()",
    };
    const expected = observation({ conditions: [warning] });
    for (const replacement of [
      { ...warning, message: "different" },
      { ...warning, classes: ["warning", "condition"] },
      { ...warning, call: null },
    ]) {
      expect(
        comparePackageCheckObservation(
          observation({ conditions: [replacement] }),
          expected,
          comparison,
        ),
      ).toMatchObject({ outcome: "mismatch", rawDifference: { field: "conditions", index: 0 } });
    }
    const other = { ...warning, message: "second" };
    expect(
      comparePackageCheckObservation(
        observation({ conditions: [other, warning] }),
        observation({ conditions: [warning, other] }),
        comparison,
      ).outcome,
    ).toBe("mismatch");
  });

  it("reports unavailable condition metadata without inventing classes or calls", () => {
    const actual = observation({
      conditionsComplete: false,
      conditions: [{ kind: "warning", classes: [], message: "fixture warning" }],
    });
    const expected = observation({
      conditions: [
        {
          kind: "warning",
          classes: ["simpleWarning", "warning", "condition"],
          message: "fixture warning",
          call: null,
        },
      ],
    });
    expect(comparePackageCheckObservation(actual, expected, comparison)).toMatchObject({
      outcome: "match",
      conditionEvidence: "incomplete",
    });
    expect(() =>
      comparePackageCheckObservation({ ...actual, conditionsComplete: true }, expected, comparison),
    ).toThrow("condition observation");
  });

  it("distinguishes captured cross-stream order from independent pipes", () => {
    const expected = observation({
      stdout: "ab",
      stderr: "!",
      outputOrder: [
        { stream: "stdout", text: "a" },
        { stream: "stderr", text: "!" },
        { stream: "stdout", text: "b" },
      ],
    });
    const actual = observation({
      stdout: "ab",
      stderr: "!",
      outputOrder: [
        { stream: "stdout", text: "ab" },
        { stream: "stderr", text: "!" },
      ],
    });
    expect(comparePackageCheckObservation(actual, expected, comparison)).toMatchObject({
      outcome: "mismatch",
      crossStreamOrder: "compared",
      rawDifference: { field: "outputOrder" },
    });
    const independentPipes = { ...actual };
    delete independentPipes.outputOrder;
    expect(comparePackageCheckObservation(independentPipes, expected, comparison)).toMatchObject({
      outcome: "match",
      crossStreamOrder: "unobserved",
    });
    expect(
      comparePackageCheckObservation(
        observation({
          outputOrder: [
            { stream: "stdout", text: "[1] " },
            { stream: "stdout", text: "2\n" },
          ],
        }),
        observation(),
        comparison,
      ).outcome,
    ).toBe("match");
  });

  it("rejects an output-order record that omits captured stream bytes", () => {
    expect(() =>
      comparePackageCheckObservation(observation({ outputOrder: [] }), observation(), comparison),
    ).toThrow("both exact streams");
  });

  it("does not interpret an absent expectation as a matching empty result", () => {
    expect(comparePackageCheckObservation(observation(), undefined, comparison)).toMatchObject({
      outcome: "no-expectation",
      rawDifference: null,
      adaptedDifference: null,
    });
  });

  it("reverses verified oracle LF transport once while retaining raw and adapted evidence", () => {
    const text = "a\nb\r\nc\rd\r\r\né中😀";
    const actual = observation({
      stdout: text,
      stderr: "warning\n",
      outputOrder: [
        { stream: "stdout", text },
        { stream: "stderr", text: "warning\n" },
      ],
    });
    const expectedText = text.replaceAll("\n", "\r\n");
    const expected = observation({
      stdout: expectedText,
      stderr: "warning\r\n",
      outputOrder: [
        { stream: "stdout", text: expectedText },
        { stream: "stderr", text: "warning\r\n" },
      ],
    });
    const result = comparePackageCheckObservation(actual, expected, {
      policyVersion: 1,
      adaptations: [crlfTransport],
    });
    expect(result).toMatchObject({
      outcome: "match",
      rawDifference: { field: "stdout", index: 1 },
      adaptedDifference: null,
      adaptations: [{ ...crlfTransport, transformedPairs: { stdout: 3, stderr: 1 } }],
    });
    expect(expected.stdout).toBe(expectedText);
    expect(actual.stdout).toBe(text);
  });

  it("does not normalize actual CRLF, condition text, whitespace, or bytecode lines", () => {
    const options = { policyVersion: 1 as const, adaptations: [crlfTransport] };
    const actual = observation({
      stdout: "literal\r\n",
      outputOrder: [{ stream: "stdout", text: "literal\r\n" }],
    });
    const expected = observation({
      stdout: "literal\r\n",
      outputOrder: [{ stream: "stdout", text: "literal\r\n" }],
    });
    expect(comparePackageCheckObservation(actual, expected, options)).toMatchObject({
      outcome: "mismatch",
      rawDifference: null,
      adaptedDifference: { field: "stdout", index: 7 },
    });
    const condition = {
      kind: "warning" as const,
      classes: ["warning", "condition"],
      message: "literal\r\n",
      call: null,
    };
    expect(
      comparePackageCheckObservation(
        observation({ conditions: [condition] }),
        observation({
          stdout: "[1] 2\r\n",
          outputOrder: [{ stream: "stdout", text: "[1] 2\r\n" }],
          conditions: [{ ...condition, message: "literal\n" }],
        }),
        options,
      ).adaptedDifference,
    ).toMatchObject({ field: "conditions" });
    expect(
      comparePackageCheckObservation(
        observation(),
        observation({
          stdout: "[1]  2\r\n<bytecode: 0x123>\r\n",
          outputOrder: [{ stream: "stdout", text: "[1]  2\r\n<bytecode: 0x123>\r\n" }],
        }),
        options,
      ).outcome,
    ).toBe("mismatch");
  });

  it("preserves ordered chunks when transport CRLF straddles captures", () => {
    const actual = observation({
      stdout: "a\r\nb\n",
      stderr: "!",
      outputOrder: [
        { stream: "stdout", text: "a\r" },
        { stream: "stderr", text: "!" },
        { stream: "stdout", text: "\nb\n" },
      ],
    });
    const expected = observation({
      stdout: "a\r\r\nb\r\n",
      stderr: "!",
      outputOrder: [
        { stream: "stdout", text: "a\r\r" },
        { stream: "stderr", text: "!" },
        { stream: "stdout", text: "\nb\r" },
        { stream: "stdout", text: "\n" },
      ],
    });
    expect(
      comparePackageCheckObservation(actual, expected, {
        policyVersion: 1,
        adaptations: [crlfTransport],
      }),
    ).toMatchObject({
      outcome: "match",
      crossStreamOrder: "compared",
      adaptedDifference: null,
      adaptations: [{ transformedPairs: { stdout: 2, stderr: 0 } }],
    });
  });

  it.each(["literal", "stdout", "stderr", "identity", "duplicate"] as const)(
    "rejects invalid %s transport evidence",
    (surface) => {
      const adapted =
        surface === "literal"
          ? { ...crlfTransport, probeLiteralHex: "610a62" }
          : surface === "stdout"
            ? { ...crlfTransport, stdoutHex: "610d0a62" }
            : surface === "stderr"
              ? { ...crlfTransport, stderrHex: "610d0a62" }
              : surface === "identity"
                ? {
                    ...crlfTransport,
                    stdoutHex: crlfTransport.probeLiteralHex,
                    stderrHex: crlfTransport.probeLiteralHex,
                  }
                : crlfTransport;
      expect(() =>
        comparePackageCheckObservation(observation(), observation(), {
          policyVersion: 1,
          adaptations: surface === "duplicate" ? [adapted, adapted] : [adapted],
        }),
      ).toThrow(/transport/u);
    },
  );
});

describe("package-check evidence reports", () => {
  it.each(["outputOrder", "stdout", "conditions"] as const)(
    "fails output-order independently when the first comparison difference is %s",
    (firstField) => {
      const condition = {
        kind: "warning" as const,
        classes: ["warning", "condition"],
        message: "expected",
        call: null,
      };
      const actual = observation({
        stdout: "a",
        stderr: "b",
        outputOrder: [
          { stream: "stdout", text: "a" },
          { stream: "stderr", text: "b" },
        ],
        conditions: firstField === "conditions" ? [{ ...condition, message: "actual" }] : [],
      });
      const expectedStdout = firstField === "stdout" ? "x" : "a";
      const expected = observation({
        stdout: expectedStdout,
        stderr: "b",
        outputOrder: [
          { stream: "stderr", text: "b" },
          { stream: "stdout", text: expectedStdout },
        ],
        conditions: firstField === "conditions" ? [condition] : [],
      });
      const result = createPackageCheckReport(
        evidence({ observations: [{ kind: "test", path: "tests/probe.R", actual, expected }] }),
      );
      expect(result.observations[0]?.comparison.rawDifference?.field).toBe(firstField);
      expect(result.stages.find((stage) => stage.id === "output-order")).toMatchObject({
        status: "failed",
        reason:
          "Complete observed output event sequences differ after declared transport adaptations.",
      });
      expect(result.p7Eligible).toBe(false);
    },
  );

  it("grades ordered events after the same verified oracle transport reversal", () => {
    const actual = observation({
      stdout: "a\n",
      stderr: "b\n",
      outputOrder: [
        { stream: "stdout", text: "a\n" },
        { stream: "stderr", text: "b\n" },
      ],
    });
    const expected = observation({
      stdout: "a\r\n",
      stderr: "b\r\n",
      outputOrder: [
        { stream: "stdout", text: "a\r" },
        { stream: "stdout", text: "\n" },
        { stream: "stderr", text: "b\r\n" },
      ],
    });
    const result = createPackageCheckReport(
      evidence({
        comparison: { policyVersion: 1, adaptations: [crlfTransport] },
        observations: [{ kind: "test", path: "tests/probe.R", actual, expected }],
      }),
    );
    expect(result.observations[0]?.comparison).toMatchObject({
      outcome: "match",
      rawDifference: { field: "stdout" },
      adaptedDifference: null,
    });
    expect(result.stages.find((stage) => stage.id === "output-order")?.status).toBe("passed");
    expect(result.p7Eligible).toBe(true);
  });

  it("does not pass output-order when the recorded streams are incomplete", () => {
    const result = createPackageCheckReport(
      evidence({
        observations: [
          {
            kind: "test",
            path: "tests/probe.R",
            actual: observation({ outputComplete: false }),
            expected: observation(),
          },
        ],
      }),
    );
    expect(result.stages.find((stage) => stage.id === "output-order")).toMatchObject({
      status: "unexecuted",
      reason: "Complete output ordering cannot be established from incomplete stream captures.",
    });
    expect(result.p7Eligible).toBe(false);
  });

  it("fails the conditions stage even when an earlier stdout difference is reported first", () => {
    const condition = {
      kind: "warning" as const,
      classes: ["warning", "condition"],
      message: "expected",
      call: null,
    };
    const actual = observation({
      stdout: "different\n",
      outputOrder: [{ stream: "stdout", text: "different\n" }],
      conditions: [{ ...condition, message: "actual" }],
    });
    const expected = observation({ conditions: [condition] });
    const result = createPackageCheckReport(
      evidence({ observations: [{ kind: "test", path: "tests/probe.R", actual, expected }] }),
    );
    expect(result.observations[0]?.comparison.rawDifference?.field).toBe("stdout");
    expect(result.stages.find((stage) => stage.id === "conditions")).toMatchObject({
      status: "failed",
      reason: "Complete observed condition classes, messages, calls, or ordering differ.",
    });
    expect(result.p7Eligible).toBe(false);
  });

  it("preserves the explicit ordering limitation when its executed inventory is empty", () => {
    const input = evidence();
    const actual = { ...observation() };
    delete actual.outputOrder;
    const result = createPackageCheckReport({
      ...input,
      stages: input.stages.map((stage) =>
        stage.id === "output-order"
          ? {
              ...stage,
              status: "unexecuted",
              executed: [],
              reason: "Separate native pipes cannot establish emission order.",
            }
          : stage,
      ),
      observations: [{ kind: "test", path: "tests/probe.R", actual, expected: observation() }],
    });
    const stage = result.stages.find((candidate) => candidate.id === "output-order");
    expect(stage?.status).toBe("unexecuted");
    expect(stage?.reason).toContain("Separate native pipes cannot establish emission order.");
    expect(stage?.reason).toContain("Output inventories");
  });

  it("requires complete stage evidence and snapshots supplied observations", () => {
    const input = evidence();
    const result = createPackageCheckReport(input);
    expect(result).toMatchObject({ schemaVersion: 1, p7Eligible: true, firstBlocker: null });
    expect(result.stages.map((stage) => stage.id)).toEqual(PACKAGE_CHECK_STAGES);
    expect(result.provenance).toEqual(input.provenance);
    expect(result.provenance).not.toBe(input.provenance);
    expect(result.observations[0]?.actual).not.toBe(input.observations[0]?.actual);
  });

  it.each(PACKAGE_CHECK_STAGES)("does not promote evidence with omitted %s stage", (id) => {
    const input = evidence();
    const result = createPackageCheckReport({
      ...input,
      stages: input.stages.filter((stage) => stage.id !== id),
    });
    expect(result.p7Eligible).toBe(false);
    expect(result.stages.find((stage) => stage.id === id)?.status).not.toBe("passed");
  });

  it("detects a test subset even when every selected observation matches", () => {
    const input = evidence();
    const result = createPackageCheckReport({
      ...input,
      stages: input.stages.map((stage) =>
        stage.id === "package-tests"
          ? { ...stage, discovered: [...stage.discovered, "tests/other.R"] }
          : stage,
      ),
    });
    expect(result).toMatchObject({
      p7Eligible: false,
      firstBlocker: { stage: "package-tests", code: "incomplete-inventory", path: "tests/other.R" },
    });
  });

  it("rejects passed output checks with missing oracle expectations", () => {
    const result = createPackageCheckReport(
      evidence({ observations: [{ kind: "test", path: "tests/probe.R", actual: observation() }] }),
    );
    expect(result.p7Eligible).toBe(false);
    expect(result.observations[0]?.comparison.outcome).toBe("no-expectation");
    expect(result.stages.find((stage) => stage.id === "test-output")?.status).toBe("unexecuted");
  });

  it("never grades a comparison against a non-repeatable oracle capture", () => {
    const differing = observation({
      stdout: "[1] 3\n",
      outputOrder: [{ stream: "stdout", text: "[1] 3\n" }],
    });
    for (const actual of [observation(), differing]) {
      const result = createPackageCheckReport(
        evidence({
          observations: [
            {
              kind: "test",
              path: "tests/probe.R",
              actual,
              expected: observation({ repeatable: false }),
            },
          ],
        }),
      );
      const stage = result.stages.find((entry) => entry.id === "test-output");
      expect(stage?.status).toBe("unexecuted");
      expect(result.p7Eligible).toBe(false);
      expect(result.firstBlocker).toMatchObject({
        stage: "test-output",
        code: "oracle-nondeterministic",
        path: "tests/probe.R",
      });
    }
  });

  it("rejects a non-boolean oracle repeatability record", () => {
    expect(() =>
      comparePackageCheckObservation(
        observation(),
        { ...observation(), repeatable: "no" } as unknown as PackageCheckObservation,
        comparison,
      ),
    ).toThrow("Invalid package-check execution observation.");
  });

  it("rejects a passed test inventory with no observations", () => {
    const result = createPackageCheckReport(evidence({ observations: [] }));
    expect(result.p7Eligible).toBe(false);
    expect(result.stages.find((stage) => stage.id === "package-tests")?.status).toBe("unexecuted");
  });

  it("keeps failures and first raw output differences instead of normalizing them away", () => {
    const actual = observation({
      stdout: "[1]   2\n",
      outputOrder: [{ stream: "stdout", text: "[1]   2\n" }],
    });
    const result = createPackageCheckReport(
      evidence({
        observations: [{ kind: "test", path: "tests/probe.R", actual, expected: observation() }],
      }),
    );
    expect(result).toMatchObject({
      p7Eligible: false,
      firstBlocker: { stage: "test-output", code: "observation-mismatch", path: "tests/probe.R" },
    });
    expect(result.observations[0]?.comparison.rawDifference).toMatchObject({
      field: "stdout",
      index: 4,
    });
  });

  it("cannot pass failed executions even if oracle and NativR failures agree", () => {
    const failed = observation({ status: "failed" });
    const result = createPackageCheckReport(
      evidence({
        observations: [{ kind: "test", path: "tests/probe.R", actual: failed, expected: failed }],
      }),
    );
    expect(result).toMatchObject({
      p7Eligible: false,
      firstBlocker: { stage: "package-tests", code: "execution-failed" },
    });
  });

  it.each(["output", "conditions", "isolation", "ordering"] as const)(
    "keeps unobserved %s as a P7 blocker",
    (surface) => {
      const complete = observation();
      const withoutOrder = { ...complete };
      delete withoutOrder.outputOrder;
      const actual =
        surface === "output"
          ? { ...complete, outputComplete: false }
          : surface === "conditions"
            ? { ...complete, conditionsComplete: false }
            : surface === "isolation"
              ? { ...complete, freshSession: false }
              : withoutOrder;
      const result = createPackageCheckReport(
        evidence({
          observations: [{ kind: "test", path: "tests/probe.R", actual, expected: complete }],
        }),
      );
      expect(result.p7Eligible).toBe(false);
    },
  );

  it.each(["digest", "oracle", "profile", "limit", "missing-limit"] as const)(
    "rejects invalid %s provenance",
    (surface) => {
      const input = evidence();
      const provenance =
        surface === "digest"
          ? { ...input.provenance, capabilitySha256: "not-a-hash" }
          : surface === "oracle"
            ? {
                ...input.provenance,
                oracle: { implementation: "GNU R" as const, version: "4.6.0" },
              }
            : surface === "profile"
              ? { ...input.provenance, semanticProfile: "latest" }
              : {
                  ...input.provenance,
                  runtimeLimits: {
                    ...input.provenance.runtimeLimits,
                    maxSteps: surface === "limit" ? Infinity : undefined,
                  },
                };
      const result = createPackageCheckReport({ ...input, provenance } as PackageCheckEvidence);
      expect(result).toMatchObject({
        p7Eligible: false,
        firstBlocker: { stage: "provenance", code: "invalid-provenance" },
      });
    },
  );

  it("requires a reason and an empty inventory for inapplicable stages", () => {
    const input = evidence();
    expect(() =>
      createPackageCheckReport({
        ...input,
        stages: input.stages.map((stage) =>
          stage.id === "examples" ? { ...stage, reason: "" } : stage,
        ),
      }),
    ).toThrow("non-empty reason");
    const result = createPackageCheckReport({
      ...input,
      stages: input.stages.map((stage) =>
        stage.id === "package-tests" ? { ...stage, status: "inapplicable" } : stage,
      ),
    });
    expect(result).toMatchObject({
      p7Eligible: false,
      firstBlocker: { stage: "package-tests", code: "invalid-inapplicability" },
    });
  });

  it("does not allow installation or source checks to be declared inapplicable", () => {
    const input = evidence();
    const result = createPackageCheckReport({
      ...input,
      stages: input.stages.map((stage) =>
        stage.id === "installation-loading"
          ? { ...stage, status: "inapplicable", discovered: [], executed: [] }
          : stage,
      ),
    });
    expect(result).toMatchObject({
      p7Eligible: false,
      firstBlocker: { stage: "installation-loading", code: "invalid-inapplicability" },
    });
  });

  it("requires exact output inventories and refuses duplicate observations", () => {
    const input = evidence();
    const result = createPackageCheckReport({
      ...input,
      stages: input.stages.map((stage) =>
        stage.id === "conditions"
          ? { ...stage, discovered: ["invented"], executed: ["invented"] }
          : stage,
      ),
    });
    expect(result.p7Eligible).toBe(false);
    expect(() =>
      createPackageCheckReport({
        ...input,
        observations: [...input.observations, ...input.observations],
      }),
    ).toThrow("Duplicate package-check observation");
  });
});
