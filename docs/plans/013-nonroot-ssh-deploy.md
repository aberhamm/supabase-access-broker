---
id: 013
title: Switch deployment SSH from root to deploy user
status: in-progress
blocked-by: []
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

The Makefile uses `root@100.80.250.15` for all deployment SSH commands. A `deploy`
user already exists on the server (evidenced by `sudo -u deploy` in the git pull
command). A compromised dev workstation or stolen SSH key currently grants full
root access to the production server.

CSO audit finding #5 (2026-05-28).

**Acceptance criteria:**

- [ ] `DEPLOY_HOST` in Makefile uses `deploy@100.80.250.15` instead of `root@`
- [ ] All `ssh` and `scp` commands in Makefile work with the deploy user
- [ ] Commands that need elevated privileges use `sudo` with specific commands (docker compose, systemctl reload caddy)
- [ ] The `sudo -u deploy` wrapper around `git pull` is removed (no longer needed when already running as deploy)
- [ ] `chmod`/`chown` commands for `.env` use sudo since deploy user can't chown

## Design

Change `DEPLOY_HOST` from `root@` to `deploy@`. Each command that currently runs
as root needs to be wrapped in `sudo` where elevated privileges are actually
required. The deploy user likely already has passwordless sudo for docker and
systemctl (common setup), but the Makefile commands should be explicit.

**Files expected to change:**

- `Makefile` — change `DEPLOY_HOST`, update all deploy targets to use `sudo` where needed

**Out of scope:** Server-side sudoers configuration (that's a manual ops task on the Hetzner box). Disabling root SSH login (also server-side). SSH key rotation.

## Tasks

1. Change `DEPLOY_HOST` from `root@100.80.250.15` to `deploy@100.80.250.15`
2. Update `deploy` target: remove `sudo -u deploy` wrapper from git pull (already running as deploy), add `sudo` to `docker compose`, `systemctl reload caddy`, and `chmod`/`chown` commands
3. Update `deploy-build`, `deploy-restart`, `deploy-env`, `deploy-sync-env` targets with `sudo` for docker compose and file permission commands
4. Update `deploy-logs` and `deploy-status` targets with `sudo` for docker compose
5. Leave `deploy-ssh` as-is (it just opens an interactive session)

## Verification

- [assert] `grep 'DEPLOY_HOST' Makefile` contains `deploy@` not `root@`
- [assert] `grep -c 'sudo docker' Makefile || grep -c 'sudo.*docker' Makefile` returns at least 1
- [cmd] `make -n deploy 2>&1` exits 0 (dry-run parses without error)
- [manual] Test actual deployment on Hetzner server after sudoers is confirmed
