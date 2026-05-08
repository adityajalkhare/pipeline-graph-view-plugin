import { memo, useState } from "react";

import {
  ConsoleSectionGroup,
  ConsoleSectionNode,
} from "./parseConsoleSections.ts";
import { ConsoleLine } from "./ConsoleLine.tsx";

export interface ConsoleSectionProps {
  group: ConsoleSectionGroup;
  stepId: string;
  startByte: number;
  stopTailingLogs: () => void;
  currentRunPath: string;
}

export const ConsoleSection = memo(function ConsoleSection({
  group,
  stepId,
  startByte,
  stopTailingLogs,
  currentRunPath,
}: ConsoleSectionProps) {
  // Unclosed groups (still streaming) default to open.
  const [open, setOpen] = useState(group.endIndex === -1);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="pgv-console-section"
    >
      <summary className="pgv-console-section__summary">
        <span className="pgv-console-section__title">{group.title}</span>
        <span className="pgv-console-section__count">
          {group.children.length}{" "}
          {group.children.length === 1 ? "line" : "lines"}
        </span>
      </summary>
      <div className="pgv-console-section__body">
        {group.children.map((node) => (
          <ConsoleSectionNodeRenderer
            key={nodeKey(node)}
            node={node}
            stepId={stepId}
            startByte={startByte}
            stopTailingLogs={stopTailingLogs}
            currentRunPath={currentRunPath}
          />
        ))}
      </div>
    </details>
  );
});

export interface ConsoleSectionNodeRendererProps {
  node: ConsoleSectionNode;
  stepId: string;
  startByte: number;
  stopTailingLogs: () => void;
  currentRunPath: string;
}

export const ConsoleSectionNodeRenderer = memo(
  function ConsoleSectionNodeRenderer({
    node,
    stepId,
    startByte,
    stopTailingLogs,
    currentRunPath,
  }: ConsoleSectionNodeRendererProps) {
    if (node.kind === "line") {
      return (
        <ConsoleLine
          key={`line-${node.index}`}
          lineNumber={String(node.index)}
          content={node.content}
          stepId={stepId}
          startByte={startByte}
          stopTailingLogs={stopTailingLogs}
          currentRunPath={currentRunPath}
        />
      );
    }
    return (
      <ConsoleSection
        key={`section-${node.startIndex}`}
        group={node}
        stepId={stepId}
        startByte={startByte}
        stopTailingLogs={stopTailingLogs}
        currentRunPath={currentRunPath}
      />
    );
  },
);

function nodeKey(node: ConsoleSectionNode): string {
  return node.kind === "line"
    ? `line-${node.index}`
    : `section-${node.startIndex}`;
}
