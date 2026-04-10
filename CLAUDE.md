# acc-user-bulk-manager — Claude Code Guide

## Project Overview

Bulk-add, remove, or update user permissions across multiple Autodesk Construction Cloud (ACC) projects via CSV upload. Distributed as an Autodesk App Store app using the ACC and APS (Autodesk Platform Services) APIs.

## Architecture

| Layer | Stack |
|---|---|
| Full-stack | Next.js (App Router) |
| API routes | Next.js Route Handlers (`app/api/`) |
| Frontend | React (Server + Client Components) |
| Auth | APS OAuth 2-legged (client credentials) + 3-legged (authorization code) |
| Dev infra | Docker Compose, ESLint, Prettier |
| Config | `.env.local` for APS credentials |

## Repository Structure (target)

```
acc-user-bulk-manager/
├── app/
│   ├── api/             # Next.js Route Handlers (replaces Express routes)
│   │   ├── auth/        # OAuth callback + token endpoints
│   │   ├── projects/    # ACC project & user endpoints
│   │   └── csv/         # Import/export endpoints
│   ├── components/      # React client/server components
│   ├── lib/             # ACC/APS API clients, CSV logic, auth helpers
│   └── page.tsx         # Main UI entry point
├── docker-compose.yml
├── .env.local.example
└── CLAUDE.md
```

## Open Issues (GitHub)

All issues are in `Lagarsoft/acc-user-bulk-manager`. Work through them roughly in order — later issues depend on earlier ones.

### Setup
- **#1** `setup` — Bootstrap project scaffold (Next.js with App Router, Docker Compose, ESLint + Prettier, `.env.local`)

### Auth
- **#2** `auth` — APS OAuth: 2-legged (client credentials) for admin ops + 3-legged (authorization code) for user-delegated ops. Token storage, refresh, and callback route.

### Backend
- **#3** `backend` — ACC Account Admin API: `GET /hubs` and `GET /hubs/:hubId/projects` with pagination. Normalize to internal `Project` model. Handle rate limits.
- **#4** `backend` — ACC Project Admin API: list/add/update/remove users per project. Map ACC role enums to human-readable labels.
- **#5** `backend` — CSV import parser: columns `email`, `role`, `project_id` (required), `first_name`, `last_name` (optional). Row-level validation and error reporting. Returns structured operation queue.
- **#6** `backend` — CSV export: snapshot of all users across selected projects. Columns: `project`, `email`, `first_name`, `last_name`, `role`, `status`. Stream large exports.

### Frontend
- **#7** `frontend` — Web UI: project multi-selector with checkboxes, user table (email, name, role, project), sortable/filterable columns, inline role editor, responsive layout.
- **#8** `frontend` — Bulk operation queue: pre-execution preview, progress bar per operation, success/error badge per row, retry failed ops, cancel in-progress queue.

### UX
- **#9** `ux` — Dry-run mode: "Preview Changes" step before execution showing diff (added/removed/updated per project). Validate all entries against ACC API constraints before submitting. Document rollback strategy for partial failures.

### Publishing
- **#10** `publishing` — App Store listing assets: product description (≤500 chars), 3 screenshots (1280×800), app icon (200×200), demo video, privacy policy URL.
- **#11** `docs` — README and publisher docs: installation/local dev, APS app setup guide (client ID, scopes), ACC admin prerequisites, API reference summary, changelog/versioning policy, App Store submission steps.

## Key API References

- **APS Auth**: `https://developer.autodesk.com/en/docs/oauth/v2/`
- **ACC Account Admin**: `https://aps.autodesk.com/en/docs/acc/v1/reference/http/admin-users/`
- **ACC Project Admin**: `https://aps.autodesk.com/en/docs/acc/v1/reference/http/projectadmin-projects-users/`

## Environment Variables

```
APS_CLIENT_ID=
APS_CLIENT_SECRET=
APS_CALLBACK_URL=http://localhost:3000/api/auth/callback
```

## Development Notes

- Start with issue #1 (scaffold) before any other work — all other issues depend on it.
- Issue #2 (auth) must be complete before #3 and #4 (API integrations).
- Issues #3–#6 (backend) should be complete before #7–#8 (frontend).
- Issue #9 (dry-run) depends on #5 (CSV parser) and #8 (queue UI).
- Issues #10–#11 (publishing/docs) are last and require a working app.
- Use Next.js Route Handlers (`app/api/`) instead of Express for all backend logic.
- Prefer Server Components for data-fetching pages; use Client Components only where interactivity is needed.
- CSV operations must handle large files without loading everything into memory — use Next.js streaming responses.
- Validate user inputs (email format, role values) in Route Handlers, not just on the client.
