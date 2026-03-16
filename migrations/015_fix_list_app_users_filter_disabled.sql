-- Fix list_app_users to filter out disabled users and cast email to text
CREATE OR REPLACE FUNCTION public.list_app_users(app_id text)
 RETURNS TABLE(user_id uuid, user_email text, app_data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    BEGIN
      IF NOT is_app_admin(app_id) THEN
          RAISE EXCEPTION 'access denied';
      ELSE
        RETURN QUERY
        select
          id,
          email::text,
          coalesce(raw_app_meta_data->'apps'->app_id, '{}'::jsonb) as app_data
        from auth.users
        where raw_app_meta_data->'apps' ? app_id
          and (raw_app_meta_data->'apps'->app_id->>'enabled')::boolean = true
        order by email;
      END IF;
    END;
$function$;
