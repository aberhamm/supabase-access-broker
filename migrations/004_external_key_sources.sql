-- Migration: External API Key Sources
-- Description: Enables fetching and displaying API keys from external systems (n8n, Django, etc.)
-- Safe to re-run: Yes (uses CREATE TABLE IF NOT EXISTS and CREATE OR REPLACE)

-- ============================================================================
-- Tables
-- ============================================================================

-- External key sources table
CREATE TABLE IF NOT EXISTS public.external_key_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'n8n', 'django', 'generic'
  api_url TEXT NOT NULL,
  api_credentials TEXT, -- Encrypted credentials (can be null for public APIs)
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_app_source_name UNIQUE(app_id, name)
);

-- Enable RLS
ALTER TABLE public.external_key_sources ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "claims_admin can manage external_key_sources" ON public.external_key_sources;

-- Policies (only admins can manage)
CREATE POLICY "claims_admin can manage external_key_sources"
  ON public.external_key_sources FOR ALL
  USING (is_claims_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_external_sources_app_id ON public.external_key_sources(app_id);
CREATE INDEX IF NOT EXISTS idx_external_sources_enabled ON public.external_key_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_external_sources_type ON public.external_key_sources(source_type);

-- ============================================================================
-- RPC Functions for External Key Sources
-- ============================================================================

-- Get all external sources for a specific app
CREATE OR REPLACE FUNCTION get_external_sources(p_app_id TEXT)
RETURNS TABLE(
  id UUID,
  app_id TEXT,
  name TEXT,
  source_type TEXT,
  api_url TEXT,
  enabled BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view external sources';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.app_id,
    s.name,
    s.source_type,
    s.api_url,
    s.enabled,
    s.created_at,
    s.updated_at
  FROM public.external_key_sources s
  WHERE s.app_id = p_app_id
  ORDER BY s.name;
END;
$$;

-- Get all enabled external sources for a specific app
CREATE OR REPLACE FUNCTION get_enabled_external_sources(p_app_id TEXT)
RETURNS TABLE(
  id UUID,
  app_id TEXT,
  name TEXT,
  source_type TEXT,
  api_url TEXT,
  api_credentials TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view external sources';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.app_id,
    s.name,
    s.source_type,
    s.api_url,
    s.api_credentials,
    s.created_at
  FROM public.external_key_sources s
  WHERE s.app_id = p_app_id AND s.enabled = true
  ORDER BY s.name;
END;
$$;

-- Create a new external source
CREATE OR REPLACE FUNCTION create_external_source(
  p_app_id TEXT,
  p_name TEXT,
  p_source_type TEXT,
  p_api_url TEXT,
  p_api_credentials TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_source_id UUID;
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can create external sources';
  END IF;

  -- Validate app exists
  IF NOT EXISTS (SELECT 1 FROM public.apps WHERE id = p_app_id) THEN
    RAISE EXCEPTION 'app not found';
  END IF;

  INSERT INTO public.external_key_sources (
    app_id, name, source_type, api_url, api_credentials
  )
  VALUES (
    p_app_id, p_name, p_source_type, p_api_url, p_api_credentials
  )
  RETURNING id INTO v_source_id;

  RETURN v_source_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'external source with this name already exists for this app';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'error: %', SQLERRM;
END;
$$;

-- Update an existing external source
CREATE OR REPLACE FUNCTION update_external_source(
  p_id UUID,
  p_name TEXT DEFAULT NULL,
  p_api_url TEXT DEFAULT NULL,
  p_api_credentials TEXT DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT NULL
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  UPDATE public.external_key_sources
  SET
    name = COALESCE(p_name, name),
    api_url = COALESCE(p_api_url, api_url),
    api_credentials = COALESCE(p_api_credentials, api_credentials),
    enabled = COALESCE(p_enabled, enabled),
    updated_at = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: external source not found';
  END IF;

  RETURN 'OK';
END;
$$;

-- Delete an external source
CREATE OR REPLACE FUNCTION delete_external_source(p_id UUID)
RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  DELETE FROM public.external_key_sources WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: external source not found';
  END IF;

  RETURN 'OK';
END;
$$;

NOTIFY pgrst, 'reload schema';

