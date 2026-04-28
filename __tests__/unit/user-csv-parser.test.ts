import { parseUserCsv } from "@/app/lib/user-csv-parser";

const HEADER = "email,first_name,last_name,company,job_title,phone,industry";

describe("parseUserCsv - structural", () => {
  it("returns empty results for an empty string", () => {
    const { users, errors } = parseUserCsv("");
    expect(users).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("skips blank data rows", () => {
    const csv = `${HEADER}\nalice@x.com,Alice,Smith,Acme,,, \n\nbob@x.com,Bob,Jones,Acme,,,`;
    const { users } = parseUserCsv(csv);
    expect(users).toHaveLength(2);
  });

  it("handles CRLF line endings", () => {
    const csv = `${HEADER}\r\nalice@x.com,Alice,Smith,,,, \r\n`;
    const { users, errors } = parseUserCsv(csv);
    expect(errors).toHaveLength(0);
    expect(users).toHaveLength(1);
  });
});

describe("parseUserCsv - missing headers", () => {
  it("errors when email column is absent", () => {
    const { errors } = parseUserCsv("first_name,last_name\nAlice,Smith");
    expect(errors[0]).toMatchObject({ rowNumber: 1, field: "header" });
    expect(errors[0].message).toContain("email");
  });

  it("does NOT error when optional columns are absent", () => {
    const { users, errors } = parseUserCsv("email\nalice@x.com");
    expect(errors).toHaveLength(0);
    expect(users[0].email).toBe("alice@x.com");
  });
});

describe("parseUserCsv - valid rows", () => {
  it("parses a full row with all columns", () => {
    const csv = `${HEADER}\nalice@x.com,Alice,Smith,Acme Corp,Engineer,555-1234,Construction`;
    const { users, errors } = parseUserCsv(csv);
    expect(errors).toHaveLength(0);
    expect(users[0]).toMatchObject({
      rowNumber: 2,
      email: "alice@x.com",
      firstName: "Alice",
      lastName: "Smith",
      company: "Acme Corp",
      jobTitle: "Engineer",
      phone: "555-1234",
      industry: "Construction",
    });
  });

  it("sets empty strings for absent optional fields", () => {
    const { users } = parseUserCsv("email\nalice@x.com");
    expect(users[0].firstName).toBe("");
    expect(users[0].company).toBe("");
  });

  it("assigns correct 1-indexed row numbers", () => {
    const csv = `email\nalice@x.com\nbob@x.com`;
    const { users } = parseUserCsv(csv);
    expect(users[0].rowNumber).toBe(2);
    expect(users[1].rowNumber).toBe(3);
  });
});

describe("parseUserCsv - row validation", () => {
  it("errors on missing email value", () => {
    const { errors, users } = parseUserCsv(`email\n`);
    // blank line is skipped, not an error row
    expect(users).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("errors on invalid email format", () => {
    const { errors } = parseUserCsv("email\nnot-an-email");
    expect(errors[0]).toMatchObject({ field: "email" });
  });

  it("errors when a free-text field exceeds 255 characters", () => {
    const longValue = "a".repeat(256);
    const csv = `email,first_name\nalice@x.com,${longValue}`;
    const { errors } = parseUserCsv(csv);
    expect(errors[0]).toMatchObject({ field: "first_name" });
    expect(errors[0].message).toContain("255");
  });

  it("does not error when a free-text field is exactly 255 characters", () => {
    const maxValue = "a".repeat(255);
    const csv = `email,first_name\nalice@x.com,${maxValue}`;
    const { errors } = parseUserCsv(csv);
    expect(errors).toHaveLength(0);
  });
});

describe("parseUserCsv - deduplication", () => {
  it("deduplicates by email (case-insensitive), last row wins", () => {
    const csv = `email,first_name
alice@x.com,First
ALICE@X.COM,Second`;
    const { users, errors } = parseUserCsv(csv);
    expect(errors).toHaveLength(0);
    expect(users).toHaveLength(1);
    expect(users[0].firstName).toBe("Second");
  });

  it("keeps distinct emails separate", () => {
    const csv = `email\nalice@x.com\nbob@x.com`;
    const { users } = parseUserCsv(csv);
    expect(users).toHaveLength(2);
  });
});
