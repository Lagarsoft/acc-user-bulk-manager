import { parseFolderCsv } from "@/app/lib/folder-csv-parser";

const HEADER = "email,project_id,folder_path,permission";

describe("parseFolderCsv - structural", () => {
  it("returns empty results for an empty string", () => {
    const { operations, errors } = parseFolderCsv("");
    expect(operations).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("skips blank data rows", () => {
    const csv = `${HEADER}\nalice@x.com,proj-1,Design,viewer\n\nbob@x.com,proj-1,Docs,editor`;
    const { operations } = parseFolderCsv(csv);
    expect(operations).toHaveLength(2);
  });

  it("handles CRLF line endings", () => {
    const csv = `${HEADER}\r\nalice@x.com,proj-1,Design,viewer\r\n`;
    const { operations, errors } = parseFolderCsv(csv);
    expect(errors).toHaveLength(0);
    expect(operations).toHaveLength(1);
  });
});

describe("parseFolderCsv - missing headers", () => {
  it("errors when email column is absent", () => {
    const { errors } = parseFolderCsv("project_id,folder_path,permission\nproj-1,Design,viewer");
    expect(errors[0]).toMatchObject({ rowNumber: 1, field: "header" });
    expect(errors[0].message).toContain("email");
  });

  it("errors when project_id column is absent", () => {
    const { errors } = parseFolderCsv("email,folder_path,permission\nalice@x.com,Design,viewer");
    expect(errors[0].message).toContain("project_id");
  });

  it("errors when folder_path column is absent", () => {
    const { errors } = parseFolderCsv("email,project_id,permission\nalice@x.com,proj-1,viewer");
    expect(errors[0].message).toContain("folder_path");
  });

  it("errors when permission column is absent", () => {
    const { errors } = parseFolderCsv("email,project_id,folder_path\nalice@x.com,proj-1,Design");
    expect(errors[0].message).toContain("permission");
  });
});

describe("parseFolderCsv - valid rows", () => {
  it("parses a well-formed row", () => {
    const csv = `${HEADER}\nalice@x.com,proj-1,Project Files/Design,editor`;
    const { operations, errors } = parseFolderCsv(csv);
    expect(errors).toHaveLength(0);
    expect(operations[0]).toMatchObject({
      rowNumber: 2,
      email: "alice@x.com",
      projectId: "proj-1",
      folderPath: "Project Files/Design",
      permission: "editor",
    });
  });

  it("strips leading slashes from folder_path", () => {
    const csv = `${HEADER}\nalice@x.com,proj-1,/Design,viewer`;
    const { operations } = parseFolderCsv(csv);
    expect(operations[0].folderPath).toBe("Design");
  });

  it("strips trailing slashes from folder_path", () => {
    const csv = `${HEADER}\nalice@x.com,proj-1,Design/,viewer`;
    const { operations } = parseFolderCsv(csv);
    expect(operations[0].folderPath).toBe("Design");
  });

  it("accepts all valid permission levels", () => {
    const levels = ["viewer", "downloader", "uploader", "editor", "manager"];
    for (const perm of levels) {
      const csv = `${HEADER}\nalice@x.com,proj-1,Design,${perm}`;
      const { errors } = parseFolderCsv(csv);
      expect(errors).toHaveLength(0);
    }
  });
});

describe("parseFolderCsv - row validation", () => {
  it("errors on missing email", () => {
    const { errors } = parseFolderCsv(`${HEADER}\n,proj-1,Design,viewer`);
    expect(errors[0]).toMatchObject({ field: "email" });
  });

  it("errors on invalid email format", () => {
    const { errors } = parseFolderCsv(`${HEADER}\nnot-email,proj-1,Design,viewer`);
    expect(errors[0]).toMatchObject({ field: "email" });
  });

  it("errors on missing project_id", () => {
    const { errors } = parseFolderCsv(`${HEADER}\nalice@x.com,,Design,viewer`);
    expect(errors[0]).toMatchObject({ field: "project_id" });
  });

  it("errors on missing folder_path", () => {
    const { errors } = parseFolderCsv(`${HEADER}\nalice@x.com,proj-1,,viewer`);
    expect(errors[0]).toMatchObject({ field: "folder_path" });
  });

  it("errors on invalid permission value", () => {
    const { errors } = parseFolderCsv(`${HEADER}\nalice@x.com,proj-1,Design,superuser`);
    expect(errors[0]).toMatchObject({ field: "permission" });
    expect(errors[0].message).toContain("superuser");
  });

  it("errors on missing permission", () => {
    const { errors } = parseFolderCsv(`${HEADER}\nalice@x.com,proj-1,Design,`);
    expect(errors[0]).toMatchObject({ field: "permission" });
  });

  it("keeps valid rows when some rows have errors", () => {
    const csv = `${HEADER}
alice@x.com,proj-1,Design,viewer
bad-email,proj-1,Design,editor
bob@x.com,proj-2,Docs,manager`;
    const { operations, errors } = parseFolderCsv(csv);
    expect(operations).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].rowNumber).toBe(3);
  });
});
