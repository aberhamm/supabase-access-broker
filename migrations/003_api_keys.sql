-- Migration: API Keys for Multi-App Authentication
-- Description: Creates tables and functions for managing API keys per app
-- Safe to re-run: Yes (uses CREATE TABLE IF NOT EXISTS and CREATE OR REPLACE)

-- ============================================================================
-- Tables
-- ============================================================================

-- API Keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  key_hash TEXT NOT NULL UNIQUE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_app_key_name UNIQUE(app_id, name)
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "claims_admin can manage api_keys" ON public.api_keys;

-- Policies (only admins can manage)
CREATE POLICY "claims_admin can manage api_keys"
  ON public.api_keys FOR ALL
  USING (is_claims_admin());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_app_id ON public.api_keys(app_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_enabled ON public.api_keys(enabled);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON public.api_keys(expires_at);

-- ============================================================================
-- RPC Functions for API Keys
-- ============================================================================

-- Get all API keys for a specific app
CREATE OR REPLACE FUNCTION get_app_api_keys(p_app_id TEXT)
RETURNS TABLE(
  id UUID,
  app_id TEXT,
  name TEXT,
  description TEXT,
  key_hash TEXT,
  role_id UUID,
  role_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  enabled BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view api keys';
  END IF;

  RETURN QUERY
  SELECT
    k.id,
    k.app_id,
    k.name,
    k.description,
    k.key_hash,
    k.role_id,
    r.name as role_name,
    k.expires_at,
    k.last_used_at,
    k.created_by,
    k.enabled,
    k.created_at
  FROM public.api_keys k
  LEFT JOIN public.roles r ON k.role_id = r.id
  WHERE k.app_id = p_app_id
  ORDER BY k.created_at DESC;
END;
$$;

-- Create a new API key
CREATE OR REPLACE FUNCTION create_api_key(
  p_app_id TEXT,
  p_name TEXT,
  p_key_hash TEXT,
  p_description TEXT DEFAULT NULL,
  p_role_id UUID DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS UUID LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_key_id UUID;
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can create api keys';
  END IF;

  -- Validate app exists
  IF NOT EXISTS (SELECT 1 FROM public.apps WHERE id = p_app_id) THEN
    RAISE EXCEPTION 'app not found';
  END IF;

  -- Validate role exists and is valid for this app
  IF p_role_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.roles
      WHERE id = p_role_id
      AND (app_id = p_app_id OR is_global = true)
    ) THEN
      RAISE EXCEPTION 'role not found or not valid for this app';
    END IF;
  END IF;

  INSERT INTO public.api_keys (
    app_id, name, description, key_hash, role_id, expires_at, created_by
  )
  VALUES (
    p_app_id, p_name, p_description, p_key_hash, p_role_id, p_expires_at, p_created_by
  )
  RETURNING id INTO v_key_id;

  RETURN v_key_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'api key with this name already exists for this app';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'error: %', SQLERRM;
END;
$$;

-- Update an existing API key
CREATE OR REPLACE FUNCTION update_api_key(
  p_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_role_id UUID DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT NULL
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  UPDATE public.api_keys
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    role_id = COALESCE(p_role_id, role_id),
    expires_at = COALESCE(p_expires_at, expires_at),
    enabled = COALESCE(p_enabled, enabled)
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: api key not found';
  END IF;

  RETURN 'OK';
END;
$$;

-- Delete an API key
CREATE OR REPLACE FUNCTION delete_api_key(p_id UUID)
RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  DELETE FROM public.api_keys WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: api key not found';
  END IF;

  RETURN 'OK';
END;
$$;

-- Validate an API key (for middleware use)
-- Returns app_id and role info if valid, NULL if invalid
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash TEXT)
RETURNS TABLE(
  key_id UUID,
  app_id TEXT,
  role_id UUID,
  role_name TEXT,
  permissions JSONB,
  is_valid BOOLEAN
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id as key_id,
    k.app_id,
    k.role_id,
    r.name as role_name,
    r.permissions,
    (
      k.enabled = true
      AND (k.expires_at IS NULL OR k.expires_at > NOW())
    ) as is_valid
  FROM public.api_keys k
  LEFT JOIN public.roles r ON k.role_id = r.id
  WHERE k.key_hash = p_key_hash;
END;
$$;

-- Record API key usage
CREATE OR REPLACE FUNCTION record_api_key_usage(p_key_hash TEXT)
RETURNS VOID LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.api_keys
  SET last_used_at = NOW()
  WHERE key_hash = p_key_hash;
END;
$$;

NOTIFY pgrst, 'reload schema';
