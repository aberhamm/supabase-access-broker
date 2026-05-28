---
id: 002
title: Add security response headers to middleware
status: in-progress
blocked-by: []
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

The application currently sets CSP via middleware but is missing standard
security headers recommended by OWASP and Mozilla Observatory. Browsers that
receive these headers get additional defense-in-depth against clickjacking,
MIME-sniffing, and information leakage.

**Acceptance criteria:**

- [ ] Every non-API HTML response includes `Strict-Transport-Security: max-age=63072000; includeSubDomains` (only when request is HTTPS or behind a TLS proxy)
- [ ] Every response includes `X-Content-Type-Options: nosniff`
- [ ] Every response includes `X-Frame-Options: DENY`
- [ ] Every response includes `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] Every response includes `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] Existing CSP header is preserved, not replaced
- [ ] Unit test or e2e assertion validates all headers are present on a page response

## Design

Create a helper function `applySecurityHeaders(response, isSecure)` in
`middleware.ts` that sets all security headers on any response object.
Call it before every `return` — including the 5 `NextResponse.redirect()`
returns and the webhook early-return path (which currently only sets CSP).

HSTS should only be set when the request came over HTTPS. The existing
`isSecure` detection logic is currently scoped inside the `setAll` cookie
callback (line ~89). Hoist it to the top of the middleware function so it's
available to both the cookie setup and the security headers helper.

**Files expected to change:**

- `middleware.ts` — add headers to the response before returning
- `e2e/security-hardening.spec.ts` — add assertions for the new headers

**Out of scope:** Tightening `style-src` (Tailwind inline styles make this a
larger refactor). Subresource Integrity (SRI) for first-party scripts.

## Tasks

1. Hoist the `isSecure` detection from the cookie `setAll` callback to the top of the middleware function (before cookie setup) so it's accessible everywhere
2. Create an `applySecurityHeaders(response: NextResponse, isSecure: boolean)` helper that sets all 5 headers on any response
3. Call the helper before every `return` statement in middleware — including all `NextResponse.redirect()` paths (5 redirect returns) and the webhook early-return
4. Gate HSTS on `isSecure` so it's not set for localhost HTTP
5. Append test assertions to the existing describe block in `e2e/security-hardening.spec.ts` that fetch a page and verify each header is present
6. Verify the dev server still works (HSTS must not break localhost HTTP)

## Verification

- [cmd] `pnpm build` exits 0
- [cmd] `pnpm test` exits 0
- [cmd] `pnpm test:e2e -- security-hardening` exits 0
- [assert] `curl -sI http://localhost:3050/ | grep -i 'x-content-type-options'` contains `nosniff`
