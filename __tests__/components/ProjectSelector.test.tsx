/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ProjectSelector from "@/app/components/ProjectSelector";
import type { Hub, Project } from "@/app/lib/acc-admin";

const hubs: Hub[] = [
  { id: "hub-1", accountId: "acc-1", name: "Acme HQ", region: "US" },
  { id: "hub-2", accountId: "acc-2", name: "Beta Corp", region: "US" },
];

const projects: Project[] = [
  { id: "proj-1", hubId: "hub-1", accountId: "acc-1", name: "Alpha Project", status: "active", createdAt: "", updatedAt: "" },
  { id: "proj-2", hubId: "hub-1", accountId: "acc-1", name: "Beta Project", status: "active", createdAt: "", updatedAt: "" },
  { id: "proj-3", hubId: "hub-1", accountId: "acc-1", name: "Gamma Project", status: "active", createdAt: "", updatedAt: "" },
];

function setup(overrides: Partial<Parameters<typeof ProjectSelector>[0]> = {}) {
  const handlers = {
    onHubChange: jest.fn(),
    onProjectToggle: jest.fn(),
    onSelectAll: jest.fn(),
    onDeselectAll: jest.fn(),
  };
  const props = {
    hubs,
    projects,
    selectedProjectIds: new Set<string>(),
    loadingProjects: false,
    ...handlers,
    ...overrides,
  };
  const utils = render(<ProjectSelector {...props} />);
  return { ...utils, ...handlers };
}

describe("ProjectSelector", () => {
  it("renders hub options", () => {
    setup();
    expect(screen.getByRole("option", { name: "Acme HQ" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Beta Corp" })).toBeInTheDocument();
  });

  it("calls onHubChange with the selected hub id", () => {
    const { onHubChange } = setup();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "hub-1" } });
    expect(onHubChange).toHaveBeenCalledWith("hub-1");
  });

  it("shows loading message when loadingProjects is true", () => {
    setup({ loadingProjects: true, projects: [] });
    expect(screen.getByText(/loading projects/i)).toBeInTheDocument();
  });

  it("shows prompt when there are no projects and not loading", () => {
    setup({ projects: [] });
    expect(screen.getByText(/select an account/i)).toBeInTheDocument();
  });

  it("renders project checkboxes", () => {
    setup();
    expect(screen.getByRole("checkbox", { name: /Alpha Project/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Beta Project/i })).toBeInTheDocument();
  });

  it("checks the checkbox for selected project ids", () => {
    setup({ selectedProjectIds: new Set(["proj-1"]) });
    const alpha = screen.getByRole("checkbox", { name: /Alpha Project/i }) as HTMLInputElement;
    const beta = screen.getByRole("checkbox", { name: /Beta Project/i }) as HTMLInputElement;
    expect(alpha.checked).toBe(true);
    expect(beta.checked).toBe(false);
  });

  it("calls onProjectToggle when a checkbox is changed", () => {
    const { onProjectToggle } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: /Alpha Project/i }));
    expect(onProjectToggle).toHaveBeenCalledWith("proj-1");
  });

  it("calls onSelectAll when 'Select all' is clicked", () => {
    const { onSelectAll } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(onSelectAll).toHaveBeenCalled();
  });

  it("calls onDeselectAll when 'Deselect all' is clicked", () => {
    const { onDeselectAll } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    expect(onDeselectAll).toHaveBeenCalled();
  });

  it("shows the count of selected projects", () => {
    setup({ selectedProjectIds: new Set(["proj-1", "proj-2"]) });
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });
});
