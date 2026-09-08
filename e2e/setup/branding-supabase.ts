/** Isolated read-only Supabase HTTP fixture. Never loads .env.local or contacts a real database. */
import { createServer } from 'node:http';
import lookbook from '../../tests/fixtures/lookbook-branding.json';
import { LOOKBOOK_LOGIN_THEME } from '../../lib/branding-presets';
const methods = { password: true, magic_link: true, email_otp: true, passkeys: true, google: true, github: false, apple: false };
createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1:3063');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.end(); return; }
  if (url.pathname === '/auth/v1/user') {
    res.end(JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', email: 'admin@example.test', app_metadata: { claims_admin: true }, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' })); return;
  }
  if (url.pathname === '/rest/v1/rpc/is_claims_admin') { res.end('true'); return; }
  if (url.pathname === '/health') { res.end('{}'); return; }
  if (url.pathname === '/rest/v1/rpc/consume_rate_limit') {
    res.end(JSON.stringify({ allowed: true, hits: 1, remaining: 29, reset_at: Date.now() / 1000 + 60 })); return;
  }
  if (url.pathname === '/rest/v1/apps' && req.method === 'GET') {
    const id = url.searchParams.get('id')?.replace(/^eq\./, '');
    const record = (!id || id === 'lookbook-social') ? { ...lookbook, login_theme: LOOKBOOK_LOGIN_THEME }
      : id === 'legacy' ? { ...lookbook, id, name: 'Legacy App', icon: null, color: '#166534' }
      : id === 'malformed' ? { ...lookbook, id, name: 'Malformed App', color: 'url(https://evil.test)', login_theme: { version: 1, light: { background: 'url(https://evil.test)' } } }
      : id === 'disabled' ? { ...lookbook, id, enabled: false }
      : id === 'system' ? { ...lookbook, id, name: 'System App', color: '#253c80', icon: null }
      : null;
    if (id === 'legacy' && url.searchParams.get('select')?.includes('login_theme')) {
      res.statusCode = 400; res.end(JSON.stringify({ code: '42703', message: 'column missing' })); return;
    }
    if (!record || (url.searchParams.get('enabled') === 'eq.true' && !record.enabled)) { res.end('null'); return; }
    const row: Record<string, unknown> = { ...record, auth_methods: methods, allow_self_signup: false, allow_loopback_redirects: false };
    const fields = (url.searchParams.get('select') ?? '').split(',');
    const selected = Object.fromEntries(fields.filter(key => key in row).map(key => [key, row[key]]));
    res.end(JSON.stringify(id ? selected : [selected])); return;
  }
  // Auth attempts are deliberately rejected. No account creation, email or token issuance.
  res.statusCode = 400;
  res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }));
}).listen(3063, '127.0.0.1', () => console.log('Branding Supabase fixture ready on 3063'));
