---
id: 006
title: E2E tests for account settings and MFA enrollment
status: done
completed: 2026-05-28
reviewed: false
qa: automated
blocked-by: []
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

The `/account` page lets users change their password, enroll/unenroll MFA
TOTP factors, and view linked OAuth identities. None of these flows have
e2e coverage. MFA enrollment is especially critical — a broken enrollment
flow locks users out of step-up-gated features.

**Acceptance criteria:**

- [ ] Test covers: account page loads and shows user email
- [ ] Test covers: change password with valid new password succeeds
- [ ] Test covers: change password with too-short password shows validation error
- [ ] Test covers: MFA TOTP enrollment flow renders QR code and accepts a valid OTP
- [ ] Test covers: MFA unenrollment removes the factor
- [ ] Test covers: linked identities card renders (even if empty)
- [ ] All tests use disposable test users created via factory

## Design

Create `e2e/account-settings.spec.ts`. Use `createTestUser` to create a
non-admin user (portal-only access is enough for `/account`). Use
`signInAs` to establish session.

For MFA TOTP enrollment: `MFAEnrollDialog` (`components/account/MFAEnrollDialog.tsx`)
renders a "Copy" button for the TOTP secret next to the QR code. The test can
click that copy button and read the secret from the clipboard (or grab the text
content from the secret display element). Use a TOTP library like `otpauth`
(add as devDependency) to generate a valid 6-digit code from the secret, then
enter it in the verify input. The component calls `enrollTOTP` then `verifyTOTP`
server actions from `app/actions/account.ts`.

**Files expected to change:**

- `e2e/account-settings.spec.ts` — new file
- `package.json` — possibly add `otpauth` or similar TOTP dev dependency for test OTP generation

**Out of scope:** Testing OAuth identity connect/disconnect (requires real
OAuth providers). Testing passkey enrollment (requires WebAuthn API mocking).

## Tasks

1. Create `e2e/account-settings.spec.ts` with user factory and sign-in setup
2. Write test: account page loads, displays current user email
3. Write test: change password with valid 14-char password, verify success toast
4. Write test: change password with 5-char password, verify error message
5. Write test: MFA enrollment — click enroll, verify QR code/secret renders, enter valid TOTP, verify enrollment succeeds
6. Write test: MFA unenrollment — unenroll the factor just enrolled, verify it's removed
7. Write test: linked identities card is visible (verify card heading renders)

## Verification

- [cmd] `pnpm build` exits 0
- [cmd] `pnpm test:e2e -- account-settings` exits 0
