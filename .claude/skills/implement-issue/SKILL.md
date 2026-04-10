---
name: implement-issue
description: |
  Pick an open GitHub issue, create a branch, implement the code changes described in the issue,
  and open a pull request. Use when the user wants to work on a GitHub issue, implement a feature
  from an issue, start work on a ticket, or automate issue-to-PR workflow.
  Triggers on: "implement issue", "work on issue", "next issue", "pick an issue", "start issue #N".
argument-hint: [issue-number]
allowed-tools: Bash(git *) Bash(gh *) Read Write Edit Glob Grep
---

# Implement Issue

Your job is to implement a GitHub issue end-to-end: pick the issue (or use the one supplied),
create a branch, write the code, commit, push, and open a PR.

## Step 1 — Identify the issue

**If `$ARGUMENTS` is empty**, list open issues and pick the lowest-numbered one that has no
open PR already linked to it:

```!
gh issue list --repo Lagarsoft/acc-user-bulk-manager --state open --json number,title,labels,body --limit 20
```

```!
gh pr list --repo Lagarsoft/acc-user-bulk-manager --state open --json headRefName --limit 50
```

Choose the issue whose number does not already appear in a branch name from the PR list above.
Print the chosen issue number and title so the user can see which issue you are working on.

**If `$ARGUMENTS` is not empty**, treat `$0` as the issue number. Fetch it:

```!
gh issue view "$0" --repo Lagarsoft/acc-user-bulk-manager --json number,title,body,labels 2>/dev/null || echo "ISSUE_NOT_FOUND"
```

If the issue is not found or already closed, stop and tell the user.

## Step 2 — Read the issue thoroughly

Read the full issue body. Understand:
- What needs to be built (features, API routes, components, configs)
- Any acceptance criteria listed
- Dependencies on other issues (check CLAUDE.md for the dependency order — do not start an issue
  whose dependencies are not yet merged)
- Labels that hint at the area: `setup`, `auth`, `backend`, `frontend`, `ux`, `publishing`, `docs`

If the issue has unmet dependencies, stop and tell the user which issue to implement first.

## Step 3 — Check current branch and repo state

```!
git status --short
```

```!
git branch --show-current
```

If there are uncommitted changes on the current branch, stop and tell the user to commit or
stash them before proceeding.

Make sure you are on `main` and it is up to date:

```!
git fetch origin main --quiet && git log HEAD..origin/main --oneline
```

If `main` is behind, pull it first.

## Step 4 — Create a branch

Branch naming convention: `issue-{number}-{kebab-case-title-slug}` (max 50 chars total).

Example: issue #3 titled "ACC Account Admin API" → `issue-3-acc-account-admin-api`

```!
git checkout main 2>/dev/null; git pull origin main --quiet 2>/dev/null; echo "ready"
```

Create and switch to the new branch:
`git checkout -b issue-{number}-{slug}`

## Step 5 — Study the codebase

Before writing a single line, read the relevant existing files:
- Check CLAUDE.md for architecture, env variables, and conventions
- Read any files in `app/`, `lib/`, `components/` that are relevant to this issue
- Look at existing patterns so your new code matches the style

Use Glob and Grep to find related code. Do not make assumptions about structure — read first.

## Step 6 — Implement the code

Follow the instructions in CLAUDE.md exactly:
- Use Next.js App Router (`app/api/` for route handlers, `app/` for pages/components)
- Prefer Server Components; use Client Components only where interactivity is required
- Validate inputs in Route Handlers, not only on the client
- Stream large data rather than loading it all into memory
- Do not add error handling for impossible scenarios
- Do not add features beyond what the issue describes
- Match the code style of existing files exactly

Write all files needed. If a file already exists, edit it with Edit rather than rewriting it.

## Step 7 — Commit

Stage only the files you touched (not `node_modules`, `.env.local`, or generated files):

`git add <specific files>`

Write a conventional commit message:
- `feat:` for new features
- `fix:` for bug fixes
- `chore:` for setup/config
- `docs:` for documentation

Format: `{type}(#{issue-number}): {short description}`

Example: `feat(#3): add ACC Account Admin API with hub and project listing`

Then commit: `git commit -m "..."`

## Step 8 — Push and open PR

Push the branch:
`git push -u origin {branch-name}`

Create the PR targeting `main`:

```
gh pr create \
  --repo Lagarsoft/acc-user-bulk-manager \
  --title "{issue title}" \
  --body "$(cat <<'EOF'
## Summary

- Closes #{issue-number}
- {2-3 bullet points describing what was implemented}

## Changes

{list the files added/modified and why}

## Test plan

- [ ] {manual or automated test steps}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base main
```

## Step 9 — Report to the user

Print:
- The PR URL
- A short list of files created or modified
- Any known limitations or follow-up needed

If anything went wrong at any step, stop immediately, explain what happened, and do not
proceed to the next step. Do not force-push, do not `--no-verify`, and do not skip hooks.
