-- Automatic meal-plan ingestion from inbound email links.

CREATE TABLE IF NOT EXISTS public.meal_plan_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'email_link',
  email_from TEXT,
  email_to TEXT,
  last_email_subject TEXT,
  last_pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  last_error TEXT,
  rows_parsed INTEGER NOT NULL DEFAULT 0,
  flight_legs_updated INTEGER NOT NULL DEFAULT 0,
  last_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meal_plan_sources_user_processed_idx
  ON public.meal_plan_sources (user_id, last_processed_at DESC);

ALTER TABLE public.meal_plan_sources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own meal plan sources" ON public.meal_plan_sources;
  CREATE POLICY "Users can view own meal plan sources"
    ON public.meal_plan_sources FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
END $$;
