-- Migration: Pin the legacy chatbot custom_access_token_hook into version control.
--
-- This hook is OWNED BY the next-chat-umbrella-app project, not by the access
-- broker. It runs on every JWT mint for every user of this Supabase instance
-- (including users who have nothing to do with chatbot) and injects two
-- top-level JWT claims:
--
--   claims.super_admin   <- auth.users.is_super_admin
--   claims.org_admin_ids <- ids of orgs in chatbot.organization_users where is_admin
--
-- The chatbot project's RLS policies key off these claims directly, so the
-- function cannot be removed without a coordinated rewrite of those policies
-- in the chatbot repo (~30+ policies across chatbot.* tables). Until that
-- refactor happens, we pin the hook here so:
--
--   1. The dependency is visible in `git grep` of this repo.
--   2. `supabase db diff` against this migration set shows drift.
--   3. The hook can't silently disappear or be rewritten without a PR.
--
-- This migration is a pure CREATE OR REPLACE of the live function definition
-- as observed on prod (Supabase project ompkcxbssxfweeqwdibt) — no behavior
-- change.
--
-- Safe to re-run: YES.

BEGIN;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  org_ids JSONB;
BEGIN
  SELECT COALESCE(JSONB_AGG(organization_id), '[]'::JSONB)
  INTO org_ids
  FROM chatbot.organization_users
  WHERE user_id = (event->>'user_id')::UUID
    AND is_admin;

  event := jsonb_set(
    event,
    '{claims,super_admin}',
    to_jsonb(COALESCE(
      (SELECT is_super_admin FROM auth.users WHERE id = (event->>'user_id')::UUID),
      false
    )),
    true
  );

  event := jsonb_set(event, '{claims,org_admin_ids}', org_ids, true);
  RETURN event;
END;
$function$;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Legacy JWT hook owned by next-chat-umbrella-app. Pinned in broker repo for visibility. '
  'Removal requires coordinated rewrite of chatbot.* RLS policies that read claims.super_admin and claims.org_admin_ids.';

COMMIT;
