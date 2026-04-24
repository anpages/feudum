-- Fix handle_new_auth_user trigger: migration 0038 dropped is_admin column
-- and replaced it with a role enum, but never updated this trigger function.
-- New user signups were failing with server_error because the function tried
-- to insert into a column that no longer exists.

CREATE OR REPLACE FUNCTION "handle_new_auth_user"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email text := current_setting('app.admin_email', true);
BEGIN
  INSERT INTO public.users (id, email, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN admin_email IS NOT NULL AND NEW.email = admin_email THEN 'admin'::user_role
      ELSE 'human'::user_role
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
