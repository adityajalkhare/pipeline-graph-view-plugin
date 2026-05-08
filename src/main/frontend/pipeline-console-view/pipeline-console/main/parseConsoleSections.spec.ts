/** * @vitest-environment jsdom */

import {
  parseConsoleSections,
  ConsoleSectionGroup,
  ConsoleSectionLine,
  compileSectionRules,
  applyRulesToSections,
} from "./parseConsoleSections.ts";

describe("parseConsoleSections", () => {
  // --- Phase 1: flat pass-through (no markers) ---

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

  // --- Phase 2: marker detection ---

  describe("Azure DevOps syntax (##[group]/##[endgroup])", () => {
    it("creates a group from ##[group] and ##[endgroup]", () => {
      const lines = [
        "before",
        "##[group]Build",
        "compiling...",
        "done",
        "##[endgroup]",
        "after",
      ];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ kind: "line", content: "before" });
      expect(result[2]).toMatchObject({ kind: "line", content: "after" });

      const group = result[1] as ConsoleSectionGroup;
      expect(group.kind).toBe("group");
      expect(group.title).toBe("Build");
      expect(group.startIndex).toBe(1);
      expect(group.endIndex).toBe(4);
      expect(group.children).toHaveLength(2);
      expect(group.children[0]).toMatchObject({
        kind: "line",
        index: 2,
        content: "compiling...",
      });
      expect(group.children[1]).toMatchObject({
        kind: "line",
        index: 3,
        content: "done",
      });
    });

    it("uses 'Section' as default title when none provided", () => {
      const lines = ["##[group]", "inside", "##[endgroup]"];
      const result = parseConsoleSections(lines);
      const group = result[0] as ConsoleSectionGroup;
      expect(group.title).toBe("Section");
    });

    it("trims trailing whitespace in title", () => {
      const lines = [
        "##[group]Install Dependencies  ",
        "npm ci",
        "##[endgroup]",
      ];
      const result = parseConsoleSections(lines);
      const group = result[0] as ConsoleSectionGroup;
      expect(group.title).toBe("Install Dependencies");
    });
  });

  describe("GitHub Actions syntax (::group::/::endgroup::)", () => {
    it("creates a group from ::group:: and ::endgroup::", () => {
      const lines = [
        "::group::Test Suite",
        "test 1 passed",
        "test 2 passed",
        "::endgroup::",
      ];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(1);

      const group = result[0] as ConsoleSectionGroup;
      expect(group.kind).toBe("group");
      expect(group.title).toBe("Test Suite");
      expect(group.startIndex).toBe(0);
      expect(group.endIndex).toBe(3);
      expect(group.children).toHaveLength(2);
    });
  });

  describe("mixed syntax", () => {
    it("handles ##[group] opened and ::endgroup:: closed", () => {
      const lines = ["##[group]Mixed", "inside", "::endgroup::"];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(1);
      const group = result[0] as ConsoleSectionGroup;
      expect(group.title).toBe("Mixed");
      expect(group.endIndex).toBe(2);
    });

    it("handles ::group:: opened and ##[endgroup] closed", () => {
      const lines = ["::group::Mixed2", "inside", "##[endgroup]"];
      const result = parseConsoleSections(lines);
      const group = result[0] as ConsoleSectionGroup;
      expect(group.title).toBe("Mixed2");
      expect(group.endIndex).toBe(2);
    });
  });

  describe("ANSI stripping for detection", () => {
    it("detects marker wrapped in ANSI codes and preserves ANSI in title", () => {
      const lines = [
        "\x1b[32m##[group]Colored\x1b[0m",
        "inside",
        "\x1b[32m##[endgroup]\x1b[0m",
      ];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(1);
      const group = result[0] as ConsoleSectionGroup;
      expect(group.kind).toBe("group");
      // Marker stripped, surrounding ANSI preserved for color rendering.
      expect(group.title).toBe("\x1b[32mColored\x1b[0m");
    });

    it("preserves ANSI codes placed after the marker", () => {
      const lines = [
        "##[group]\x1b[1;34mBold Blue Title\x1b[0m",
        "inside",
        "##[endgroup]",
      ];
      const result = parseConsoleSections(lines);
      const group = result[0] as ConsoleSectionGroup;
      expect(group.title).toBe("\x1b[1;34mBold Blue Title\x1b[0m");
    });

    it("detects marker with leading whitespace", () => {
      const lines = ["  ##[group]Indented", "inside", "  ##[endgroup]"];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(1);
      expect((result[0] as ConsoleSectionGroup).title).toBe("Indented");
    });
  });

  describe("HTML tag stripping for detection (AnsiColor plugin)", () => {
    it("detects marker inside HTML span tags", () => {
      const lines = [
        '<span style="color: #00CD00;">##[group]Green Title</span>',
        "inside",
        '<span style="color: #00CD00;">##[endgroup]</span>',
      ];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(1);
      const group = result[0] as ConsoleSectionGroup;
      expect(group.kind).toBe("group");
      // HTML preserved so dangerouslySetInnerHTML can render the color.
      expect(group.title).toBe(
        '<span style="color: #00CD00;">Green Title</span>',
      );
    });

    it("detects ::group:: inside HTML spans", () => {
      const lines = [
        '<span style="color: blue;">::group::Blue Section</span>',
        "inside",
        '<span style="color: blue;">::endgroup::</span>',
      ];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(1);
      const group = result[0] as ConsoleSectionGroup;
      expect(group.title).toBe(
        '<span style="color: blue;">Blue Section</span>',
      );
    });
  });

  describe("shell trace rejection", () => {
    it("does not treat '+ echo ##[group]...' as a marker", () => {
      const lines = [
        "+ echo ##[group]Build",
        "##[group]Build",
        "compiling",
        "##[endgroup]",
      ];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        kind: "line",
        index: 0,
        content: "+ echo ##[group]Build",
      });
      const group = result[1] as ConsoleSectionGroup;
      expect(group.kind).toBe("group");
      expect(group.title).toBe("Build");
    });

    it("does not treat '+ echo ::group::...' as a marker", () => {
      const lines = [
        "+ echo ::group::Test",
        "::group::Test",
        "testing",
        "::endgroup::",
      ];
      const result = parseConsoleSections(lines);
      expect(result[0]).toMatchObject({ kind: "line" });
      expect(result[1]).toMatchObject({ kind: "group" });
    });
  });

  describe("nesting", () => {
    it("supports nested groups", () => {
      const lines = [
        "##[group]Outer",
        "outer line",
        "##[group]Inner",
        "inner line",
        "##[endgroup]",
        "after inner",
        "##[endgroup]",
      ];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(1);

      const outer = result[0] as ConsoleSectionGroup;
      expect(outer.title).toBe("Outer");
      expect(outer.children).toHaveLength(3);
      expect(outer.children[0]).toMatchObject({
        kind: "line",
        content: "outer line",
      });

      const inner = outer.children[1] as ConsoleSectionGroup;
      expect(inner.kind).toBe("group");
      expect(inner.title).toBe("Inner");
      expect(inner.children).toHaveLength(1);
      expect(inner.children[0]).toMatchObject({
        kind: "line",
        content: "inner line",
      });

      expect(outer.children[2]).toMatchObject({
        kind: "line",
        content: "after inner",
      });
    });

    it("supports deeply nested groups", () => {
      const lines = [
        "##[group]L1",
        "##[group]L2",
        "##[group]L3",
        "deep",
        "##[endgroup]",
        "##[endgroup]",
        "##[endgroup]",
      ];
      const result = parseConsoleSections(lines);
      const l1 = result[0] as ConsoleSectionGroup;
      const l2 = l1.children[0] as ConsoleSectionGroup;
      const l3 = l2.children[0] as ConsoleSectionGroup;
      expect(l3.children[0]).toMatchObject({
        kind: "line",
        content: "deep",
      });
    });
  });

  describe("unclosed groups", () => {
    it("leaves endIndex as -1 for unclosed group", () => {
      const lines = ["##[group]Streaming", "line 1", "line 2"];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(1);
      const group = result[0] as ConsoleSectionGroup;
      expect(group.endIndex).toBe(-1);
      expect(group.children).toHaveLength(2);
    });

    it("handles unclosed nested group", () => {
      const lines = ["##[group]Outer", "##[group]Inner", "still going"];
      const result = parseConsoleSections(lines);
      const outer = result[0] as ConsoleSectionGroup;
      expect(outer.endIndex).toBe(-1);
      const inner = outer.children[0] as ConsoleSectionGroup;
      expect(inner.endIndex).toBe(-1);
    });
  });

  describe("stray endgroup", () => {
    it("treats stray ##[endgroup] as a plain line", () => {
      const lines = ["some output", "##[endgroup]", "more output"];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(3);
      expect(result[1]).toMatchObject({
        kind: "line",
        index: 1,
        content: "##[endgroup]",
      });
    });
  });

  describe("multiple groups", () => {
    it("handles sequential sibling groups", () => {
      const lines = [
        "##[group]First",
        "a",
        "##[endgroup]",
        "between",
        "##[group]Second",
        "b",
        "##[endgroup]",
      ];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(3);
      expect((result[0] as ConsoleSectionGroup).title).toBe("First");
      expect(result[1]).toMatchObject({ kind: "line", content: "between" });
      expect((result[2] as ConsoleSectionGroup).title).toBe("Second");
    });
  });

  describe("no-marker regression (Phase 1 compat)", () => {
    it("returns flat lines when no markers are present", () => {
      const lines = ["hello", "world", "foo"];
      const result = parseConsoleSections(lines);
      expect(result).toHaveLength(3);
      expect(result.every((n) => n.kind === "line")).toBe(true);
    });
  });
});

