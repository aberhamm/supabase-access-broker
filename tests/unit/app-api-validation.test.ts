import { describe, it, expect } from 'vitest';
import { isValidEmail, validateClaimValues, extractAppClaims } from '@/lib/app-api-validation';

describe('isValidEmail', () => {
  it('accepts valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('user+tag@domain.org')).toBe(true);
  });

  it('rejects invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@missing-local.com')).toBe(false);
    expect(isValidEmail('missing-domain@')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
    expect(isValidEmail('no-tld@domain')).toBe(false);
  });
});

describe('validateClaimValues', () => {
  it('returns null for valid claims', () => {
    expect(validateClaimValues({ enabled: true })).toBeNull();
    expect(validateClaimValues({ role: 'admin' })).toBeNull();
    expect(validateClaimValues({ permissions: ['read', 'write'] })).toBeNull();
    expect(validateClaimValues({ metadata: { key: 'value' } })).toBeNull();
    expect(validateClaimValues({
      enabled: true,
      role: 'user',
      permissions: ['read'],
      metadata: { org: 'acme' },
    })).toBeNull();
  });

  it('returns null when no claim fields are present', () => {
    expect(validateClaimValues({})).toBeNull();
    expect(validateClaimValues({ unrelated: 'field' })).toBeNull();
  });

  it('rejects non-boolean enabled', () => {
    expect(validateClaimValues({ enabled: 'yes' })).toBe('enabled must be a boolean');
    expect(validateClaimValues({ enabled: 1 })).toBe('enabled must be a boolean');
  });

  it('rejects invalid role', () => {
    expect(validateClaimValues({ role: '' })).toBe('role must be a non-empty string ≤ 64 characters');
    expect(validateClaimValues({ role: 123 })).toBe('role must be a non-empty string ≤ 64 characters');
    expect(validateClaimValues({ role: 'a'.repeat(65) })).toBe('role must be a non-empty string ≤ 64 characters');
  });

  it('accepts role at max length', () => {
    expect(validateClaimValues({ role: 'a'.repeat(64) })).toBeNull();
  });

  it('rejects invalid permissions', () => {
    expect(validateClaimValues({ permissions: 'not-an-array' })).toMatch(/permissions must be/);
    expect(validateClaimValues({ permissions: [123] })).toMatch(/permissions must be/);
    expect(validateClaimValues({ permissions: [''] })).toMatch(/permissions must be/);
    expect(validateClaimValues({ permissions: ['a'.repeat(129)] })).toMatch(/permissions must be/);
  });

  it('rejects permissions array exceeding 100 items', () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `perm_${i}`);
    expect(validateClaimValues({ permissions: tooMany })).toMatch(/permissions must be/);
  });

  it('accepts permissions at max count and length', () => {
    const maxPerms = Array.from({ length: 100 }, (_, i) => `perm_${i}`);
    expect(validateClaimValues({ permissions: maxPerms })).toBeNull();
    expect(validateClaimValues({ permissions: ['a'.repeat(128)] })).toBeNull();
  });

  it('rejects invalid metadata', () => {
    expect(validateClaimValues({ metadata: 'string' })).toBe('metadata must be a JSON object');
    expect(validateClaimValues({ metadata: null })).toBe('metadata must be a JSON object');
    expect(validateClaimValues({ metadata: [1, 2] })).toBe('metadata must be a JSON object');
  });

  it('rejects metadata exceeding 8KB', () => {
    const big = { data: 'x'.repeat(8193) };
    expect(validateClaimValues({ metadata: big })).toBe('metadata must not exceed 8 KB');
  });

  it('accepts metadata at max size', () => {
    // 8192 bytes allows for some JSON overhead + data
    const data = { d: 'x'.repeat(8000) };
    expect(validateClaimValues({ metadata: data })).toBeNull();
  });
});

describe('extractAppClaims', () => {
  it('extracts claims for a specific app', () => {
    const user = {
      app_metadata: {
        apps: {
          'app-1': { enabled: true, role: 'admin' },
          'app-2': { enabled: false },
        },
      },
    };
    expect(extractAppClaims(user, 'app-1')).toEqual({ enabled: true, role: 'admin' });
    expect(extractAppClaims(user, 'app-2')).toEqual({ enabled: false });
  });

  it('returns null when app has no claims', () => {
    const user = {
      app_metadata: {
        apps: {
          'app-1': { enabled: true },
        },
      },
    };
    expect(extractAppClaims(user, 'nonexistent')).toBeNull();
  });

  it('returns null when apps object is missing', () => {
    expect(extractAppClaims({ app_metadata: {} }, 'app-1')).toBeNull();
    expect(extractAppClaims({ app_metadata: { other: 'data' } }, 'app-1')).toBeNull();
  });

  it('returns null when app_metadata is empty', () => {
    expect(extractAppClaims({ app_metadata: {} as Record<string, unknown> }, 'app-1')).toBeNull();
  });
});
