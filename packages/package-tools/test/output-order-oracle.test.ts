import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";
import { alignOrderedOutput } from "../../../scripts/lib/package-output-order.mjs";
import {
  comparePackageCheckObservation,
  type PackageCheckComparisonOptions,
  type PackageCheckObservation,
} from "../src/index.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const root = new URL("../../../", import.meta.url);

interface RedactedEvent {
  readonly stream: string;
  readonly sha256: string;
  readonly utf8Bytes: number;
  readonly utf16Length: number;
}

interface OutputOrderEvidence {
  readonly rawReportSha256: string;
  readonly stage: { readonly discovered: readonly string[]; readonly executed: readonly string[] };
  readonly observations: readonly {
    readonly kind: string;
    readonly path: string;
    readonly expected: readonly RedactedEvent[];
    readonly actual: readonly RedactedEvent[];
  }[];
}

interface CorpusPins {
  readonly packages: readonly {
    readonly package: string;
    readonly version: string;
    readonly sourceSha256: string;
    readonly artifactSha256: string;
  }[];
}

describe("persisted output-order evidence", () => {
  it("keeps the abind output-order record pinned, redacted and fully executed", async () => {
    const text = await readFile(
      new URL("compatibility/package-check-evidence/output-order-v1-0.352.0.json", root),
      "utf8",
    );
    const evidence = JSON.parse(text) as OutputOrderEvidence;
    const corpus = JSON.parse(
      await readFile(new URL("compatibility/package-corpus.json", root), "utf8"),
    ) as CorpusPins;
    const pin = corpus.packages.find((entry) => entry.package === "abind");
    if (pin === undefined) throw new Error("abind is absent from the corpus.");
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      policy: "sha256-no-output-v1",
      capture: "merged-handle-unique-alignment-v1",
      package: { name: "abind", version: pin.version },
      provenance: {
        sourceSha256: pin.sourceSha256,
        artifactSha256: pin.artifactSha256,
        oracle: { implementation: "GNU R", version: "4.6.1" },
      },
      oracleRepeat: true,
      newlineTransport: "lf-to-crlf",
      p7Eligible: false,
      firstBlocker: "metadata-dependencies",
      stage: { id: "output-order", status: "passed" },
    });
    expect(evidence.rawReportSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(evidence.stage.discovered).toHaveLength(10);
    expect([...evidence.stage.executed].sort()).toEqual([...evidence.stage.discovered].sort());
    expect(evidence.observations).toHaveLength(10);
    for (const observation of evidence.observations) {
      expect(evidence.stage.executed).toContain(`${observation.kind}:${observation.path}`);
      expect(observation).toMatchObject({
        outcome: "match",
        crossStreamOrder: "compared",
        oracleAlignment: "complete",
        oracleRepeatOrderEqual: true,
      });
      for (const side of ["expected", "actual"] as const) {
        const events = observation[side];
        expect(events.length).toBeGreaterThan(0);
        for (const event of events) {
          expect(Object.keys(event).sort()).toEqual([
            "sha256",
            "stream",
            "utf16Length",
            "utf8Bytes",
          ]);
          expect(["stdout", "stderr"]).toContain(event.stream);
          expect(event.sha256).toMatch(/^[a-f0-9]{64}$/u);
        }
      }
      // Oracle text is recorded before CRLF reversal, so only the stream sequence is shared.
      expect(observation.expected.map((event) => event.stream)).toEqual(
        observation.actual.map((event) => event.stream),
      );
    }
    const interleaved = evidence.observations
      .filter((observation) => observation.expected.some((event) => event.stream === "stderr"))
      .map((observation) => observation.path);
    expect(interleaved).toEqual(["tests/adrop.R", "tests/afill.R"]);
    expect(text).not.toMatch(/"text"\s*:/u);
  });
});

