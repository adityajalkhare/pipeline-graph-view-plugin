/** * @vitest-environment jsdom */

import { parseConsoleSections } from "./parseConsoleSections.ts";

describe("parseConsoleSections", () => {
  it("returns empty array for empty input", () => {
    const result = parseConsoleSections([]);
    expect(result).toEqual([]);
  });

  it("returns flat line nodes for plain lines", () => {
    const lines = ["hello", "world", "foo"];
    const result = parseConsoleSections(lines);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ kind: "line", index: 0, content: "hello" });
    expect(result[1]).toEqual({ kind: "line", index: 1, content: "world" });
    expect(result[2]).toEqual({ kind: "line", index: 2, content: "foo" });
  });

  it("preserves original line indices", () => {
    const lines = ["a", "b", "c", "d"];
    const result = parseConsoleSections(lines);
    for (let i = 0; i < lines.length; i++) {
      expect(result[i]).toMatchObject({ kind: "line", index: i });
    }
  });

  it("handles single line input", () => {
    const result = parseConsoleSections(["only line"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ kind: "line", index: 0, content: "only line" });
  });

  it("preserves ANSI escape sequences in content", () => {
    const lines = ["\x1b[31mred text\x1b[0m", "normal"];
    const result = parseConsoleSections(lines);
    expect(result[0]).toMatchObject({
      kind: "line",
      content: "\x1b[31mred text\x1b[0m",
    });
  });
});
