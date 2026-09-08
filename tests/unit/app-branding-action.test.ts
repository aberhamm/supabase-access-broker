import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOOKBOOK_LOGIN_THEME } from '@/lib/branding-presets';
const mock = vi.hoisted(() => ({ admin: vi.fn(), update: vi.fn(), read: vi.fn(), refresh: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/apps-service', () => ({ refreshCache: mock.refresh }));
vi.mock('@/lib/claims', () => ({ isClaimsAdmin: mock.admin }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ schema: () => ({ from: () => ({ update: mock.update }) }) }) }));
import { updateAppBrandingAction } from '@/app/actions/app-branding';
beforeEach(() => {
  vi.resetAllMocks();
  mock.admin.mockResolvedValue({ data: true });
  mock.update.mockReturnValue({ eq: () => ({ select: () => ({ maybeSingle: mock.read }) }) });
  mock.read.mockResolvedValue({ data: { id: 'lookbook-social' }, error: null });
});
describe('admin branding writes', () => {
  it('rejects non-claims-admin callers before mutation', async () => {
    mock.admin.mockResolvedValue({ data: false });
    expect((await updateAppBrandingAction('lookbook-social', LOOKBOOK_LOGIN_THEME)).error).toContain('Unauthorized');
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('rejects invalid palettes before mutation', async () => {
    expect((await updateAppBrandingAction('lookbook-social', { ...LOOKBOOK_LOGIN_THEME, css: 'bad' })).error).toBeTruthy();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('saves and resets only the theme column', async () => {
    expect(await updateAppBrandingAction('lookbook-social', LOOKBOOK_LOGIN_THEME)).toEqual({ error: null });
    expect(mock.update).toHaveBeenCalledWith({ login_theme: LOOKBOOK_LOGIN_THEME });
    expect(await updateAppBrandingAction('lookbook-social', null)).toEqual({ error: null });
    expect(mock.update).toHaveBeenLastCalledWith({ login_theme: null });
  });
  it('reports RLS/no-row and migration errors without exposing database details', async () => {
    mock.read.mockResolvedValueOnce({ data: null, error: null });
    expect((await updateAppBrandingAction('missing', null)).error).toContain('unavailable');
    mock.read.mockResolvedValueOnce({ error: { code: '42703' }, data: null });
    expect((await updateAppBrandingAction('lookbook-social', null)).error).toContain('migration 030');
    expect(mock.refresh).not.toHaveBeenCalled();
  });
});
