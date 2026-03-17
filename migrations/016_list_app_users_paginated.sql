-- Paginated version of list_app_users with server-side search
-- Supports offset/limit pagination and case-insensitive email search
CREATE OR REPLACE FUNCTION public.list_app_users_paginated(
  app_id text,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT ''
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
        AND (p_search = '' OR email::text ILIKE '%' || p_search || '%');

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
      ORDER BY email
      LIMIT p_limit
      OFFSET p_offset;
    END;
$function$;
