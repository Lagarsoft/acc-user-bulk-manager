/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import DryRunPreview from "@/app/components/DryRunPreview";
import type { CsvOperationRow } from "@/app/lib/csv-parser";
import type { DryRunResponse } from "@/app/lib/dry-run";

jest.mock("../../app/lib/analytics", () => ({ trackEvent: jest.fn() }));

const OP: CsvOperationRow = {
  rowNumber: 2,
  action: "add",
  projectId: "proj-1",
  projectName: "Alpha Project",
  email: "alice@x.com",
  role: "member",
  firstName: "Alice",
  lastName: "Smith",
};

function mockFetchResponse(body: DryRunResponse, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as jest.Mock;
}

function cleanDryRunResponse(overrides: Partial<DryRunResponse> = {}): DryRunResponse {
  return {
    results: [
      {
        projectId: "proj-1",
        projectName: "Alpha Project",
        operations: [
          {
            rowNumber: 2,
            action: "add",
            email: "alice@x.com",
            role: "member",
            firstName: "Alice",
            lastName: "Smith",
            valid: true,
          },
        ],
      },
    ],
    summary: { total: 1, valid: 1, warnings: 0, errors: 0 },
    ...overrides,
  };
}

afterEach(() => jest.resetAllMocks());

describe("DryRunPreview", () => {
  it("shows a loading spinner before the API responds", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as jest.Mock;
    render(<DryRunPreview operations={[OP]} onHasErrors={jest.fn()} />);
    expect(screen.getByText(/validating operations/i)).toBeInTheDocument();
  });

  it("renders success banner when all operations are valid", async () => {
    mockFetchResponse(cleanDryRunResponse());
    render(<DryRunPreview operations={[OP]} onHasErrors={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/all operations validated successfully/i)).toBeInTheDocument()
    );
  });

  it("renders warning banner when there are warnings but no errors", async () => {
    const response = cleanDryRunResponse({
      results: [
        {
          projectId: "proj-1",
          operations: [
            {
              rowNumber: 2,
              action: "add",
              email: "alice@x.com",
              role: "member",
              firstName: "",
              lastName: "",
              valid: true,
              issue: "User already exists — will update role",
              severity: "warning",
            },
          ],
        },
      ],
      summary: { total: 1, valid: 0, warnings: 1, errors: 0 },
    });
    mockFetchResponse(response);
    render(<DryRunPreview operations={[OP]} onHasErrors={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/validation passed with warnings/i)).toBeInTheDocument()
    );
  });

  it("renders error banner and calls onHasErrors(true) when there are errors", async () => {
    const onHasErrors = jest.fn();
    const response = cleanDryRunResponse({
      results: [
        {
          projectId: "proj-1",
          operations: [
            {
              rowNumber: 2,
              action: "update",
              email: "alice@x.com",
              role: "member",
              firstName: "",
              lastName: "",
              valid: false,
              issue: "User not found in this project",
              severity: "error",
            },
          ],
        },
      ],
      summary: { total: 1, valid: 0, warnings: 0, errors: 1 },
    });
    mockFetchResponse(response);
    render(<DryRunPreview operations={[OP]} onHasErrors={onHasErrors} />);
    await waitFor(() =>
      expect(screen.getByText(/1 error.*fix before executing/i)).toBeInTheDocument()
    );
    expect(onHasErrors).toHaveBeenCalledWith(true);
  });

  it("calls onHasErrors(false) when there are no errors", async () => {
    const onHasErrors = jest.fn();
    mockFetchResponse(cleanDryRunResponse());
    render(<DryRunPreview operations={[OP]} onHasErrors={onHasErrors} />);
    await waitFor(() => expect(onHasErrors).toHaveBeenCalledWith(false));
  });

  it("shows operation rows in the diff table", async () => {
    mockFetchResponse(cleanDryRunResponse());
    render(<DryRunPreview operations={[OP]} onHasErrors={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("alice@x.com")).toBeInTheDocument()
    );
    expect(screen.getByText("member")).toBeInTheDocument();
  });

  it("displays project name in the diff header", async () => {
    mockFetchResponse(cleanDryRunResponse());
    render(<DryRunPreview operations={[OP]} onHasErrors={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("Alpha Project")).toBeInTheDocument()
    );
  });

  it("shows fetch error message when API call fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error")) as jest.Mock;
    render(<DryRunPreview operations={[OP]} onHasErrors={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/failed to run validation/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it("shows ✓ OK for valid operations with no issue", async () => {
    mockFetchResponse(cleanDryRunResponse());
    render(<DryRunPreview operations={[OP]} onHasErrors={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/✓ OK/)).toBeInTheDocument()
    );
  });
});
