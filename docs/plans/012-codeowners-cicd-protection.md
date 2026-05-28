---
id: 012
title: Add CODEOWNERS to protect CI/CD workflow files
status: in-progress
blocked-by: []
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

No `.github/CODEOWNERS` file exists. Any contributor with write access can modify
CI workflow files (which have access to `SUPABASE_SERVICE_ROLE_KEY` and other
secrets) without mandatory review from a security-aware owner.

CSO audit finding #4 (2026-05-28).

**Acceptance criteria:**

- [ ] `.github/CODEOWNERS` file exists and is tracked by git
- [ ] `.github/` directory requires review from the repository owner
- [ ] `Dockerfile`, `docker-compose*.yml`, and `Makefile` require review (deploy-sensitive)
- [ ] The file uses the correct GitHub username format

## Design

Create a minimal CODEOWNERS file covering security-sensitive paths. The repo
owner is `aberhamm` (from GitHub remote `github.com/aberhamm/supabase-access-broker`).

**Files expected to change:**

- `.github/CODEOWNERS` — new file

**Out of scope:** Branch protection rule configuration (that's a GitHub UI setting, not code). Adding per-directory owners for app code.

## Tasks

1. Check the GitHub remote to confirm the owner username
2. Create `.github/CODEOWNERS` protecting `.github/`, `Dockerfile`, `docker-compose*.yml`, `Makefile`, and `.env*.example` files
3. Verify the file parses correctly (no syntax errors)

## Verification

- [cmd] `test -f .github/CODEOWNERS` exits 0
- [assert] `grep '.github/' .github/CODEOWNERS` matches at least one line
- [assert] `git ls-files .github/CODEOWNERS` returns the file path (tracked by git)
