-- Migration 011: User Lookup Function
-- Description: Adds function to lookup users by ID, email, or telegram_id for SSO client apps

-- Create function to lookup users by multiple identifiers
CREATE OR REPLACE FUNCTION lookup_user_by_identifier(
  p_user_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_telegram_id BIGINT DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  email TEXT,
  raw_app_meta_data JSONB
) SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Lookup user by one of the provided identifiers
  -- The API endpoint ensures only one identifier is passed
  RETURN QUERY
  SELECT u.id, u.email::TEXT, u.raw_app_meta_data
  FROM auth.users u
  WHERE 
    (p_user_id IS NOT NULL AND u.id = p_user_id)
    OR (p_email IS NOT NULL AND lower(u.email) = lower(p_email))
    OR (p_telegram_id IS NOT NULL AND 
        (u.raw_app_meta_data->'telegram'->>'id') IS NOT NULL AND
        (u.raw_app_meta_data->'telegram'->>'id') ~ '^[0-9]+$' AND
        (u.raw_app_meta_data->'telegram'->>'id')::BIGINT = p_telegram_id)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission ONLY to service_role
-- This prevents authenticated users from bypassing API-level app authentication
-- The API endpoint at /api/users/lookup validates app_id and app_secret
GRANT EXECUTE ON FUNCTION lookup_user_by_identifier TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION lookup_user_by_identifier IS 
  'Looks up a user by user_id, email, or telegram_id. Used by /api/users/lookup endpoint for SSO client apps.';
