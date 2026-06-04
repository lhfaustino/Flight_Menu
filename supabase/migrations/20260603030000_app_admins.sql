-- Admin access managed by the superadmin.

CREATE TABLE IF NOT EXISTS public.app_admins (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_admins_active_role_idx
  ON public.app_admins (is_active, role, email);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own admin access" ON public.app_admins;
CREATE POLICY "Users can view own admin access"
  ON public.app_admins FOR SELECT
  TO authenticated
  USING (LOWER(email) = LOWER(auth.jwt() ->> 'email'));

INSERT INTO public.app_admins (email, role, is_active)
VALUES ('lyhenning@gmail.com', 'superadmin', TRUE)
ON CONFLICT (email) DO UPDATE SET
  role = 'superadmin',
  is_active = TRUE,
  updated_at = NOW();
