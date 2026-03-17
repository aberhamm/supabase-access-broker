-- Add p_since parameter to list_app_users_paginated for incremental sync.
-- Filters users whose auth.users.updated_at is after the given timestamp.
-- This works because set_app_claims_batch updates raw_app_meta_data,
-- which triggers updated_at on auth.users.
CREATE OR REPLACE FUNCTION public.list_app_users_paginated(
  app_id text,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT '',
  p_since timestamptz DEFAULT NULL
)
 RETURNS TABLE(user_id uuid, user_email text, app_data jsonb, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    DECLARE
      v_total bigint;
    BEGIN
      IF NOT is_app_admin(app_id) THEN
          RAISE EXCEPTION 'access denied';
      END IF;

      -- Count total matching rows
      SELECT count(*) INTO v_total
      FROM auth.users
      WHERE raw_app_meta_data->'apps' ? app_id
        AND (raw_app_meta_data->'apps'->app_id->>'enabled')::boolean = true
        AND (p_search = '' OR email::text ILIKE '%' || p_search || '%')
        AND (p_since IS NULL OR updated_at > p_since);

      RETURN QUERY
      SELECT
        id,
        email::text,
        coalesce(raw_app_meta_data->'apps'->app_id, '{}'::jsonb),
        v_total
      FROM auth.users
      WHERE raw_app_meta_data->'apps' ? app_id
        AND (raw_app_meta_data->'apps'->app_id->>'enabled')::boolean = true
        AND (p_search = '' OR email::text ILIKE '%' || p_search || '%')
        AND (p_since IS NULL OR updated_at > p_since)
      ORDER BY email
      LIMIT p_limit
      OFFSET p_offset;
    END;
$function$;
