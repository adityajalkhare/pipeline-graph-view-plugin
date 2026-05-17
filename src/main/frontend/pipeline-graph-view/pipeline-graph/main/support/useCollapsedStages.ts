import { useCallback, useEffect, useMemo, useState } from "react";

import {
  collapseSelectiveStages,
  collectParentStageIds,
} from "../NestedPipelineGraphLayout.ts";
import { StageInfo } from "../PipelineGraphModel.tsx";

function loadFromStorage(key: string): Set<number> {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored) {
      return new Set(JSON.parse(stored) as number[]);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveToStorage(key: string, ids: Set<number>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

/**
 * Extract the job + build path from the current page URL, stripping any
 * page suffix (e.g. "stages/") but keeping the build number.
 * /jenkins/job/my-pipeline/42/stages/ → /jenkins/job/my-pipeline/42
 * /jenkins/job/my-pipeline/42/ → /jenkins/job/my-pipeline/42
 */
export function deriveBuildPath(): string {
  const parts = window.location.pathname.replace(/\/+$/, "").split("/");
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(parts[i])) {
      return parts.slice(0, i + 1).join("/");
    }
  }
  return window.location.pathname;
}

/**
 * Walk the original (uncollapsed) stage tree and return the IDs of any
 * collapsed ancestors of the stage with the given id.
 */
function findCollapsedAncestors(
  stages: StageInfo[],
  targetId: number,
  collapsedIds: Set<number>,
): number[] {
  const result: number[] = [];

  function walk(nodes: StageInfo[], path: number[]): boolean {
    for (const stage of nodes) {
      if (stage.id === targetId) {
        result.push(...path.filter((id) => collapsedIds.has(id)));
        return true;
      }
      if (stage.children.length > 0) {
        if (walk(stage.children, [...path, stage.id])) {
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
  const [collapsedStageIds, setCollapsedStageIds] = useState<Set<number>>(() =>
    loadFromStorage(storageKey),
  );

  const toggleCollapseStage = useCallback(
    (stageId: number) => {
      setCollapsedStageIds((prev) => {
        const next = new Set(prev);
        if (next.has(stageId)) {
          next.delete(stageId);
        } else {
          next.add(stageId);
        }
        saveToStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const setCollapsedIds = useCallback(
    (ids: Set<number>) => {
      setCollapsedStageIds(ids);
      saveToStorage(storageKey, ids);
    },
    [storageKey],
  );

  const collapseAll = useCallback(() => {
    setCollapsedIds(collectParentStageIds(stages));
  }, [stages, setCollapsedIds]);

  const expandAll = useCallback(() => {
    setCollapsedIds(new Set());
  }, [setCollapsedIds]);

  const hasCollapsibleStages = useMemo(
    () => collectParentStageIds(stages).size > 0,
    [stages],
  );

  const effectiveStages = useMemo(
    () =>
      collapsedStageIds.size > 0
        ? collapseSelectiveStages(stages, collapsedStageIds)
        : stages,
    [stages, collapsedStageIds],
  );

  // Auto-expand collapsed ancestors when a stage is selected (e.g. via
  // the tree sidebar or ?selected-node= URL param).
  useEffect(() => {
    if (selectedStageId == null || collapsedStageIds.size === 0) return;
    const ancestors = findCollapsedAncestors(
      stages,
      selectedStageId,
      collapsedStageIds,
    );
    if (ancestors.length === 0) return;
    setCollapsedStageIds((prev) => {
      const next = new Set(prev);
      for (const id of ancestors) {
        next.delete(id);
      }
      saveToStorage(storageKey, next);
      return next;
    });
  }, [selectedStageId]); // eslint-disable-line react-hooks/exhaustive-deps -- only react to selection changes

  return {
    collapsedStageIds,
    toggleCollapseStage,
    collapseAll,
    expandAll,
    hasCollapsibleStages,
    effectiveStages,
  };
}
