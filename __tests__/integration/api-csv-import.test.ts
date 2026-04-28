import { testApiHandler } from "next-test-api-route-handler";
import * as handler from "@/app/api/csv/import/route";

const VALID_CSV = "email,project_id,role\nalice@x.com,proj-1,member\n";

describe("POST /api/csv/import", () => {
  // -------------------------------------------------------------------------
  // text/csv body
  // -------------------------------------------------------------------------

  it("200 with valid text/csv body", async () => {
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: VALID_CSV,
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.operations).toHaveLength(1);
        expect(data.errors).toHaveLength(0);
        expect(data.operations[0].email).toBe("alice@x.com");
      },
    });
  });

  it("400 when text/csv body is empty", async () => {
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: "   ",
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/empty/i);
      },
    });
  });

  it("413 when text/csv body exceeds 10 MB", async () => {
    const bigBody = "a".repeat(11 * 1024 * 1024);
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: bigBody,
        });
        expect(res.status).toBe(413);
        const data = await res.json();
        expect(data.error).toMatch(/10 MB/i);
      },
    });
  });

  // -------------------------------------------------------------------------
  // multipart/form-data
  // -------------------------------------------------------------------------

  it("200 with valid multipart/form-data file", async () => {
    const file = new File([VALID_CSV], "upload.csv", { type: "text/csv" });
    const form = new FormData();
    form.append("file", file);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: "POST", body: form });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.operations).toHaveLength(1);
      },
    });
  });

  it("400 when multipart request has no 'file' field", async () => {
    const form = new FormData();
    form.append("other", "value");

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: "POST", body: form });
        expect(res.status).toBe(400);
      },
    });
  });

  // -------------------------------------------------------------------------
  // Unsupported content type
  // -------------------------------------------------------------------------

  it("415 for unsupported content type", async () => {
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv: VALID_CSV }),
        });
        expect(res.status).toBe(415);
      },
    });
  });

  // -------------------------------------------------------------------------
  // CSV with validation errors
  // -------------------------------------------------------------------------

  it("200 with errors array for CSV rows that fail validation", async () => {
    const csv = "email,project_id,role\nnot-an-email,proj-1,member\nalice@x.com,proj-1,member\n";

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: csv,
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.errors).toHaveLength(1);
        expect(data.errors[0].field).toBe("email");
        expect(data.operations).toHaveLength(1);
      },
    });
  });

  it("200 with errors when required column is missing", async () => {
    const csv = "email,role\nalice@x.com,member\n";

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: csv,
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.errors[0].field).toBe("header");
        expect(data.errors[0].message).toContain("project_id");
        expect(data.operations).toHaveLength(0);
      },
    });
  });
});
