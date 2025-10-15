-- Seed Default Apps and Roles
-- Description: Populates initial apps and roles from the original TypeScript config
-- Safe to re-run: Yes (uses ON CONFLICT DO NOTHING)

-- Insert default apps
INSERT INTO public.apps (id, name, description, color, enabled)
VALUES
  ('app1', 'Application 1', 'Main application', 'blue', true),
  ('app2', 'Application 2', 'Secondary application', 'green', true)
ON CONFLICT (id) DO NOTHING;

-- Insert common global roles
INSERT INTO public.roles (name, label, description, is_global, permissions)
VALUES
  ('admin', 'Admin', 'Full access to the application', true, '["read", "write", "delete", "manage_users"]'::jsonb),
  ('user', 'User', 'Standard user access', true, '["read", "write"]'::jsonb),
  ('viewer', 'Viewer', 'Read-only access', true, '["read"]'::jsonb),
  ('editor', 'Editor', 'Can edit but not manage users', true, '["read", "write"]'::jsonb)
ON CONFLICT (name, app_id) DO NOTHING;
