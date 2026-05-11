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
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

// HTML tag pattern for stripping before marker detection.
// progressiveHtml returns HTML; AnsiColor plugin wraps ANSI codes in <span> tags.
const HTML_TAG_RE = /<[^>]*>/g;

// Start markers: ##[group]Title or ::group::Title
const GROUP_START_RE = /^(?:##\[group\]|::group::)\s*(.*)$/;

// End markers: ##[endgroup] or ::endgroup::
const GROUP_END_RE = /^(?:##\[endgroup\]|::endgroup::)\s*$/;

/**
 * Strip ANSI escape codes, HTML tags, and leading whitespace from a line
 * for marker detection purposes. The original content is preserved
 * in the output nodes.
 */
function stripForDetection(line: string): string {
  return line.replace(ANSI_RE, "").replace(HTML_TAG_RE, "").trimStart();
}

// Pattern matching the group-start marker itself (no capture).
// Used to strip the marker from the raw line while preserving surrounding
// HTML tags and ANSI codes for colored title rendering.
const GROUP_MARKER_RE = /##\[group\]|::group::/;

/**
 * Parse raw console lines into a tree of sections.
 *
 * Detects ##[group]/##[endgroup] and ::group::/::endgroup:: markers.
 * Lines between markers are grouped; all other lines remain flat.
 * Supports nesting. Unclosed groups get endIndex = -1.
 */
export function parseConsoleSections(lines: string[]): ConsoleSectionNode[] {
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
      // Strip the marker from the raw line, preserving surrounding HTML/ANSI
      // so the title renderer can show colors from the AnsiColor plugin.
      const title = raw.replace(GROUP_MARKER_RE, "").trim() || "Section";
      const group: ConsoleSectionGroup = {
        kind: "group",
        title,
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

/**
 * A compiled section rule for client-side application.
 */
export interface CompiledSectionRule {
  id: string;
  displayName: string;
  startPattern: RegExp;
  endPattern: RegExp;
}

/**
 * Compile rule data from the server into RegExp-bearing objects.
 * Invalid patterns are silently skipped.
 */
export function compileSectionRules(
  rules: Array<{
    id: string;
    displayName: string;
    startPattern: string;
    endPattern: string;
  }>,
): CompiledSectionRule[] {
  const compiled: CompiledSectionRule[] = [];
  for (const rule of rules) {
    try {
      compiled.push({
        id: rule.id,
        displayName: rule.displayName,
        startPattern: new RegExp(rule.startPattern),
        endPattern: new RegExp(rule.endPattern),
      });
    } catch {
      // Skip rules with invalid regex.
    }
  }
  return compiled;
}

/**
 * Apply compiled section rules to a flat list of ConsoleSectionNode[].
 *
 * Walks the top-level lines, matching start/end patterns to create groups.
 * Already-grouped nodes (from marker detection) are left untouched.
 * Rules are applied in order; the first matching rule wins for a given line.
 */
export function applyRulesToSections(
  nodes: ConsoleSectionNode[],
  rules: CompiledSectionRule[],
): ConsoleSectionNode[] {
  if (rules.length === 0) return nodes;

  const result: ConsoleSectionNode[] = [];
  let activeRule: CompiledSectionRule | null = null;
  let activeGroup: ConsoleSectionGroup | null = null;

  for (const node of nodes) {
    // Only process flat lines; pass groups through unchanged.
    if (node.kind === "group") {
      if (activeGroup) {
        activeGroup.children.push(node);
      } else {
        result.push(node);
      }
      continue;
    }

    const stripped = node.content.replace(ANSI_RE, "").trimStart();

    // Check if current line ends an active rule-based group.
    if (activeRule && activeGroup && activeRule.endPattern.test(stripped)) {
      // The end-line starts a new section of the same rule (e.g. next Maven phase).
      const startMatch = matchAnyRule(stripped, rules);
      if (startMatch) {
        activeGroup.endIndex = node.index;
        result.push(activeGroup);
        activeGroup = {
          kind: "group",
          title: startMatch.title,
          startIndex: node.index,
          endIndex: -1,
          children: [],
        };
        activeRule = startMatch.rule;
        continue;
      }
      activeGroup.endIndex = node.index;
      result.push(activeGroup);
      activeGroup = null;
      activeRule = null;
      result.push(node);
      continue;
    }

    // Check if a new rule-based group starts.
    if (!activeRule) {
      const startMatch = matchAnyRule(stripped, rules);
      if (startMatch) {
        activeGroup = {
          kind: "group",
          title: startMatch.title,
          startIndex: node.index,
          endIndex: -1,
          children: [],
        };
        activeRule = startMatch.rule;
        continue;
      }
    }

    if (activeGroup) {
      activeGroup.children.push(node);
    } else {
      result.push(node);
    }
  }

  // Close any unclosed rule-based group.
  if (activeGroup) {
    result.push(activeGroup);
  }

  return result;
}

function matchAnyRule(
  stripped: string,
  rules: CompiledSectionRule[],
): { rule: CompiledSectionRule; title: string } | null {
  for (const rule of rules) {
    const m = rule.startPattern.exec(stripped);
    if (m) {
      return {
        rule,
        title: m[1] || rule.displayName,
      };
    }
  }
  return null;
}
