-- Repair script for the Flight Menu feature.
-- Run this in Supabase Dashboard -> SQL Editor for the remote project.

CREATE TABLE IF NOT EXISTS public.flight_rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flight_leg_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unique_key TEXT,
  flight_number TEXT,
  origin TEXT,
  destination TEXT,
  departure_time TIMESTAMPTZ,
  arrival_time TIMESTAMPTZ,
  service_type TEXT,
  meal_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flight_rosters
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.flight_leg_details
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS unique_key TEXT,
  ADD COLUMN IF NOT EXISTS flight_number TEXT,
  ADD COLUMN IF NOT EXISTS origin TEXT,
  ADD COLUMN IF NOT EXISTS destination TEXT,
  ADD COLUMN IF NOT EXISTS departure_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS meal_type TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS flight_leg_details_user_unique_key_idx
  ON public.flight_leg_details (user_id, unique_key)
  WHERE unique_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS flight_leg_details_user_departure_time_idx
  ON public.flight_leg_details (user_id, departure_time);

ALTER TABLE public.flight_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_leg_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own flight rosters" ON public.flight_rosters;
CREATE POLICY "Users can view own flight rosters"
  ON public.flight_rosters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own flight rosters" ON public.flight_rosters;
CREATE POLICY "Users can insert own flight rosters"
  ON public.flight_rosters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own flight legs" ON public.flight_leg_details;
CREATE POLICY "Users can view own flight legs"
  ON public.flight_leg_details FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own flight legs" ON public.flight_leg_details;
CREATE POLICY "Users can insert own flight legs"
  ON public.flight_leg_details FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own flight legs" ON public.flight_leg_details;
CREATE POLICY "Users can update own flight legs"
  ON public.flight_leg_details FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ask Supabase/PostgREST to refresh its schema cache immediately.
NOTIFY pgrst, 'reload schema';
