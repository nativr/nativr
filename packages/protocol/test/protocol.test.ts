import { describe, expect, it } from "vitest";

import {
  PROTOCOL_VERSION,
  isRValueSnapshot,
  isWorkerRequest,
  isWorkerResponse,
} from "../src/index.js";

describe("Worker protocol guards", () => {
  it("accepts versioned requests and rejects malformed versions", () => {
    expect(
      isWorkerRequest({
        protocolVersion: PROTOCOL_VERSION,
        id: "1",
        kind: "eval",
        code: "1 + 1",
      }),
    ).toBe(true);
    expect(isWorkerRequest({ protocolVersion: 99, id: "1", kind: "eval", code: "1" })).toBe(false);
  });

  it("validates snapshot mask lengths", () => {
    expect(
      isRValueSnapshot({
        version: 1,
        type: "double",
        values: new Float64Array([1, 2]),
        missing: new Uint8Array([0]),
      }),
    ).toBe(false);
  });

  it("validates parallel complex snapshot storage", () => {
    expect(
      isRValueSnapshot({
        version: 1,
        type: "complex",
        real: new Float64Array([1, 2]),
        imaginary: new Float64Array([3, 4]),
        missing: new Uint8Array([0, 1]),
      }),
    ).toBe(true);
    expect(
      isRValueSnapshot({
        version: 1,
        type: "complex",
        real: new Float64Array([1, 2]),
        imaginary: new Float64Array([3]),
      }),
    ).toBe(false);
  });

  it("validates raw snapshot bytes and dimensions", () => {
    expect(
      isRValueSnapshot({
        version: 1,
        type: "raw",
        values: new Uint8Array([1, 2]),
        dim: [1, 2],
      }),
    ).toBe(true);
    expect(
      isRValueSnapshot({
        version: 1,
        type: "raw",
        values: new Int32Array([1, 2]),
      }),
    ).toBe(false);
  });

  it("validates exact vector-name lengths and element types", () => {
    expect(
      isRValueSnapshot({
        version: 1,
        type: "double",
        values: new Float64Array([1, 2]),
        names: ["a", "b"],
      }),
    ).toBe(true);
    expect(
      isRValueSnapshot({
        version: 1,
        type: "double",
        values: new Float64Array([1, 2]),
        names: ["a"],
      }),
    ).toBe(false);
    expect(
      isRValueSnapshot({
        version: 1,
        type: "list",
        values: [{ version: 1, type: "null" }],
        names: [1],
      }),
    ).toBe(false);
  });

  it("rejects out-of-contract responses", () => {
    expect(isWorkerResponse({ protocolVersion: 1, id: "x", kind: "success", payload: {} })).toBe(
      false,
    );
  });

  it.each([
    {
      protocolVersion: 1,
      id: "init",
      kind: "init",
      assets: { treeSitterRuntimeWasm: "runtime.wasm", rGrammarWasm: "r.wasm" },
      packages: [
        {
          description: "Package: fixture\nVersion: 1.0.0",
          namespace: "export(square)",
          rSources: [{ path: "R/square.R", source: "square <- function(x) x ^ 2" }],
        },
      ],
      debug: false,
    },
    {
      protocolVersion: 1,
      id: "assign",
      kind: "assign",
      name: "x",
      value: { version: 1, type: "integer", values: new Int32Array([1]) },
    },
    { protocolVersion: 1, id: "get", kind: "get", name: "x" },
    {
      protocolVersion: 1,
      id: "call",
      kind: "call",
      name: "mean",
      arguments: [{ version: 1, type: "double", values: new Float64Array([1]) }],
    },
    { protocolVersion: 1, id: "capabilities", kind: "capabilities" },
    { protocolVersion: 1, id: "reset", kind: "reset" },
    { protocolVersion: 1, id: "dispose", kind: "dispose" },
  ])("accepts request kind $kind", (request) => {
    expect(isWorkerRequest(request)).toBe(true);
  });

  it("rejects malformed envelopes and request payloads", () => {
    expect(isWorkerRequest(null)).toBe(false);
    expect(isWorkerRequest({ protocolVersion: 1, id: "", kind: "reset" })).toBe(false);
    expect(isWorkerRequest({ protocolVersion: 1, id: "x", kind: "unknown" })).toBe(false);
    expect(isWorkerRequest({ protocolVersion: 1, id: "x", kind: "init", assets: {} })).toBe(false);
    expect(
      isWorkerRequest({
        protocolVersion: 1,
        id: "x",
        kind: "init",
        assets: { treeSitterRuntimeWasm: "runtime.wasm", rGrammarWasm: "r.wasm" },
        packages: [{ description: "bad", namespace: "", rSources: [{ path: 1, source: "" }] }],
        debug: false,
      }),
    ).toBe(false);
    expect(isWorkerRequest({ protocolVersion: 1, id: "x", kind: "eval", code: 1 })).toBe(false);
    expect(isWorkerRequest({ protocolVersion: 1, id: "x", kind: "assign", name: "x" })).toBe(false);
    expect(isWorkerRequest({ protocolVersion: 1, id: "x", kind: "get", name: 1 })).toBe(false);
    expect(isWorkerRequest({ protocolVersion: 1, id: "x", kind: "call", arguments: [] })).toBe(
      false,
    );
  });

  it.each([
    {
      protocolVersion: 1,
      id: "success",
      kind: "success",
      payload: { kind: "void" },
    },
    {
      protocolVersion: 1,
      id: "error",
      kind: "error",
      error: { name: "Error", code: "NRE1", message: "bad" },
    },
    {
      protocolVersion: 1,
      id: "warning",
      kind: "warning",
      warning: { code: "NRW1", message: "careful" },
    },
    {
      protocolVersion: 1,
      id: "output",
      kind: "output",
      stream: "stdout",
      text: "hello",
    },
  ])("accepts response kind $kind", (response) => {
    expect(isWorkerResponse(response)).toBe(true);
  });

  it("rejects malformed responses", () => {
    expect(isWorkerResponse(null)).toBe(false);
    expect(isWorkerResponse({ protocolVersion: 1, id: "x", kind: "unknown" })).toBe(false);
    expect(isWorkerResponse({ protocolVersion: 1, id: "x", kind: "error", error: {} })).toBe(false);
    expect(isWorkerResponse({ protocolVersion: 1, id: "x", kind: "warning", warning: {} })).toBe(
      false,
    );
    expect(isWorkerResponse({ protocolVersion: 1, id: "x", kind: "output", text: 1 })).toBe(false);
  });

  it.each([
    { version: 1, type: "null" },
    { version: 1, type: "logical", values: new Uint8Array([1]) },
    { version: 1, type: "integer", values: new Int32Array([1]) },
    { version: 1, type: "double", values: new Float64Array([1]) },
    { version: 1, type: "character", values: ["one"] },
    {
      version: 1,
      type: "list",
      values: [{ version: 1, type: "null" }],
    },
    {
      version: 1,
      type: "pairlist",
      values: [{ version: 1, type: "double", values: new Float64Array([1]) }],
      names: ["x"],
      dim: [1],
    },
    {
      version: 1,
      type: "formula",
      response: "y",
      terms: ["x", "z"],
      variables: ["y", "x", "z"],
      intercept: true,
    },
    { version: 1, type: "symbol", name: "alpha" },
    { version: 1, type: "language", source: "(1 + alpha)" },
    { version: 1, type: "expression", sources: ["alpha", "(1 + beta)"] },
  ])("accepts snapshot type $type", (snapshot) => {
    expect(isRValueSnapshot(snapshot)).toBe(true);
  });

  it("rejects malformed snapshots", () => {
    expect(isRValueSnapshot(null)).toBe(false);
    expect(isRValueSnapshot({ version: 2, type: "null" })).toBe(false);
    expect(isRValueSnapshot({ version: 1, type: "logical", values: [1] })).toBe(false);
    expect(isRValueSnapshot({ version: 1, type: "integer", values: new Uint8Array([1]) })).toBe(
      false,
    );
    expect(isRValueSnapshot({ version: 1, type: "double", values: [1] })).toBe(false);
    expect(isRValueSnapshot({ version: 1, type: "character", values: [1] })).toBe(false);
    expect(isRValueSnapshot({ version: 1, type: "list", values: [{}] })).toBe(false);
    expect(isRValueSnapshot({ version: 1, type: "pairlist", values: [{}] })).toBe(false);
    expect(
      isRValueSnapshot({
        version: 1,
        type: "pairlist",
        values: [{ version: 1, type: "null" }],
        dim: [2],
      }),
    ).toBe(false);
    expect(
      isRValueSnapshot({
        version: 1,
        type: "formula",
        terms: ["x", "x"],
        variables: ["x"],
        intercept: true,
      }),
    ).toBe(false);
    expect(
      isRValueSnapshot({
        version: 1,
        type: "formula",
        terms: ["x"],
        variables: ["x"],
        intercept: "yes",
      }),
    ).toBe(false);
    expect(isRValueSnapshot({ version: 1, type: "unknown" })).toBe(false);
    expect(
      isRValueSnapshot({
        version: 1,
        type: "double",
        values: new Float64Array([1, 2, 3, 4]),
        dim: [2, 3],
      }),
    ).toBe(false);
    expect(
      isRValueSnapshot({
        version: 1,
        type: "double",
        values: new Float64Array([1, 2, 3, 4]),
        dim: [2, 2],
      }),
    ).toBe(true);
    expect(isRValueSnapshot({ version: 1, type: "symbol", name: "" })).toBe(false);
    expect(isRValueSnapshot({ version: 1, type: "language", source: 1 })).toBe(false);
    expect(isRValueSnapshot({ version: 1, type: "expression", sources: ["x", 1] })).toBe(false);
  });
});
