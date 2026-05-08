/**
 * Console section parser.
 *
 * Phase 1: flat pass-through (every line is a top-level node).
 * Phase 2: marker detection (##[group]/##[endgroup] and ::group::/::endgroup::).
 */

export interface ConsoleSectionLine {
  kind: "line";
  /** Original 0-based index into the raw lines array. */
  index: number;
  content: string;
}

export interface ConsoleSectionGroup {
  kind: "group";
  title: string;
  /** Index of the marker line that opened this group. */
  startIndex: number;
  /** Index of the marker line that closed this group, or -1 if unclosed. */
  endIndex: number;
  children: ConsoleSectionNode[];
}

export type ConsoleSectionNode = ConsoleSectionLine | ConsoleSectionGroup;

/**
 * Parse raw console lines into a tree of sections.
 *
 * Currently returns a flat list (every line is a top-level node).
 * Phase 2 will add marker detection here.
 */
export function parseConsoleSections(
  lines: string[],
): ConsoleSectionNode[] {
  return lines.map((content, index) => ({
    kind: "line" as const,
    index,
    content,
  }));
}
