-- RLS policies for flight roster and catering upload tables.
-- These tables are user-scoped by user_id, so authenticated users can manage
-- only rows where user_id matches auth.uid().

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
  roster_id UUID REFERENCES public.flight_rosters(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unique_key TEXT NOT NULL,
  flight_number TEXT NOT NULL,
  crew_position TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_time TIMESTAMPTZ,
  arrival_time TIMESTAMPTZ,
  flight_duration_minutes INTEGER,
  equipment TEXT,
  service_type TEXT,
  meal_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.catering_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unique_key TEXT NOT NULL,
  flight_number TEXT NOT NULL,
  service_date DATE NOT NULL,
  origin_iata TEXT,
  destination_iata TEXT,
  service_type TEXT,
  meal_type TEXT,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS flight_leg_details_user_unique_key_idx
  ON public.flight_leg_details (user_id, unique_key);

CREATE INDEX IF NOT EXISTS flight_leg_details_user_departure_time_idx
  ON public.flight_leg_details (user_id, departure_time);

CREATE UNIQUE INDEX IF NOT EXISTS catering_rules_user_unique_key_idx
  ON public.catering_rules (user_id, unique_key);

CREATE INDEX IF NOT EXISTS catering_rules_user_service_date_idx
  ON public.catering_rules (user_id, service_date);

DO $$
BEGIN
  ALTER TABLE public.flight_rosters ENABLE ROW LEVEL SECURITY;

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
END $$;

DO $$
BEGIN
  ALTER TABLE public.flight_leg_details
    ADD COLUMN IF NOT EXISTS unique_key TEXT,
    ADD COLUMN IF NOT EXISTS flight_number TEXT,
    ADD COLUMN IF NOT EXISTS crew_position TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT,
    ADD COLUMN IF NOT EXISTS destination TEXT,
    ADD COLUMN IF NOT EXISTS departure_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS flight_duration_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS equipment TEXT,
    ADD COLUMN IF NOT EXISTS service_type TEXT,
    ADD COLUMN IF NOT EXISTS meal_type TEXT;

  ALTER TABLE public.flight_leg_details ENABLE ROW LEVEL SECURITY;

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
END $$;

DO $$
BEGIN
  ALTER TABLE public.catering_rules
    ADD COLUMN IF NOT EXISTS unique_key TEXT,
    ADD COLUMN IF NOT EXISTS flight_number TEXT,
    ADD COLUMN IF NOT EXISTS service_date DATE,
    ADD COLUMN IF NOT EXISTS origin_iata TEXT,
    ADD COLUMN IF NOT EXISTS destination_iata TEXT,
    ADD COLUMN IF NOT EXISTS service_type TEXT,
    ADD COLUMN IF NOT EXISTS meal_type TEXT,
    ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1;

  ALTER TABLE public.catering_rules ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Users can view own catering rules" ON public.catering_rules;
  CREATE POLICY "Users can view own catering rules"
    ON public.catering_rules FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can insert own catering rules" ON public.catering_rules;
  CREATE POLICY "Users can insert own catering rules"
    ON public.catering_rules FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can update own catering rules" ON public.catering_rules;
  CREATE POLICY "Users can update own catering rules"
    ON public.catering_rules FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
END $$;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own flight roster files" ON storage.objects;
    CREATE POLICY "Users can view own flight roster files"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'flight-rosters'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );

    DROP POLICY IF EXISTS "Users can upload own flight roster files" ON storage.objects;
    CREATE POLICY "Users can upload own flight roster files"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'flight-rosters'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );

    DROP POLICY IF EXISTS "Users can view own catering plan files" ON storage.objects;
    CREATE POLICY "Users can view own catering plan files"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'catering-plans'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );

    DROP POLICY IF EXISTS "Users can upload own catering plan files" ON storage.objects;
    CREATE POLICY "Users can upload own catering plan files"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'catering-plans'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