describe("ordered output alignment", () => {
  it("assigns each merged byte to its stream when exactly one interleaving exists", () => {
    expect(alignOrderedOutput(bytes("ac\n"), bytes("b\n"), bytes("ab\nc\n"))).toEqual({
      status: "complete",
      events: [
        { stream: "stdout", text: "a" },
        { stream: "stderr", text: "b\n" },
        { stream: "stdout", text: "c\n" },
      ],
    });
  });

  it("returns one event, or none, when a stream is empty", () => {
    expect(alignOrderedOutput(bytes("x\n"), bytes(""), bytes("x\n"))).toEqual({
      status: "complete",
      events: [{ stream: "stdout", text: "x\n" }],
    });
    expect(alignOrderedOutput(bytes(""), bytes(""), bytes(""))).toEqual({
      status: "complete",
      events: [],
    });
  });

  it("refuses to choose between distinct interleavings", () => {
    // cat(1); message(1) and message(1); cat(1) merge to the same bytes.
    expect(alignOrderedOutput(bytes("1"), bytes("1\n"), bytes("11\n"))).toEqual({
      status: "ambiguous",
      reason: "multiple-interleavings",
    });
  });

  it("rejects merged bytes that no interleaving of the separate streams reproduces", () => {
    expect(alignOrderedOutput(bytes("a"), bytes("b"), bytes("ac")).status).toBe("inconsistent");
    expect(alignOrderedOutput(bytes("a"), bytes("b"), bytes("abc")).status).toBe("inconsistent");
    expect(alignOrderedOutput(bytes("a"), bytes(""), bytes("b")).status).toBe("inconsistent");
  });

  it("keeps CR and LF bytes exact and assigned to their own streams", () => {
    const stdout = bytes("a\r\nb\r");
    const stderr = bytes("w\r\n");
    expect(alignOrderedOutput(stdout, stderr, bytes("a\r\nw\r\nb\r"))).toEqual({
      status: "complete",
      events: [
        { stream: "stdout", text: "a\r\n" },
        { stream: "stderr", text: "w\r\n" },
        { stream: "stdout", text: "b\r" },
      ],
    });
  });

  it("does not split encoded characters across events", () => {
    const stdout = new Uint8Array([0xc3, 0xa9]);
    const stderr = bytes("x");
    expect(alignOrderedOutput(stdout, stderr, new Uint8Array([0xc3, 0x78, 0xa9]))).toEqual({
      status: "undecodable",
      reason: "event-boundary-splits-encoded-text",
    });
  });

  it("bounds alignment work on highly repetitive output", () => {
    const run = "\n".repeat(64);
    expect(
      alignOrderedOutput(bytes(run), bytes(run), bytes(run + run), { maxFrontier: 8 }),
    ).toEqual({ status: "unbounded", reason: "alignment-frontier-limit" });
  });
});

