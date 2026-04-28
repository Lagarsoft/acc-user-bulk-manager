import {
  isPermissionLevel,
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_LABELS,
  type PermissionLevel,
} from "@/app/lib/folder-permission-levels";

const ALL_LEVELS: PermissionLevel[] = ["viewer", "downloader", "uploader", "editor", "manager"];

describe("isPermissionLevel", () => {
  it("returns true for every valid level", () => {
    for (const level of ALL_LEVELS) {
      expect(isPermissionLevel(level)).toBe(true);
    }
  });

  it("returns false for unknown values", () => {
    expect(isPermissionLevel("superuser")).toBe(false);
    expect(isPermissionLevel("")).toBe(false);
    expect(isPermissionLevel("VIEW")).toBe(false); // action, not level
  });
});

describe("PERMISSION_LEVELS", () => {
  it("has an entry for every PermissionLevel", () => {
    for (const level of ALL_LEVELS) {
      expect(PERMISSION_LEVELS[level]).toBeDefined();
    }
  });

  it("viewer includes VIEW and COLLABORATE", () => {
    expect(PERMISSION_LEVELS.viewer).toContain("VIEW");
    expect(PERMISSION_LEVELS.viewer).toContain("COLLABORATE");
  });

  it("manager includes all actions", () => {
    const managerActions = PERMISSION_LEVELS.manager;
    expect(managerActions).toContain("VIEW");
    expect(managerActions).toContain("DOWNLOAD");
    expect(managerActions).toContain("EDIT");
    expect(managerActions).toContain("CONTROL");
  });

  it("higher levels are strict supersets of lower levels", () => {
    const ordered: PermissionLevel[] = ["viewer", "downloader", "uploader", "editor", "manager"];
    for (let i = 1; i < ordered.length; i++) {
      const lower = new Set(PERMISSION_LEVELS[ordered[i - 1]]);
      const higher = new Set(PERMISSION_LEVELS[ordered[i]]);
      for (const action of lower) {
        expect(higher.has(action)).toBe(true);
      }
    }
  });
});

describe("PERMISSION_LEVEL_LABELS", () => {
  it("has a label for every PermissionLevel", () => {
    for (const level of ALL_LEVELS) {
      expect(typeof PERMISSION_LEVEL_LABELS[level]).toBe("string");
      expect(PERMISSION_LEVEL_LABELS[level].length).toBeGreaterThan(0);
    }
  });
});
