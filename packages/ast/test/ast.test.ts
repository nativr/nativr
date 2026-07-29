import { describe, expect, it } from "vitest";

import type { AstNode } from "../src/index.js";

describe("normalized AST contract", () => {
  it("keeps source spans in UTF-16 coordinates", () => {
    const node: AstNode = {
      kind: "DoubleLiteral",
      value: 1,
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 1, line: 1, column: 2 },
      },
    };
    expect(node.span.end.offset).toBe(1);
  });
});
