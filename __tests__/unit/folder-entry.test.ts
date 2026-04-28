import { entryLabel, entryKey, newFolderEntryId, type FolderEntry } from "@/app/lib/folder-entry";

function makeEntry(overrides: Partial<FolderEntry> = {}): FolderEntry {
  return {
    id: "fe-test",
    email: "alice@x.com",
    projectId: "proj-1",
    folderPath: "Design",
    permission: "viewer",
    ...overrides,
  };
}

describe("entryLabel", () => {
  it("returns email for USER entries (default)", () => {
    expect(entryLabel(makeEntry())).toBe("alice@x.com");
  });

  it("returns email for explicit USER subjectType", () => {
    expect(entryLabel(makeEntry({ subjectType: "USER" }))).toBe("alice@x.com");
  });

  it("returns companyName for COMPANY entries", () => {
    const e = makeEntry({ subjectType: "COMPANY", companyName: "Acme Corp", companyId: "co-1" });
    expect(entryLabel(e)).toBe("Acme Corp");
  });

  it("falls back to companyId when companyName is absent", () => {
    const e = makeEntry({ subjectType: "COMPANY", companyId: "co-1" });
    expect(entryLabel(e)).toBe("co-1");
  });

  it("returns roleName for ROLE entries", () => {
    const e = makeEntry({ subjectType: "ROLE", roleName: "Project Manager", roleId: "role-1" });
    expect(entryLabel(e)).toBe("Project Manager");
  });

  it("falls back to roleId when roleName is absent", () => {
    const e = makeEntry({ subjectType: "ROLE", roleId: "role-1" });
    expect(entryLabel(e)).toBe("role-1");
  });
});

describe("entryKey", () => {
  it("returns email for USER entries", () => {
    expect(entryKey(makeEntry())).toBe("alice@x.com");
  });

  it("returns companyId for COMPANY entries", () => {
    const e = makeEntry({ subjectType: "COMPANY", companyId: "co-1" });
    expect(entryKey(e)).toBe("co-1");
  });

  it("returns empty string for COMPANY entries without companyId", () => {
    const e = makeEntry({ subjectType: "COMPANY" });
    expect(entryKey(e)).toBe("");
  });

  it("returns roleId for ROLE entries", () => {
    const e = makeEntry({ subjectType: "ROLE", roleId: "role-1" });
    expect(entryKey(e)).toBe("role-1");
  });
});

describe("newFolderEntryId", () => {
  it("returns a string starting with 'fe-'", () => {
    expect(newFolderEntryId()).toMatch(/^fe-/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newFolderEntryId()));
    expect(ids.size).toBe(100);
  });
});
