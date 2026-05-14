import { createContext, ReactNode, useContext, useState } from "react";

interface PipelineGraphViewPreferences {
  showNames: boolean;
  setShowNames: (val: boolean) => void;
  showDurations: boolean;
  setShowDurations: (val: boolean) => void;
  collapseNestedStagesOverview: boolean;
  setCollapseNestedStagesOverview: (val: boolean) => void;
  collapseNestedStagesBuild: boolean;
  setCollapseNestedStagesBuild: (val: boolean) => void;
}

const defaultPreferences = {
  showNames: false,
  showDurations: false,
  collapseNestedStages: false,
};

const UserPreferencesContext = createContext<
  PipelineGraphViewPreferences | undefined
>(undefined);

const makeKey = (setting: string) => `pgv-graph-view.${setting}`;

const parsePreferenceValue = <T,>(
  value: string | undefined,
  fallback: T,
): T => {
  if (value === undefined) {
    return fallback;
  }
  if (typeof fallback === "boolean") {
    return (value === "true") as typeof fallback;
  }
  return value as unknown as T;
};

const loadFromLocalStorage = <T,>(key: string, fallback: T): T => {
  try {
    const value = window.localStorage.getItem(key) ?? undefined;
    return parsePreferenceValue(value, fallback);
  } catch (e) {
    console.error(`Error loading localStorage key "${key}"`, e);
  }
  return fallback;
};

const loadFromDOM = <T,>(key: string, fallback: T): T => {
  const preferencesModule = document.querySelector(
    "[data-module='user-preferences']",
  );
  const value =
    preferencesModule && "dataset" in preferencesModule
      ? (preferencesModule as HTMLElement).dataset[key]
      : undefined;
  return parsePreferenceValue(value, fallback);
};

export const UserPreferencesProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const stageNamesKey = makeKey("stageNames");
  const stageDurationsKey = makeKey("stageDurations");
  const collapseNestedStagesOverviewKey = makeKey(
    "collapseNestedStagesOverview",
  );
  const collapseNestedStagesBuildKey = makeKey("collapseNestedStagesBuild");

  // Shared DOM fallback from the global admin config
  const collapseDOMDefault = loadFromDOM(
    "preferenceCollapseNestedStages",
    defaultPreferences.collapseNestedStages,
  );

  const [showNames, setShowNames] = useState<boolean>(
    loadFromLocalStorage(
      stageNamesKey,
      loadFromDOM("preferenceShowStageNames", defaultPreferences.showNames),
    ),
  );
  const [showDurations, setShowDurations] = useState<boolean>(
    loadFromLocalStorage(
      stageDurationsKey,
      loadFromDOM(
        "preferenceShowStageDurations",
        defaultPreferences.showDurations,
      ),
    ),
  );
  const [collapseNestedStagesOverview, setCollapseNestedStagesOverview] =
    useState<boolean>(
      loadFromLocalStorage(collapseNestedStagesOverviewKey, collapseDOMDefault),
    );
  const [collapseNestedStagesBuild, setCollapseNestedStagesBuild] =
    useState<boolean>(
      loadFromLocalStorage(collapseNestedStagesBuildKey, collapseDOMDefault),
    );

  const persistShowNames = (val: boolean) => {
    window.localStorage.setItem(stageNamesKey, String(val));
    setShowNames(val);
  };

  const persistShowDurations = (val: boolean) => {
    window.localStorage.setItem(stageDurationsKey, String(val));
    setShowDurations(val);
  };

  const persistCollapseNestedStagesOverview = (val: boolean) => {
    window.localStorage.setItem(collapseNestedStagesOverviewKey, String(val));
    setCollapseNestedStagesOverview(val);
  };

  const persistCollapseNestedStagesBuild = (val: boolean) => {
    window.localStorage.setItem(collapseNestedStagesBuildKey, String(val));
    setCollapseNestedStagesBuild(val);
  };

  return (
    <UserPreferencesContext.Provider
      value={{
        showNames,
        setShowNames: persistShowNames,
        showDurations,
        setShowDurations: persistShowDurations,
        collapseNestedStagesOverview,
        setCollapseNestedStagesOverview: persistCollapseNestedStagesOverview,
        collapseNestedStagesBuild,
        setCollapseNestedStagesBuild: persistCollapseNestedStagesBuild,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferences = (): PipelineGraphViewPreferences => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error(
      "useMonitorPreferences must be used within a UserPreferencesProvider",
    );
  }
  return context;
};
