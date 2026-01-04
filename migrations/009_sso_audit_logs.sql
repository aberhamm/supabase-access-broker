-- Migration: 009_sso_audit_logs
-- Purpose: Create audit log table for SSO events (authorization, token exchange, errors)
-- This supports compliance requirements and debugging of authentication flows.

-- Create the SSO audit logs table
CREATE TABLE IF NOT EXISTS public.sso_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event classification
  event_type TEXT NOT NULL,  -- e.g., 'sso_complete_success', 'sso_complete_error', 'token_exchange_success', 'token_exchange_error'

  -- Context
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  app_id TEXT REFERENCES public.apps(id) ON DELETE SET NULL,

  -- Request details (sanitized - no full redirect_uri for security)
  redirect_uri_host TEXT,  -- Just the hostname, not full URI
  error_code TEXT,         -- Machine-readable error code if applicable

  -- Client info
  ip_address INET,
  user_agent TEXT,

  -- Flexible metadata for additional context
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sso_audit_logs_event_type ON public.sso_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_sso_audit_logs_user_id ON public.sso_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_audit_logs_app_id ON public.sso_audit_logs(app_id);
CREATE INDEX IF NOT EXISTS idx_sso_audit_logs_created_at ON public.sso_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sso_audit_logs_error_code ON public.sso_audit_logs(error_code) WHERE error_code IS NOT NULL;

-- Composite index for time-range queries with filtering
CREATE INDEX IF NOT EXISTS idx_sso_audit_logs_app_time ON public.sso_audit_logs(app_id, created_at DESC);

-- Enable RLS (only claims_admin can read audit logs)
ALTER TABLE public.sso_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only claims admins can read audit logs
CREATE POLICY "Claims admins can read SSO audit logs"
  ON public.sso_audit_logs
  FOR SELECT
  USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'claims_admin')::boolean = true
  );

-- No direct INSERT/UPDATE/DELETE via client - only service role can write
-- (The application will use the admin client to insert logs)

-- Create a function for inserting audit logs (can be called via RPC if needed)
CREATE OR REPLACE FUNCTION public.log_sso_event(
  p_event_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_app_id TEXT DEFAULT NULL,
  p_redirect_uri_host TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.sso_audit_logs (
    event_type,
    user_id,
    app_id,
    redirect_uri_host,
    error_code,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_event_type,
    p_user_id,
    p_app_id,
    p_redirect_uri_host,
    p_error_code,
    p_ip_address,
    p_user_agent,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Grant execute on the function to authenticated users (function is SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.log_sso_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_sso_event TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.sso_audit_logs IS 'Audit log for SSO authentication events. Used for compliance and debugging.';
COMMENT ON COLUMN public.sso_audit_logs.event_type IS 'Event classification: sso_complete_success, sso_complete_error, token_exchange_success, token_exchange_error';
COMMENT ON COLUMN public.sso_audit_logs.redirect_uri_host IS 'Hostname from redirect_uri (sanitized, not full URI)';
COMMENT ON COLUMN public.sso_audit_logs.metadata IS 'Additional context in JSON format (e.g., error details, request params)';



