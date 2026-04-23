# Plan: Account-User Creation + Folder Permissions

_Status: draft — not yet implemented. Open for refinement before build-out._

## Context

User feedback surfaced two gaps in `acc-user-bulk-manager`:

1. **Users must pre-exist in the Autodesk account** before the current tool can add them to projects. Admins onboarding brand-new users today have to go into Forma's web UI, invite each user, then come back here. They want to do it in one flow.
2. **Permissions stop at the project level.** Admins frequently need to grant a user access to specific *folders* in ACC Docs (e.g., "give external architects VIEW on `Project Files/Design/Current`"). The tool doesn't expose folder permissions at all.

Both features are feasible via existing APS APIs (confirmed — see Feasibility notes). The plan adds them as **skippable wizard steps** so admins who only want project-add keep the current fast path.

Chosen UX (confirmed with user):
- **Account user creation**: new skippable *Step 1* in the main flow. Shows which emails from the upcoming CSV don't yet exist in the account and lets the admin click Create or Skip.
- **Folder permissions**: new skippable step (after project-add execution), with its own CSV format and a folder-tree picker for manual entry.
- **Folder identification**: human-readable folder path (e.g. `Project Files/Design/Current`), resolved server-side to a folder URN. URN fallback is out of scope for v1.

## Feasibility (confirmed)

| Feature | Endpoint | Auth | Notes |
|---|---|---|---|
| Create account user | `POST /hq/v1/accounts/:accountId/users/import` (bulk, up to 50) | 2-legged, `account:write` | Requires Custom Integration activation on the account. EU accounts must hit `/hq/v1/regions/eu/...`. If email has no Autodesk identity, APS auto-sends invite; status starts `pending`. |
| Resolve email → ACC user UUID | Existing `searchAccountUsers()` in `app/lib/acc-admin.ts` | 2-legged | Already implemented. Returns the `id` (ACC uid) we need as `subjectId` for folder perms. |
| Folder tree walk (path resolution) | `GET /data/v1/projects/:projectId/folders/:folderId/contents` via `DataManagementClient` | 3-legged, `data:read` | Need top folder from `GET /project/v1/hubs/:hubId/projects/:projectId/topFolders`. Cache per project during one flow. |
| Grant folder permission | `POST /bim360/docs/v1/projects/:projectId/folders/:folderId/permissions:batch-create` | **3-legged**, `data:write`, caller must be project admin | `subjectId` = ACC user UUID (not email). User must already be a project member or the call fails. Actions enum: `VIEW`, `DOWNLOAD`, `COLLABORATE`, `PUBLISH_MARKUP`, `EDIT`, `CONTROL`. |

**Gotcha to document in issue #11**: the Custom Integration activation step is mandatory for `/hq/v1` calls and is done by an account admin in Forma settings — otherwise everything returns 401.

## APS documentation links

**Account-level user creation**
- ACC Create users — https://aps.autodesk.com/en/docs/acc/v1/reference/http/users-POST
- ACC Bulk import users — https://aps.autodesk.com/en/docs/acc/v1/reference/http/users-import-POST
- BIM 360 equivalent — https://aps.autodesk.com/en/docs/bim360/v1/reference/http/users-POST
- ACC Admin field guide — https://aps.autodesk.com/en/docs/acc/v1/overview/field-guide/admin/

**Folder permissions**
- Get folder permissions — https://aps.autodesk.com/en/docs/acc/v1/reference/http/document-management-projects-project_id-folders-folder_id-permissions-GET
- Batch-create — https://aps.autodesk.com/en/docs/acc/v1/reference/http/document-management-projects-project_id-folders-folder_id-permissionsbatch-create-POST
- Batch-update — https://aps.autodesk.com/en/docs/acc/v1/reference/http/document-management-projects-project_id-folders-folder_id-permissionsbatch-update-POST
- Retrieve user permissions (tutorial) — https://aps.autodesk.com/en/docs/bim360/v1/tutorials/document-management/retrieve-user-permissions
- Update permissions (tutorial) — https://aps.autodesk.com/en/docs/bim360/v1/tutorials/document-management/update-permissions
- ACC Docs permission levels (Autodesk KB) — https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Differences-in-folder-permission-levels-in-ACC-Docs.html

**Folder tree walking (path → URN)**
- Top folders — https://aps.autodesk.com/en/docs/data/v2/reference/http/hubs-hub_id-projects-project_id-topFolders-GET
- Folder contents — https://aps.autodesk.com/en/docs/data/v2/reference/http/projects-project_id-folders-folder_id-contents-GET

## Files to modify / add

### Backend — APS client layer

- **`app/lib/acc-admin.ts`** — extend:
  - `createAccountUsers(accountId, users[], token)` → `POST /hq/v1/accounts/:id/users/import`. Raw `fetch` (SDK does not cover `/hq/v1`). Returns per-email status array.
  - `checkAccountUsers(accountId, emails[], token)` — reuses existing `searchAccountUsers()` in a loop (with in-memory dedupe cache) to classify each email as `exists` / `missing`. Used for dry-run of Step 1.
  - Region handling: read `hub.region` (already populated in the hub normalizer) and prefix URL with `/regions/eu` when `EMEA`.

- **`app/lib/folder-permissions.ts`** (new file):
  - `resolveFolderPath(projectId, path, token)` → walks from `topFolders` down using `DataManagementClient.getFolderContents()`. Caches the tree per (projectId) for the duration of one request batch. Returns folder URN or `null` if not found.
  - `batchGrantFolderPermissions(projectId, folderUrn, subjects[], token)` → `POST .../permissions:batch-create`. Input: `{ subjectId, subjectType: 'USER', actions: string[] }[]`.
  - `PERMISSION_LEVELS` map → human labels (`viewer`/`downloader`/`uploader`/`editor`/`manager`) → action arrays. Match Forma's UI labels.

