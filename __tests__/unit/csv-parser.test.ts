import { parseLine, parseCsv } from "@/app/lib/csv-parser";

// ---------------------------------------------------------------------------
// parseLine
// ---------------------------------------------------------------------------

describe("parseLine", () => {
  it("splits simple fields", () => {
    expect(parseLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("trims surrounding whitespace", () => {
    expect(parseLine(" a , b , c ")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseLine('"a,b",c')).toEqual(["a,b", "c"]);
  });

  it("handles escaped double-quotes inside quoted fields", () => {
    expect(parseLine('"say ""hi""",ok')).toEqual(['say "hi"', "ok"]);
  });

  it("returns single-element array for a string with no commas", () => {
    expect(parseLine("hello")).toEqual(["hello"]);
  });

  it("returns empty string fields for consecutive commas", () => {
    expect(parseLine("a,,c")).toEqual(["a", "", "c"]);
  });
});

// ---------------------------------------------------------------------------
// parseCsv — structural edge cases
// ---------------------------------------------------------------------------

describe("parseCsv - structural", () => {
  it("returns empty results for an empty string", () => {
    const { operations, errors } = parseCsv("");
    expect(operations).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("returns empty results for a whitespace-only string", () => {
    const { operations, errors } = parseCsv("   ");
    expect(operations).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("handles CRLF line endings", () => {
    const csv = "email,project_id,role\r\nalice@example.com,proj-1,member\r\n";
    const { operations, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(operations).toHaveLength(1);
    expect(operations[0].email).toBe("alice@example.com");
  });

  it("skips blank lines in the data section", () => {
    const csv = "email,project_id,role\nalice@example.com,proj-1,member\n\nbob@example.com,proj-1,admin\n";
    const { operations } = parseCsv(csv);
    expect(operations).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// parseCsv — missing required columns
// ---------------------------------------------------------------------------

describe("parseCsv - missing headers", () => {
  it("errors when email column is absent", () => {
    const { operations, errors } = parseCsv("project_id,role\nproj-1,member");
    expect(operations).toHaveLength(0);
    expect(errors[0]).toMatchObject({ rowNumber: 1, field: "header" });
    expect(errors[0].message).toContain("email");
  });

  it("errors when project_id column is absent", () => {
    const { operations, errors } = parseCsv("email,role\nalice@example.com,member");
    expect(operations).toHaveLength(0);
    expect(errors[0]).toMatchObject({ rowNumber: 1, field: "header" });
    expect(errors[0].message).toContain("project_id");
  });

  it("reports both missing columns in one error", () => {
    const { errors } = parseCsv("role\nmember");
    expect(errors[0].message).toContain("email");
    expect(errors[0].message).toContain("project_id");
  });
});

// ---------------------------------------------------------------------------
// parseCsv — valid rows
// ---------------------------------------------------------------------------

describe("parseCsv - valid rows", () => {
  const header = "email,project_id,role,action,first_name,last_name";

  it("parses a minimal add row", () => {
    const csv = "email,project_id,role\nalice@example.com,proj-1,member";
    const { operations, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(operations[0]).toMatchObject({
      rowNumber: 2,
      action: "add",
      email: "alice@example.com",
      projectId: "proj-1",
      role: "member",
      firstName: "",
      lastName: "",
    });
  });

  it("parses a full row with all optional fields", () => {
    const csv = `${header}\nalice@example.com,proj-1,admin,update,Alice,Smith`;
    const { operations, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(operations[0]).toMatchObject({
      action: "update",
      firstName: "Alice",
      lastName: "Smith",
    });
  });

  it("defaults action to 'add' when the action column is absent", () => {
    const csv = "email,project_id,role\nalice@example.com,proj-1,member";
    const { operations } = parseCsv(csv);
    expect(operations[0].action).toBe("add");
  });

  it("parses all three valid actions", () => {
    const csv = `${header}
alice@example.com,proj-1,admin,add,,
bob@example.com,proj-1,member,update,,
carol@example.com,proj-1,,remove,,`;
    const { operations, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(operations.map((o) => o.action)).toEqual(["add", "update", "remove"]);
  });

  it("assigns correct 1-indexed row numbers", () => {
    const csv = "email,project_id,role\nalice@example.com,proj-1,member\nbob@example.com,proj-2,admin";
    const { operations } = parseCsv(csv);
    expect(operations[0].rowNumber).toBe(2);
    expect(operations[1].rowNumber).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// parseCsv — per-row validation errors
// ---------------------------------------------------------------------------

describe("parseCsv - row validation", () => {
  it("errors on missing email value", () => {
    const csv = "email,project_id,role\n,proj-1,member";
    const { errors, operations } = parseCsv(csv);
    expect(operations).toHaveLength(0);
    expect(errors[0]).toMatchObject({ rowNumber: 2, field: "email" });
  });

  it("errors on invalid email format", () => {
    const { errors } = parseCsv("email,project_id,role\nnot-an-email,proj-1,member");
    expect(errors[0]).toMatchObject({ field: "email" });
    expect(errors[0].message).toContain("not-an-email");
  });

  it("errors on invalid action value", () => {
    const { errors } = parseCsv("email,project_id,role,action\nalice@x.com,proj-1,member,delete");
    expect(errors[0]).toMatchObject({ field: "action" });
  });

  it("errors on invalid role for add", () => {
    const { errors } = parseCsv("email,project_id,role\nalice@x.com,proj-1,super_admin");
    expect(errors[0]).toMatchObject({ field: "role" });
  });

  it("errors when role is missing for add", () => {
    const { errors } = parseCsv("email,project_id,role\nalice@x.com,proj-1,");
    expect(errors[0]).toMatchObject({ field: "role" });
  });

  it("does NOT require role for remove action", () => {
    const { errors, operations } = parseCsv(
      "email,project_id,role,action\nalice@x.com,proj-1,,remove"
    );
    expect(errors).toHaveLength(0);
    expect(operations).toHaveLength(1);
  });

  it("errors on missing project_id value", () => {
    const { errors } = parseCsv("email,project_id,role\nalice@x.com,,member");
    expect(errors[0]).toMatchObject({ field: "project_id" });
  });

  it("excludes errored rows from operations but keeps valid rows", () => {
    const csv = `email,project_id,role
alice@x.com,proj-1,member
bad-email,proj-1,member
bob@x.com,proj-2,admin`;
    const { operations, errors } = parseCsv(csv);
    expect(operations).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].rowNumber).toBe(3);
  });

  it("accepts all valid role values", () => {
    const roles = ["admin", "member", "project_admin", "project_manager", "gc_foreman", "gc_manager", "owner", "executive", "editor", "viewer"];
    for (const role of roles) {
      const { errors } = parseCsv(`email,project_id,role\nalice@x.com,proj-1,${role}`);
      expect(errors).toHaveLength(0);
    }
  });
});
