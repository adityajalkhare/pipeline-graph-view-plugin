import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  collapseSelectiveStages,
  collectParentStageNames,
} from "../NestedPipelineGraphLayout.ts";
import { StageInfo } from "../PipelineGraphModel.tsx";

function loadFromStorage(key: string): Set<string> {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored) {
      return new Set(JSON.parse(stored) as string[]);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveToStorage(key: string, names: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...names]));
  } catch {
    // ignore
  }
}

/**
 * Extract the job path from the current page URL, stripping the run number
 * and any page suffix (e.g. "stages/").
 * /jenkins/job/my-pipeline/42/stages/ → /jenkins/job/my-pipeline
 * /jenkins/job/my-pipeline/42/ → /jenkins/job/my-pipeline
 */
export function deriveJobPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, "").split("/");
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(parts[i])) {
      return parts.slice(0, i).join("/");
    }
  }
  return window.location.pathname;
}

/**
 * Walk the original (uncollapsed) stage tree and return the names of any
 * collapsed ancestors of the stage with the given id.
 */
function findCollapsedAncestors(
  stages: StageInfo[],
  targetId: number,
  collapsedNames: Set<string>,
): string[] {
  const result: string[] = [];

  function walk(nodes: StageInfo[], path: string[]): boolean {
    for (const stage of nodes) {
      if (stage.id === targetId) {
        result.push(...path.filter((name) => collapsedNames.has(name)));
        return true;
      }
      if (stage.children.length > 0) {
        if (walk(stage.children, [...path, stage.name])) {
          return true;
        }
      }
    }
    return false;
  }

  walk(stages, []);
  return result;
}

export function useCollapsedStages(
  storageKey: string,
  stages: StageInfo[],
  selectedStageId?: number,
) {
  const [collapsedStageNames, setCollapsedStageNames] = useState<Set<string>>(
    () => loadFromStorage(storageKey),
  );

  const toggleCollapseStage = useCallback(
    (stageName: string) => {
      setCollapsedStageNames((prev) => {
        const next = new Set(prev);
        if (next.has(stageName)) {
          next.delete(stageName);
        } else {
          next.add(stageName);
        }
        saveToStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const setCollapsedNames = useCallback(
    (names: Set<string>) => {
      setCollapsedStageNames(names);
      saveToStorage(storageKey, names);
    },
    [storageKey],
  );

  const collapseAll = useCallback(() => {
    setCollapsedNames(collectParentStageNames(stages));
  }, [stages, setCollapsedNames]);

  const expandAll = useCallback(() => {
    setCollapsedNames(new Set());
  }, [setCollapsedNames]);

  const hasCollapsibleStages = useMemo(
    () => collectParentStageNames(stages).size > 0,
    [stages],
  );

  const effectiveStages = useMemo(
    () =>
      collapsedStageNames.size > 0
        ? collapseSelectiveStages(stages, collapsedStageNames)
        : stages,
    [stages, collapsedStageNames],
  );

  // Auto-expand collapsed ancestors when a stage is selected (e.g. via
  // the tree sidebar or ?selected-node= URL param).
  useEffect(() => {
    if (selectedStageId == null || collapsedStageNames.size === 0) return;
    const ancestors = findCollapsedAncestors(
      stages,
      selectedStageId,
      collapsedStageNames,
    );
    if (ancestors.length === 0) return;
    setCollapsedStageNames((prev) => {
      const next = new Set(prev);
      for (const name of ancestors) {
        next.delete(name);
      }
      saveToStorage(storageKey, next);
      return next;
    });
  }, [selectedStageId]); // eslint-disable-line react-hooks/exhaustive-deps -- only react to selection changes

  // Seed from admin default on first render when no localStorage state exists.
  const adminDefaultApplied = useRef(false);
  useEffect(() => {
    if (adminDefaultApplied.current) return;
    if (stages.length === 0) return;
    if (window.localStorage.getItem(storageKey) != null) {
      adminDefaultApplied.current = true;
      return;
    }
    const prefEl = document.querySelector("[data-module='user-preferences']");
    const collapseDefault =
      prefEl instanceof HTMLElement
        ? prefEl.dataset.preferenceCollapseNestedStages === "true"
        : false;
    if (collapseDefault) {
      setCollapsedNames(collectParentStageNames(stages));
    }
    adminDefaultApplied.current = true;
  }, [stages, storageKey, setCollapsedNames]);

  return {
    collapsedStageNames,
    toggleCollapseStage,
    collapseAll,
    expandAll,
    hasCollapsibleStages,
    effectiveStages,
  };
}