### Backend — CSV parsing

- **`app/lib/csv-parser.ts`** — export shared `parseLine()` helper.
- **`app/lib/folder-csv-parser.ts`** (new file):
  - `parseFolderCsv(csvText)` → required columns `email`, `project_id`, `folder_path`, `permission`. Returns `FolderOperationRow[]` + `CsvRowError[]`.
  - Validates permission against `PERMISSION_LEVELS` keys.

### Backend — API routes

- `POST /api/account/users/dry-run` — `{ emails[] }` → `{ existing, missing }`.
- `POST /api/account/users` — `{ users: [{email, firstName?, lastName?, companyName?}] }` → per-row create result.
- `POST /api/csv/import-folders` — parses folder CSV.
- `POST /api/folders/resolve` — `{ projectId, paths[] }` → `{ [path]: urn | null }`.
- `POST /api/folders/permissions` — `{ projectId, folderUrn, grants: [{email, permission}] }` → per-grant status.
- `GET /api/projects/:projectId/folders?parent=...` — for the tree picker.

### Frontend — wizard

Existing Dashboard flow: `Input Data → Bulk Queue → Preview → Execute`. Extend to:

`Input Data → [Account Users?] → Bulk Queue → Preview → Execute → [Folder Permissions?]`

- **`app/components/AccountUserStep.tsx`** (new): skippable step between Input Data and Bulk Queue.
  - Sources emails from the current queue (CSV or manual).
  - Calls `/api/account/users/dry-run`, shows table of `missing` emails with editable `first_name` / `last_name` / `company_name` inputs.
  - Buttons: **Create N users** / **Skip**. On Create, posts to `/api/account/users` and shows per-row badges.
  - If no missing emails, auto-advances.
- **`app/components/FolderPermissionStep.tsx`** (new): skippable step after Execute.
  - Two modes: **CSV upload** (→ `/api/csv/import-folders`) and **Manual** (tree picker + user multi-select + permission dropdown).
  - Dry-run: resolves each `folder_path` to a URN and confirms each email exists in the account.
  - Execute: batches grants per (project, folder) via `/api/folders/permissions`. Per-row badges, retry on error (reuse `OperationQueue.tsx` pattern).
- **`app/components/FolderTreePicker.tsx`** (new): lazy-loaded tree for manual mode.
- **`app/components/Dashboard.tsx`** — thread the two new steps + their skip flags; update `StepNav`.

### Scopes & auth

- `app/lib/aps-auth.ts`: already includes `data:read/write` + `account:read/write` — sufficient.
- Update `.env.local.example` with a note on Custom Integration activation.

## CSV format additions

**Folder permissions CSV** (new):

```
email,project_id,folder_path,permission
alice@example.com,b4e7...,Project Files/Design/Current,viewer
bob@example.com,b4e7...,Project Files/Construction,editor
```

Permissions map to APS actions:

| CSV value | APS actions |
|---|---|
| `viewer` | `VIEW` |
| `downloader` | `VIEW`, `DOWNLOAD` |
| `uploader` | `VIEW`, `DOWNLOAD`, `COLLABORATE` |
| `editor` | `VIEW`, `DOWNLOAD`, `COLLABORATE`, `PUBLISH_MARKUP`, `EDIT` |
| `manager` | all six actions |

## Verification

1. **Local dev**: `docker compose up` (or `npm run dev`). Sign in with a Forma account admin.
2. **Feature 1 (account user create)**:
   - Upload a CSV containing at least one email known to NOT exist in the account.
   - Confirm the Account Users step surfaces that email as `missing`, lets you fill first/last name, and calls `POST /hq/v1/accounts/:id/users/import`.
   - Confirm the user appears in Forma's Account Admin UI in `pending` state.
   - Skip path: upload a CSV where all emails exist; confirm the step auto-advances.
3. **Feature 2 (folder permissions)**:
   - Complete the project-add step first (user must be a project member).
   - Upload a folder CSV. Confirm `/api/folders/resolve` returns real URNs for valid paths and `null` for typos.
   - Execute and verify in Forma Docs → Folder → Permissions that the user has the expected permission level.
   - Try a permission on a folder where the user isn't a project member — confirm the error surfaces clearly.
   - Skip path: click Skip; confirm flow completes without calling any folder API.
4. **Unit tests**: extend the `csv-parser` test pattern for `parseFolderCsv`; add tests for `PERMISSION_LEVELS` and `resolveFolderPath` (mocked DM client).
5. **Regression**: run an existing project-add-only CSV end-to-end; confirm both new steps remain skippable and the old flow is unchanged.

## Open questions / items to refine

- Should Step 1 also be reachable *before* choosing projects (i.e., pure onboarding where admin just wants to invite people into the account)?
- Should the folder-permissions step accept URNs as a fallback for admins who already have them?
- Do we want company lookup (company_id) in account user creation, or keep it to plain `companyName`?
- How should partial failures in folder grants be surfaced and retried?
- Should the tool allow *revoking* folder permissions in v1, or only grants?

## Out of scope for v1

- URN input in the folder CSV (can be added later).
- Company-level or role-level folder grants (only `subjectType: USER`).
- Rollback of partial failures (inherits issue #9's strategy).
- App Store listing updates (issue #10).
