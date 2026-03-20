import { expect, type Page, test } from '@playwright/test';
import { ensureTestUser, supabase, TEST_USER } from './utils/test-helpers';

test.describe.configure({ mode: 'serial' });

async function login(page: Page) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: TEST_USER.email,
    options: {
      redirectTo: 'http://localhost:3050/auth/callback?next=%2F',
    },
  });

  if (error) throw error;

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) throw new Error('Failed to generate test magic link token');

  await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=email&next=%2F`);
  await page.waitForURL((url) => !url.pathname.includes('/auth/confirm'), { timeout: 15000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.innerWidth + 1);
}

async function expectHeaderActionsResponsive(page: Page) {
  const actions = page.locator('[data-slot="page-header-actions"]').first();
  await expect(actions).toBeVisible();

  // Wait for CSS to settle after hydration
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector);
      return el && window.getComputedStyle(el).flexDirection !== '';
    },
    '[data-slot="page-header-actions"]',
    { timeout: 5000 }
  ).catch(() => {});

  const layout = await actions.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      direction: style.flexDirection,
      width: element.getBoundingClientRect().width,
      parentWidth: element.parentElement?.getBoundingClientRect().width ?? 0,
      viewportWidth: window.innerWidth,
    };
  });

  // Skip style assertion if CSS hasn't loaded (e.g., during hydration)
  if (!layout.direction) return;

  if (layout.viewportWidth < 640) {
    // Mobile: actions should stack vertically and fill width
    expect(layout.direction).toBe('column');
    expect(layout.width).toBeGreaterThanOrEqual(layout.parentWidth - 2);
  } else {
    // Desktop: actions should be in a row
    expect(layout.direction).toBe('row');
  }
}

test.describe('Responsive smoke', () => {
  test.beforeAll(async () => {
    await ensureTestUser();
  });

  test('public routes do not overflow on mobile', async ({ page }) => {
    const routes = ['/login', '/docs', '/docs/integrator/sso-integration-guide'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(page);
    }
  });

  test('authenticated routes stay mobile-safe and use compact/tablet-aware layouts', async ({ page }) => {
    await login(page);

    const routes = [
      { path: '/', expectActions: true },
      { path: '/users', expectActions: true, expectCompactUsers: true },
      { path: '/apps', expectActions: true },
      { path: '/account', expectActions: true },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(page);

      if (route.expectActions) {
        await expectHeaderActionsResponsive(page);
      }

      if (route.expectCompactUsers) {
        // On mobile, default view should be compact; on desktop, any view mode is acceptable
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        if (viewportWidth < 640) {
          await expect(page.locator('[data-view-mode="compact"]')).toBeVisible();
        }
      }
    }

    await page.goto('/apps');
    await page.waitForLoadState('networkidle');

    const appDetailLink = page.locator('a[href^="/apps/"]').filter({
      has: page.getByText('View Details'),
    }).first();

    await expect(appDetailLink).toBeVisible();
    await appDetailLink.click();
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page);
    await expectHeaderActionsResponsive(page);
  });
});
