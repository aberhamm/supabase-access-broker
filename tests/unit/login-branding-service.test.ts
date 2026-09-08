import { beforeEach, describe, expect, it, vi } from 'vitest';
import lookbook from '../fixtures/lookbook-branding.json';
import { LOOKBOOK_LOGIN_THEME } from '@/lib/branding-presets';
const mock = vi.hoisted(() => ({ allowed: vi.fn(), read: vi.fn(), select: vi.fn(), eq: vi.fn(), admin: vi.fn() }));
vi.mock('@/lib/sso-service', () => ({ isRedirectUriAllowed: mock.allowed }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: mock.admin }));
import { getLoginBranding } from '@/lib/login-branding-service';
const params = { app_id: 'lookbook-social', redirect_uri: 'https://lookbook.social/auth/callback' };
beforeEach(() => {
  vi.resetAllMocks();
  const query = { select: mock.select, eq: mock.eq, maybeSingle: mock.read };
  mock.select.mockReturnValue(query); mock.eq.mockReturnValue(query);
  mock.admin.mockResolvedValue({ schema: () => ({ from: () => query }) });
  mock.allowed.mockResolvedValue(true);
  mock.read.mockResolvedValue({ data: { ...lookbook, login_theme: LOOKBOOK_LOGIN_THEME }, error: null });
});
describe('SSO branding boundary', () => {
  it('uses validated identity and ignores untrusted query presentation', async () => {
    const result = await getLoginBranding({ ...params, color: 'url(evil)', name: 'Attacker' });
    expect(result?.name).toBe('Lookbook');
    expect(mock.allowed).toHaveBeenCalledWith({ appId: params.app_id, redirectUri: params.redirect_uri });
    expect(mock.eq).toHaveBeenCalledWith('id', 'lookbook-social');
    expect(mock.eq).toHaveBeenCalledWith('enabled', true);
    expect(mock.select).toHaveBeenCalledWith('name,color,icon,login_theme');
  });
  it.each([{}, { app_id: 'lookbook-social' }, { app_id: ['a', 'b'], redirect_uri: 'https://example.com' }, { ...params, redirect_uri: ['a', 'b'] }])('falls back without lookup for incomplete/ambiguous identity %j', async input => {
    expect(await getLoginBranding(input)).toBeNull();
    expect(mock.admin).not.toHaveBeenCalled();
  });
  it('does not reveal branding for unauthorized redirects or disabled apps', async () => {
    mock.allowed.mockResolvedValue(false);
    expect(await getLoginBranding(params)).toBeNull();
    expect(mock.admin).not.toHaveBeenCalled();
  });
  it('does not cache removed apps, tenant results, or failures', async () => {
    expect((await getLoginBranding(params))?.name).toBe('Lookbook');
    mock.read.mockResolvedValueOnce({ data: null, error: null });
    expect(await getLoginBranding(params)).toBeNull();
    mock.read.mockRejectedValueOnce(new Error('offline'));
    expect(await getLoginBranding(params)).toBeNull();
  });
  it('retains legacy identity during migration rollout', async () => {
    mock.read.mockResolvedValueOnce({ error: { code: '42703' }, data: null }).mockResolvedValueOnce({ data: lookbook, error: null });
    const result = await getLoginBranding(params);
    expect(result?.name).toBe('Lookbook');
    expect(result?.theme.light.accent).toBe('#ff0001');
    expect(mock.select).toHaveBeenLastCalledWith('name,color,icon');
  });
});
