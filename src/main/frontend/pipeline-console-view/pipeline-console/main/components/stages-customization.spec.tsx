/** * @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import StagesCustomization from "./stages-customization.tsx";

const {
  mockSetMainViewVisibility,
  mockSetStageViewPosition,
  mockSetCollapseNestedStagesBuild,
  mockUseLayoutPreferences,
} = vi.hoisted(() => ({
  mockSetMainViewVisibility: vi.fn(),
  mockSetStageViewPosition: vi.fn(),
  mockSetCollapseNestedStagesBuild: vi.fn(),
  mockUseLayoutPreferences: vi.fn(),
}));

vi.mock("../../../../common/user/user-preferences-provider.tsx", () => ({
  useUserPreferences: () => ({
    collapseNestedStagesBuild: false,
    setCollapseNestedStagesBuild: mockSetCollapseNestedStagesBuild,
  }),
}));

vi.mock("../providers/user-preference-provider.tsx", () => ({
  useLayoutPreferences: mockUseLayoutPreferences.mockReturnValue({
    mainViewVisibility: "both",
    setMainViewVisibility: mockSetMainViewVisibility,
    stageViewPosition: "top",
    setStageViewPosition: mockSetStageViewPosition,
    isMobile: false,
  }),
  MainViewVisibility: {
    BOTH: "both",
    GRAPH_ONLY: "graphOnly",
    STAGES_ONLY: "stagesOnly",
  },
  StageViewPosition: {
    TOP: "top",
    LEFT: "left",
  },
}));

describe("StagesCustomization", () => {
  it("should render Views, Graph position, and Nested stages controls", () => {
    render(<StagesCustomization />);

    expect(screen.getByText("Views")).toBeInTheDocument();
    expect(screen.getByText("Graph position")).toBeInTheDocument();
    expect(screen.getByText("Nested stages")).toBeInTheDocument();
  });

  it("should show current values", () => {
    render(<StagesCustomization />);

    expect(screen.getAllByText("Graph and stages").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Top").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Expanded").length).toBeGreaterThan(0);
  });

  it("should change view visibility on select", () => {
    render(<StagesCustomization />);

    const viewsSelect = document.getElementById(
      "main-view-visibility",
    ) as HTMLSelectElement;
    fireEvent.change(viewsSelect, { target: { value: "graphOnly" } });
    expect(mockSetMainViewVisibility).toHaveBeenCalledWith("graphOnly");
  });

  it("should change graph position on select", () => {
    render(<StagesCustomization />);

    const positionSelect = document.getElementById(
      "stage-view-position",
    ) as HTMLSelectElement;
    fireEvent.change(positionSelect, { target: { value: "left" } });
    expect(mockSetStageViewPosition).toHaveBeenCalledWith("left");
  });

  it("should render nested stages select with Expanded/Collapsed options", () => {
    render(<StagesCustomization />);

    const nestedSelect = document.getElementById(
      "pgv-nested-stages",
    ) as HTMLSelectElement;
    expect(nestedSelect.value).toBe("expanded");

    const options = nestedSelect.querySelectorAll("option");
    expect(options).toHaveLength(2);
    expect(options[0].value).toBe("expanded");
    expect(options[1].value).toBe("collapsed");
  });

  it("should call setCollapseNestedStagesBuild when nested stages select changes", () => {
    render(<StagesCustomization />);

    const nestedSelect = document.getElementById(
      "pgv-nested-stages",
    ) as HTMLSelectElement;
    fireEvent.change(nestedSelect, { target: { value: "collapsed" } });
    expect(mockSetCollapseNestedStagesBuild).toHaveBeenCalledWith(true);
  });

  it("should return null on mobile", () => {
    mockUseLayoutPreferences.mockReturnValueOnce({
      mainViewVisibility: "both",
      setMainViewVisibility: vi.fn(),
      stageViewPosition: "top",
      setStageViewPosition: vi.fn(),
      isMobile: true,
    });

    const { container } = render(<StagesCustomization />);
    expect(container.innerHTML).toBe("");
  });
});