describe("compileSectionRules", () => {
  it("compiles valid rules", () => {
    const rules = compileSectionRules([
      {
        id: "test",
        displayName: "Test",
        startPattern: "^start$",
        endPattern: "^end$",
      },
    ]);
    expect(rules).toHaveLength(1);
    expect(rules[0].startPattern.test("start")).toBe(true);
    expect(rules[0].endPattern.test("end")).toBe(true);
  });

  it("skips rules with invalid regex", () => {
    const rules = compileSectionRules([
      {
        id: "bad",
        displayName: "Bad",
        startPattern: "^valid$",
        endPattern: "[invalid",
      },
      {
        id: "good",
        displayName: "Good",
        startPattern: "^start$",
        endPattern: "^end$",
      },
    ]);
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("good");
  });

  it("returns empty for empty input", () => {
    expect(compileSectionRules([])).toEqual([]);
  });
});

describe("applyRulesToSections", () => {
  const mavenRules = compileSectionRules([
    {
      id: "maven",
      displayName: "Maven Phase",
      startPattern: "^\\[INFO\\] --- (.+) ---$",
      endPattern: "^\\[INFO\\] --- .+ ---|^\\[INFO\\] -+$",
    },
  ]);

  it("creates a group from matching start/end lines", () => {
    const lines = [
      "[INFO] --- maven-compiler-plugin:3.8.1:compile (default) ---",
      "[INFO] Compiling 5 source files",
      "[INFO] All files up to date",
      "[INFO] -------------------------------------------------------",
    ];
    const flat = parseConsoleSections(lines);
    const result = applyRulesToSections(flat, mavenRules);
    expect(result).toHaveLength(2);
    const group = result[0] as ConsoleSectionGroup;
    expect(group.kind).toBe("group");
    expect(group.title).toBe("maven-compiler-plugin:3.8.1:compile (default)");
    expect(group.children).toHaveLength(2);
    // The end line is not inside the group.
    expect(result[1]).toMatchObject({ kind: "line", index: 3 });
  });

  it("chains sequential groups when end line matches new start", () => {
    const lines = [
      "[INFO] --- maven-compiler-plugin:3.8.1:compile ---",
      "compiling...",
      "[INFO] --- maven-surefire-plugin:2.22:test ---",
      "testing...",
      "[INFO] -------------------------------------------------------",
    ];
    const flat = parseConsoleSections(lines);
    const result = applyRulesToSections(flat, mavenRules);
    expect(result).toHaveLength(3);
    expect((result[0] as ConsoleSectionGroup).title).toBe(
      "maven-compiler-plugin:3.8.1:compile",
    );
    expect((result[0] as ConsoleSectionGroup).children).toHaveLength(1);
    expect((result[1] as ConsoleSectionGroup).title).toBe(
      "maven-surefire-plugin:2.22:test",
    );
    expect((result[1] as ConsoleSectionGroup).children).toHaveLength(1);
  });

  it("passes through marker-based groups unchanged", () => {
    const lines = [
      "##[group]Custom",
      "inside custom",
      "##[endgroup]",
      "[INFO] --- maven-compiler-plugin:3.8.1:compile ---",
      "compiling",
      "[INFO] -------------------------------------------------------",
    ];
    const markerParsed = parseConsoleSections(lines);
    const result = applyRulesToSections(markerParsed, mavenRules);
    // First is the marker group, second is the maven rule group, third is the end line.
    expect(result).toHaveLength(3);
    expect((result[0] as ConsoleSectionGroup).title).toBe("Custom");
    expect((result[1] as ConsoleSectionGroup).title).toBe(
      "maven-compiler-plugin:3.8.1:compile",
    );
  });

  it("returns nodes unchanged when no rules provided", () => {
    const lines = ["a", "b", "c"];
    const flat = parseConsoleSections(lines);
    const result = applyRulesToSections(flat, []);
    expect(result).toEqual(flat);
  });

  it("leaves unclosed rule group with endIndex -1", () => {
    const lines = [
      "[INFO] --- maven-compiler-plugin:3.8.1:compile ---",
      "still compiling...",
    ];
    const flat = parseConsoleSections(lines);
    const result = applyRulesToSections(flat, mavenRules);
    expect(result).toHaveLength(1);
    const group = result[0] as ConsoleSectionGroup;
    expect(group.endIndex).toBe(-1);
    expect(group.children).toHaveLength(1);
  });

  it("uses displayName as fallback when no capture group", () => {
    const noCapture = compileSectionRules([
      {
        id: "tf",
        displayName: "Terraform Plan",
        startPattern: "^Terraform will perform",
        endPattern: "^Plan: ",
      },
    ]);
    const lines = [
      "Terraform will perform the following actions:",
      "  + resource",
      "Plan: 1 to add",
    ];
    const flat = parseConsoleSections(lines);
    const result = applyRulesToSections(flat, noCapture);
    expect((result[0] as ConsoleSectionGroup).title).toBe("Terraform Plan");
  });
});
