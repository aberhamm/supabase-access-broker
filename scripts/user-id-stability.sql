-- Diagnostic queries for SSO user ID stability issues.
-- Replace the email literal as needed for other users.

-- 1) Check historical auth codes for the affected user
SELECT
  ac.user_id,
  ac.created_at,
  u.email,
  u.id AS actual_user_id
FROM access_broker_app.auth_codes ac
JOIN auth.users u ON ac.user_id = u.id
WHERE u.email = 'matthew.aberham@gmail.com'
ORDER BY ac.created_at DESC
LIMIT 20;

-- 2) Check SSO audit logs for token exchanges
SELECT
  event_type,
  user_id,
  created_at,
  metadata
FROM public.sso_audit_logs
WHERE event_type LIKE '%token_exchange%'
  AND user_id IN (
    SELECT id
    FROM auth.users
    WHERE email = 'matthew.aberham@gmail.com'
  )
ORDER BY created_at DESC
LIMIT 20;

-- 3) Verify single user record by email
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE email = 'matthew.aberham@gmail.com';
