import { testApiHandler } from "next-test-api-route-handler";
import * as handler from "@/app/api/dry-run/route";
import { listProjectUsers } from "../../app/lib/acc-admin";

jest.mock("../../app/lib/acc-admin", () => ({
  listProjectUsers: jest.fn(),
}));

const mockListProjectUsers = listProjectUsers as jest.Mock;

const AUTH_COOKIE = "aps_access_token=fake-token";

function makeOp(overrides: Record<string, unknown> = {}) {
  return {
    rowNumber: 2,
    action: "add",
    projectId: "proj-1",
    email: "alice@x.com",
    role: "member",
    firstName: "Alice",
    lastName: "Smith",
    ...overrides,
  };
}

describe("POST /api/dry-run", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it("401 when auth cookie is absent", async () => {
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operations: [] }),
        });
        expect(res.status).toBe(401);
      },
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  it("400 when body is not valid JSON", async () => {
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: AUTH_COOKIE },
          body: "not-json{",
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/JSON/i);
      },
    });
  });

  it("400 when operations is not an array", async () => {
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: AUTH_COOKIE },
          body: JSON.stringify({ operations: "not-array" }),
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/array/i);
      },
    });
  });

  // -------------------------------------------------------------------------
  // add
  // -------------------------------------------------------------------------

  it("200 valid (no issue) when adding a user who does not exist", async () => {
    mockListProjectUsers.mockResolvedValue([]);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: AUTH_COOKIE },
          body: JSON.stringify({ operations: [makeOp()] }),
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const op = data.results[0].operations[0];
        expect(op.valid).toBe(true);
        expect(op.issue).toBeUndefined();
        expect(data.summary.valid).toBe(1);
        expect(data.summary.warnings).toBe(0);
        expect(data.summary.errors).toBe(0);
      },
    });
  });

  it("200 warning when adding a user who already exists", async () => {
    mockListProjectUsers.mockResolvedValue([{ email: "alice@x.com" }]);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: AUTH_COOKIE },
          body: JSON.stringify({ operations: [makeOp()] }),
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const op = data.results[0].operations[0];
        expect(op.valid).toBe(true);
        expect(op.severity).toBe("warning");
        expect(data.summary.warnings).toBe(1);
      },
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  it("200 error when updating a user who does not exist", async () => {
    mockListProjectUsers.mockResolvedValue([]);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: AUTH_COOKIE },
          body: JSON.stringify({ operations: [makeOp({ action: "update" })] }),
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const op = data.results[0].operations[0];
        expect(op.valid).toBe(false);
        expect(op.severity).toBe("error");
        expect(data.summary.errors).toBe(1);
      },
    });
  });

  it("200 valid when updating a user who exists", async () => {
    mockListProjectUsers.mockResolvedValue([{ email: "alice@x.com" }]);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: AUTH_COOKIE },
          body: JSON.stringify({ operations: [makeOp({ action: "update" })] }),
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const op = data.results[0].operations[0];
        expect(op.valid).toBe(true);
        expect(op.issue).toBeUndefined();
      },
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------

  it("200 warning when removing a user who does not exist", async () => {
    mockListProjectUsers.mockResolvedValue([]);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: AUTH_COOKIE },
          body: JSON.stringify({ operations: [makeOp({ action: "remove", role: "" })] }),
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const op = data.results[0].operations[0];
        expect(op.valid).toBe(true);
        expect(op.severity).toBe("warning");
        expect(data.summary.warnings).toBe(1);
      },
    });
  });

  // -------------------------------------------------------------------------
  // role validation
  // -------------------------------------------------------------------------

  it("200 error when role is invalid for add", async () => {
    mockListProjectUsers.mockResolvedValue([]);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: AUTH_COOKIE },
          body: JSON.stringify({ operations: [makeOp({ role: "super_admin" })] }),
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const op = data.results[0].operations[0];
        expect(op.valid).toBe(false);
        expect(op.severity).toBe("error");
        expect(op.issue).toMatch(/super_admin/i);
      },
    });
  });

  // -------------------------------------------------------------------------
  // user fetch failure
  // -------------------------------------------------------------------------

  it("200 warning when listProjectUsers throws (skips existence check)", async () => {
    mockListProjectUsers.mockRejectedValue(new Error("APS unavailable"));

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: AUTH_COOKIE },
          body: JSON.stringify({ operations: [makeOp()] }),
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const op = data.results[0].operations[0];
        expect(op.valid).toBe(true);
        expect(op.severity).toBe("warning");
        expect(op.issue).toMatch(/existence check skipped/i);
      },
    });
  });

  // -------------------------------------------------------------------------
  // summary totals
  // -------------------------------------------------------------------------

  it("summary counts are consistent across multiple operations", async () => {
    mockListProjectUsers.mockResolvedValue([{ email: "alice@x.com" }]);

    const ops = [
      makeOp({ action: "add" }),               // warning: already exists
      makeOp({ action: "update", email: "bob@x.com" }),  // error: not found
      makeOp({ email: "alice@x.com", action: "remove", role: "" }), // valid: user found
    ];

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: AUTH_COOKIE },
          body: JSON.stringify({ operations: ops }),
        });
        const data = await res.json();
        expect(data.summary.total).toBe(3);
        expect(data.summary.warnings).toBe(1);
        expect(data.summary.errors).toBe(1);
        expect(data.summary.valid).toBe(1);
      },
    });
  });
});
