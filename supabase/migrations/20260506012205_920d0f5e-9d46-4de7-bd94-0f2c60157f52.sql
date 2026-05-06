
-- Auto-grant admin role to the configured admin email
CREATE OR REPLACE FUNCTION public.auto_grant_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'lomitashootersleague@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_grant_admin_trg ON public.profiles;
CREATE TRIGGER auto_grant_admin_trg
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_grant_admin();

-- Backfill: grant admin to existing matching user, if any
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM public.profiles
WHERE email = 'lomitashootersleague@gmail.com'
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_profiles_gang_faction ON public.profiles(gang_faction);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles(country);
