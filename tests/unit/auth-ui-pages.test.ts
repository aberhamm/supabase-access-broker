import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardContent } from '@/components/ui/card';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSpinner } from '@/components/auth/AuthSpinner';
import SSOErrorPage from '@/app/sso/error/page';
import SSOContinuePage from '@/app/sso/continue/page';

const navMocks = vi.hoisted(() => ({
  search: '',
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navMocks.search),
  useRouter: () => ({
    push: navMocks.push,
    replace: navMocks.replace,
  }),
}));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
  })),
}));

function pageText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function expectInOrder(text: string, expected: string[]) {
  let lastIndex = -1;
  for (const item of expected) {
    const nextIndex = text.indexOf(item);
    expect(nextIndex, `${item} should be present`).toBeGreaterThanOrEqual(0);
    expect(nextIndex, `${item} should appear after previous text`).toBeGreaterThan(lastIndex);
    lastIndex = nextIndex;
  }
}

beforeEach(() => {
  navMocks.search = '';
  navMocks.push.mockClear();
  navMocks.replace.mockClear();
});

describe('AuthShell and AuthSpinner', () => {
  it('renders the shared gradient, grid, glass card, max width, and accessible spinner label', () => {
    const html = renderToStaticMarkup(
      createElement(
        AuthShell,
        null,
        createElement(
          CardContent,
          null,
          createElement(AuthSpinner, { label: 'Loading auth shell' })
        )
      )
    );

    expect(html).toContain('min-h-screen');
    expect(html).toContain('overflow-hidden');
    expect(html).toContain('bg-gradient-to-br');
    expect(html).toContain('animate-float-slow');
    expect(html).toContain('animate-float-slower');
    expect(html).toContain('max-w-md');
    expect(html).toContain('glass');
    expect(html).toContain('glass-border');
    expect(html).toContain('role="status"');
    expect(html).toContain('sr-only');
    expect(pageText(html)).toContain('Loading auth shell');
  });
});

describe('/sso/error UI contract', () => {
  it('renders retryable errors with friendly copy, actions before hints, and details last', () => {
    navMocks.search = 'error=server_error&app_id=demo-app&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&state=state-1';

    const html = renderToStaticMarkup(createElement(SSOErrorPage));
    const text = pageText(html);

    expect(text).not.toContain('SSO Error');
    expect(text).toContain("Couldn't sign you in");
    expect(text).toContain('An unexpected error occurred. Please try again.');
    expect(text).toContain('Try Again');
    expect(text).toContain('Sign in with a different account');
    expect(text).toContain('Technical details');
    expect(text).toContain('server_error');
    expect(text).toContain('demo-app');
    expect(html).toContain('max-w-md');
    expectInOrder(text, [
      "Couldn't sign you in",
      'An unexpected error occurred. Please try again.',
      'Try Again',
      'Sign in with a different account',
      'What you can do:',
      'Technical details',
    ]);
  });

  it('hides retry and makes sign-in primary for deterministic non-retryable errors', () => {
    navMocks.search = 'error=access_denied&app_id=demo-app&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback';

    const html = renderToStaticMarkup(createElement(SSOErrorPage));
    const text = pageText(html);

    expect(text).not.toContain('Try Again');
    expect(text).toContain('Sign in with a different account');
    expect(html).toContain('data-variant="default"');
    expectInOrder(text, [
      "Couldn't sign you in",
      'You do not have permission to access this application.',
      'Sign in with a different account',
      'What you can do:',
      'Technical details',
    ]);
  });

  it('never renders attacker-controlled error descriptions', () => {
    navMocks.search = 'error=server_error&error_description=INJECTED_PHISHING_TEXT&app_id=demo-app&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback';

    const text = pageText(renderToStaticMarkup(createElement(SSOErrorPage)));

    expect(text).toContain('An unexpected error occurred. Please try again.');
    expect(text).not.toContain('INJECTED_PHISHING_TEXT');
  });
});

describe('/sso/continue initial UI contract', () => {
  it('shows a labeled loading state without flashing old fallback copy', () => {
    navMocks.search = 'app_id=demo-app&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&state=state-1';

    const html = renderToStaticMarkup(createElement(SSOContinuePage));
    const text = pageText(html);

    expect(text).toContain('Loading account chooser');
    expect(text).toContain('Continue with this account');
    expect(text).toContain('Use a different account');
    expect(text).not.toContain('Continue to application');
    expect(text).not.toContain("You're already signed in as");
    expect(html).toContain('max-w-md');
    expect((html.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
