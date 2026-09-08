import { test, expect } from '@playwright/test';
const callback = 'https://lookbook.social/auth/callback';
function login(app = 'lookbook-social', redirect = callback) {
  return '/login?' + new URLSearchParams({ app_id: app, redirect_uri: redirect, state: 'csrf-state-preserved' });
}

test('Lookbook renders its approved brand, keyboard focus and password error', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (['font', 'image', 'stylesheet'].includes(request.resourceType()) && !request.url().startsWith('http://127.0.0.1:')) external.push(request.url()); });
  await page.goto(login());
  const shell = page.getByTestId('branded-login');
  await expect(shell).toHaveCSS('background-color', 'rgb(244, 241, 237)');
  await expect(page.locator('.brand-wordmark')).toHaveText('Lookbook');
  await expect(page.locator('.brand-wordmark')).toHaveCSS('text-transform', 'uppercase');
  await expect(shell).toHaveCSS('font-family', /SSO Inter Tight/);
  await expect(page.getByText('Secure sign-in · Supabase Access Broker')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  const email = page.getByRole('textbox', { name: 'Email' });
  await email.focus();
  await expect(email).toHaveCSS('outline-width', '3px');
  await email.fill('test@example.com');
  const passwordTab = page.getByRole('button', { name: 'Password', exact: true });
  if (await passwordTab.isEnabled()) await passwordTab.click();
  await page.getByLabel('Password', { exact: true }).fill('invalid-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Invalid email or password.')).toBeVisible();
  expect(page.url()).toContain('csrf-state-preserved');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('800 24px "SSO Inter Tight"'))).toBe(true);
  expect(external).toEqual([]);
  await page.screenshot({ path: `/tmp/sso-lookbook-${test.info().project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Lookbook stays light under dark OS preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(login());
  await expect(page.getByTestId('branded-login')).toHaveCSS('background-color', 'rgb(244, 241, 237)');
});

test('default login ignores arbitrary query branding', async ({ page }) => {
  await page.goto('/login?color=%23ff0000&name=ATTACKER&css=evil');
  await expect(page.getByTestId('branded-login')).toHaveCount(0);
  await expect(page.locator('[data-slot=card-title]')).toHaveText('Sign in');
  await expect(page.getByText('ATTACKER')).toHaveCount(0);
});

for (const [app, redirect] of [['missing', callback], ['disabled', callback], ['lookbook-social', 'https://evil.test/callback']]) {
  test(`unapproved SSO identity falls back: ${app} ${redirect}`, async ({ page }) => {
    await page.goto(login(app, redirect));
    await expect(page.getByTestId('branded-login')).toHaveCount(0);
    await expect(page.locator('.brand-wordmark')).toHaveCount(0);
  });
}

test('legacy migration and malformed data render usable safe palettes', async ({ page }) => {
  await page.goto(login('legacy'));
  await expect(page.locator('.brand-wordmark')).toHaveText('Legacy App');
  await expect(page.getByTestId('branded-login')).toHaveCSS('--primary', '#166534');
  await page.goto(login('malformed'));
  await expect(page.locator('.brand-wordmark')).toHaveText('Malformed App');
  await expect(page.getByTestId('branded-login')).toHaveCSS('background-color', 'rgb(247, 248, 252)');
  await expect(page.getByTestId('branded-login')).not.toHaveAttribute('style', /evil/);
});

test('system palette follows dark preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(login('system'));
  await expect(page.getByTestId('branded-login')).toHaveCSS('background-color', 'rgb(17, 19, 27)');
});


test('claims admin can preview Lookbook, inspect dark colors and see contrast validation', async ({ page, context }) => {
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'admin@example.test', app_metadata: { claims_admin: true }, user_metadata: {} };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const jwt = [ { alg: 'HS256', typ: 'JWT' }, { sub: user.id, exp: expires, aud: 'authenticated', role: 'authenticated', app_metadata: user.app_metadata } ].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.') + '.fixture-signature';
  const session = { access_token: jwt, refresh_token: 'fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: expires, user };
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }]);
  await page.goto('/apps/lookbook-social/branding');
  await expect(page.getByRole('heading', { name: 'Login branding' })).toBeVisible();
  await page.getByRole('button', { name: 'Use approved Lookbook palette' }).click();
  await expect(page.getByTestId('branded-login')).toHaveCSS('background-color', 'rgb(244, 241, 237)');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.getByTestId('branded-login')).toHaveCSS('background-color', 'rgb(17, 19, 27)');
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.getByLabel('text', { exact: true }).fill('#ffffff');
  await expect(page.getByRole('region', { name: 'Login branding', exact: true }).getByRole('alert')).toContainText('4.5:1');
  await expect(page.getByRole('button', { name: 'Save branding' })).toBeDisabled();
  await page.getByLabel('text', { exact: true }).fill('#000000');
  await expect(page.getByRole('button', { name: 'Save branding' })).toBeEnabled();
  await page.screenshot({ path: `/tmp/sso-branding-editor-${test.info().project.name}.png`, fullPage: true });
});
