
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- Existing users keep access
UPDATE public.profiles SET approved = true WHERE approved = false;

-- Auto-approve any existing or future admin
UPDATE public.profiles p SET approved = true
  WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'admin');

-- Update signup trigger: auto-approve pauloadm; others stay pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uname text;
  is_admin boolean := false;
BEGIN
  uname := lower(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)));
  IF uname = 'pauloadm' OR lower(NEW.email) LIKE 'pauloadm@%' OR lower(NEW.email) = 'pauloaraujo.viasupermercados@gmail.com' THEN
    is_admin := true;
  END IF;

  INSERT INTO public.profiles (id, email, nome, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    is_admin
  );

  IF is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Keep approval in sync when a role is granted/removed by admin
CREATE OR REPLACE FUNCTION public.sync_profile_approval_on_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET approved = true WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_approval_on_role ON public.user_roles;
CREATE TRIGGER trg_sync_approval_on_role
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_approval_on_role();
