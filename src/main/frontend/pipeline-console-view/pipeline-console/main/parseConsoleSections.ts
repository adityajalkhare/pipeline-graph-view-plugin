/**
 * Console section parser.
 *
 * Detects collapsible section markers in console output:
 * - Azure DevOps / GitHub Actions style: ##[group]Title / ##[endgroup]
 * - GitHub Actions style alias: ::group::Title / ::endgroup::
 *
 * Lines between markers are grouped into ConsoleSectionGroup nodes.
 * Unmatched lines remain flat ConsoleSectionLine nodes.
 * Nesting is supported (groups can contain groups).
 * Unclosed groups auto-close at end of input (endIndex = -1).
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

// ANSI escape sequence pattern for stripping before marker detection.
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

// Start markers: ##[group]Title or ::group::Title
const GROUP_START_RE = /^(?:##\[group\]|::group::)\s*(.*)$/;

// End markers: ##[endgroup] or ::endgroup::
const GROUP_END_RE = /^(?:##\[endgroup\]|::endgroup::)\s*$/;

/**
 * Strip ANSI escape codes and leading whitespace from a line
 * for marker detection purposes. The original content is preserved
 * in the output nodes.
 */
function stripForDetection(line: string): string {
  return line.replace(ANSI_RE, "").trimStart();
}

/**
 * Parse raw console lines into a tree of sections.
 *
 * Detects ##[group]/##[endgroup] and ::group::/::endgroup:: markers.
 * Lines between markers are grouped; all other lines remain flat.
 * Supports nesting. Unclosed groups get endIndex = -1.
 */
export function parseConsoleSections(
  lines: string[],
): ConsoleSectionNode[] {
  const root: ConsoleSectionNode[] = [];
  // Stack of open groups: each entry is the children array of the current group.
  const stack: { group: ConsoleSectionGroup; parent: ConsoleSectionNode[] }[] =
    [];

  function current(): ConsoleSectionNode[] {
    return stack.length > 0 ? stack[stack.length - 1].group.children : root;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const stripped = stripForDetection(raw);

    // Reject lines that look like shell trace of the echo command.
    // e.g. "+ echo ##[group]Build" should not be treated as a marker.
    if (stripped.startsWith("+ ")) {
      current().push({ kind: "line", index: i, content: raw });
      continue;
    }

    const startMatch = GROUP_START_RE.exec(stripped);
    if (startMatch) {
      const group: ConsoleSectionGroup = {
        kind: "group",
        title: startMatch[1] || "Section",
        startIndex: i,
        endIndex: -1,
        children: [],
      };
      current().push(group);
      stack.push({ group, parent: current() });
      continue;
    }

    if (GROUP_END_RE.test(stripped)) {
      if (stack.length > 0) {
        stack[stack.length - 1].group.endIndex = i;
        stack.pop();
      }
      // If no open group, ignore the stray endgroup marker (treat as normal line).
      else {
        current().push({ kind: "line", index: i, content: raw });
      }
      continue;
    }

    current().push({ kind: "line", index: i, content: raw });
  }

  // Unclosed groups keep endIndex = -1 (still streaming).
  return root;
}
