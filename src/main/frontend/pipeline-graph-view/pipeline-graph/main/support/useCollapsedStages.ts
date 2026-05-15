import { useCallback, useEffect, useRef, useState } from "react";

import { collectParentStageNames } from "../NestedPipelineGraphLayout.ts";
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

export function useCollapsedStages(storageKey: string, stages: StageInfo[]) {
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
    setCollapsedNames,
  };
}