// Independently authored fixtures observed only through a separately installed black-box GNU R.
describe.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "native GNU R 4.6.1 ordered output capture",
  () => {
    const rscript = process.env.NATIVR_RSCRIPT ?? "Rscript";
    const transport = (text: string, windows: boolean) =>
      windows ? text.replaceAll("\n", "\r\n") : text;

    it("records partial-line emission order across stdout and stderr", async () => {
      const result = await capturePackageOracleScript({
        rscript,
        outputOrder: true,
        source: [
          'cat("a")',
          'message("b")',
          'cat("c\\n")',
          "print(1:3)",
          'warning("w")',
          'cat("x", file = stderr())',
          'cat("y\\n")',
        ].join("\n"),
      });
      const windows = result.runtimeSettings?.osType === "windows";
      expect(result.status).toBe("completed");
      expect(result.limitations).toMatchObject({
        crossStreamOrder: "merged-handle-unique-alignment-v1",
        outputOrder: "complete",
      });
      expect(result.outputOrder).toEqual(
        [
          { stream: "stdout", text: "a" },
          { stream: "stderr", text: "b\n" },
          { stream: "stdout", text: "c\n[1] 1 2 3\n" },
          { stream: "stderr", text: "Warning message:\nw \nx" },
          { stream: "stdout", text: "y\n" },
        ].map((event) => ({ ...event, text: transport(event.text, windows) })),
      );
      for (const stream of ["stdout", "stderr"] as const) {
        expect(
          result.outputOrder
            ?.filter((event) => event.stream === stream)
            .map((event) => event.text)
            .join(""),
        ).toBe(result[stream]);
      }
    });

    it("compares ordered native output exactly after the verified CRLF transport reversal", async () => {
      const result = await capturePackageOracleScript({
        rscript,
        outputOrder: true,
        source: 'cat("a\\nb\\r\\nc\\rd\\r\\r\\n")\nmessage("m")\ncat("e\\n")',
      });
      const windows = result.runtimeSettings?.osType === "windows";
      const options: PackageCheckComparisonOptions = {
        policyVersion: 1,
        adaptations: windows
          ? [
              {
                id: "oracle-text-crlf-v1",
                probeLiteralHex: "610a620d0a630d640d0d0a65",
                stdoutHex: "610d0a620d0d0a630d640d0d0d0a65",
                stderrHex: "610d0a620d0d0a630d640d0d0d0a65",
              },
            ]
          : [],
      };
      expect(result.outputOrder).toEqual([
        { stream: "stdout", text: transport("a\nb\r\nc\rd\r\r\n", windows) },
        { stream: "stderr", text: transport("m\n", windows) },
        { stream: "stdout", text: transport("e\n", windows) },
      ]);
      const expected: PackageCheckObservation = {
        status: "completed",
        freshSession: true,
        outputComplete: true,
        conditionsComplete: true,
        stdout: result.stdout,
        stderr: result.stderr,
        conditions: [],
        outputOrder: result.outputOrder,
      };
      const ordered = [
        { stream: "stdout", text: "a\nb\r\nc\rd\r\r\n" },
        { stream: "stderr", text: "m\n" },
        { stream: "stdout", text: "e\n" },
      ] as const;
      const actual = (events: PackageCheckObservation["outputOrder"] & object) => ({
        ...expected,
        stdout: "a\nb\r\nc\rd\r\r\ne\n",
        stderr: "m\n",
        outputOrder: events,
      });
      expect(comparePackageCheckObservation(actual(ordered), expected, options)).toMatchObject({
        outcome: "match",
        crossStreamOrder: "compared",
      });
      // The same bytes in another order remain a real, unnormalized difference.
      const reordered = [ordered[0], ordered[2], ordered[1]];
      expect(comparePackageCheckObservation(actual(reordered), expected, options)).toMatchObject({
        outcome: "mismatch",
        adaptedDifference: { field: "outputOrder" },
      });
    });

    it("preserves order across output larger than stream buffers", async () => {
      const result = await capturePackageOracleScript({
        rscript,
        outputOrder: true,
        source: 'for (k in 1:3) { print(seq_len(20000)); message("MARK", k) }',
      });
      expect(result.limitations.outputOrder).toBe("complete");
      const events = result.outputOrder ?? [];
      expect(events.map((event) => event.stream)).toEqual([
        "stdout",
        "stderr",
        "stdout",
        "stderr",
        "stdout",
        "stderr",
      ]);
      expect(
        events.filter((event) => event.stream === "stderr").map((event) => event.text.trimEnd()),
      ).toEqual(["MARK1", "MARK2", "MARK3"]);
    });

    it("leaves genuinely ambiguous interleavings unobserved", async () => {
      const result = await capturePackageOracleScript({
        rscript,
        outputOrder: true,
        source: "for (i in 1:3) { cat(i); message(i) }",
      });
      expect(result.status).toBe("completed");
      expect(result.outputOrder).toBeUndefined();
      expect(result.limitations).toMatchObject({
        crossStreamOrder: "unobserved",
        outputOrder: "ambiguous",
        outputOrderReason: "multiple-interleavings",
      });
    });

    it("does not record order for failed or unrequested captures", async () => {
      const failed = await capturePackageOracleScript({
        rscript,
        outputOrder: true,
        source: 'cat("before\\n")\nstop("unhandled")',
      });
      expect(failed.status).toBe("failed");
      expect(failed.outputOrder).toBeUndefined();
      expect(failed.limitations.outputOrder).toBe("incomplete");
      const unrequested = await capturePackageOracleScript({ rscript, source: 'cat("x\\n")' });
      expect(unrequested.outputOrder).toBeUndefined();
      expect(unrequested.limitations).toMatchObject({
        crossStreamOrder: "unobserved",
        outputOrder: "unrequested",
      });
    });

    it("runs the ordered session against freshly mounted fixtures", async () => {
      const result = await capturePackageOracleScript({
        rscript,
        outputOrder: true,
        files: [{ path: "state.txt", data: bytes("fresh\n") }],
        source: [
          'cat(readLines("state.txt"), "\\n")',
          'writeLines("changed", "state.txt")',
          'message("done")',
        ].join("\n"),
      });
      expect(result.limitations.outputOrder).toBe("complete");
      expect(result.outputOrder?.map((event) => event.text.replaceAll("\r\n", "\n"))).toEqual([
        "fresh \n",
        "done\n",
      ]);
    });
  },
);
