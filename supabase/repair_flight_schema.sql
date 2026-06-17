-- Repair script for the Flight Menu feature.
-- Run this in Supabase Dashboard -> SQL Editor for the remote project.

-- Email confirmation is disabled in supabase/config.toml. Hosted Supabase projects
-- also need Authentication -> Providers -> Email -> Confirm email turned off.
-- This marks existing email users confirmed so they can sign in without email approval.
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email IS NOT NULL
  AND email_confirmed_at IS NULL;

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
  crew_position TEXT,
  origin TEXT,
  destination TEXT,
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
  unique_key TEXT,
  flight_number TEXT,
  service_date DATE,
  origin_iata TEXT,
  destination_iata TEXT,
  service_type TEXT,
  meal_type TEXT,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  ADD COLUMN IF NOT EXISTS crew_position TEXT,
  ADD COLUMN IF NOT EXISTS origin TEXT,
  ADD COLUMN IF NOT EXISTS destination TEXT,
  ADD COLUMN IF NOT EXISTS departure_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flight_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS equipment TEXT,
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS meal_type TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.catering_rules
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS unique_key TEXT,
  ADD COLUMN IF NOT EXISTS flight_number TEXT,
  ADD COLUMN IF NOT EXISTS service_date DATE,
  ADD COLUMN IF NOT EXISTS origin_iata TEXT,
  ADD COLUMN IF NOT EXISTS destination_iata TEXT,
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS meal_type TEXT,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS last_meal_plan_refreshed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.normalize_username(input TEXT)
RETURNS TEXT AS $$
  SELECT NULLIF(regexp_replace(lower(trim(input)), '[^a-z0-9_]', '', 'g'), '');
$$ LANGUAGE sql IMMUTABLE;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_username_available(candidate TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := public.normalize_username(candidate);

  IF normalized IS NULL OR length(normalized) < 3 OR length(normalized) > 24 THEN
    RETURN FALSE;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(username) = normalized
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_email_by_username(candidate TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
  matched_email TEXT;
BEGIN
  normalized := public.normalize_username(candidate);

  IF normalized IS NULL OR length(normalized) < 3 OR length(normalized) > 24 THEN
    RETURN NULL;
  END IF;

  SELECT email
    INTO matched_email
  FROM public.profiles
  WHERE lower(username) = normalized
  LIMIT 1;

  RETURN matched_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    public.normalize_username(NEW.raw_user_meta_data->>'username')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    username = COALESCE(EXCLUDED.username, profiles.username),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

ALTER TABLE public.telegram_link_tokens
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS token TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS flight_leg_details_user_unique_key_idx
  ON public.flight_leg_details (user_id, unique_key)
  WHERE unique_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS flight_leg_details_user_departure_time_idx
  ON public.flight_leg_details (user_id, departure_time);

CREATE INDEX IF NOT EXISTS flight_leg_details_user_equipment_idx
  ON public.flight_leg_details (user_id, equipment);

UPDATE public.flight_leg_details
SET flight_duration_minutes = GREATEST(
  0,
  ROUND(EXTRACT(EPOCH FROM (arrival_time - departure_time)) / 60)::INTEGER
)
WHERE flight_duration_minutes IS NULL
  AND departure_time IS NOT NULL
  AND arrival_time IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS catering_rules_user_unique_key_idx
  ON public.catering_rules (user_id, unique_key)
  WHERE unique_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS catering_rules_user_service_date_idx
  ON public.catering_rules (user_id, service_date);

CREATE UNIQUE INDEX IF NOT EXISTS telegram_link_tokens_token_idx
  ON public.telegram_link_tokens (token)
  WHERE token IS NOT NULL;

CREATE INDEX IF NOT EXISTS telegram_link_tokens_user_created_at_idx
  ON public.telegram_link_tokens (user_id, created_at DESC);

ALTER TABLE public.flight_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_leg_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catering_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Users can delete own flight legs" ON public.flight_leg_details;
CREATE POLICY "Users can delete own flight legs"
  ON public.flight_leg_details FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

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

DROP POLICY IF EXISTS "Users can view own telegram link tokens" ON public.telegram_link_tokens;
CREATE POLICY "Users can view own telegram link tokens"
  ON public.telegram_link_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'flight-rosters',
  'flight-rosters',
  false,
  52428800,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catering-plans',
  'catering-plans',
  false,
  52428800,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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

CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Tripulante',
  author_avatar_url TEXT,
  caption TEXT,
  location TEXT NOT NULL,
  brazilian_state TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_posts_brazilian_state_check CHECK (
    brazilian_state IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
  ),
  CONSTRAINT social_posts_tag_check CHECK (
    tag IN ('Comida','Fitness','Turismo','Saúde','Compras')
  )
);

CREATE TABLE IF NOT EXISTS public.social_post_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.social_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.social_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Tripulante',
  author_avatar_url TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_posts_created_at_idx
  ON public.social_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS social_posts_state_tag_idx
  ON public.social_posts (brazilian_state, tag, created_at DESC);

CREATE INDEX IF NOT EXISTS social_post_photos_post_id_idx
  ON public.social_post_photos (post_id, sort_order);

CREATE INDEX IF NOT EXISTS social_post_likes_post_id_idx
  ON public.social_post_likes (post_id);

CREATE INDEX IF NOT EXISTS social_post_comments_post_id_idx
  ON public.social_post_comments (post_id, created_at);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view social posts" ON public.social_posts;
CREATE POLICY "Authenticated users can view social posts"
  ON public.social_posts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own social posts" ON public.social_posts;
CREATE POLICY "Users can insert own social posts"
  ON public.social_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own social posts" ON public.social_posts;
CREATE POLICY "Users can update own social posts"
  ON public.social_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own social posts" ON public.social_posts;
CREATE POLICY "Users can delete own social posts"
  ON public.social_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view social photos" ON public.social_post_photos;
CREATE POLICY "Authenticated users can view social photos"
  ON public.social_post_photos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert photos for own social posts" ON public.social_post_photos;
CREATE POLICY "Users can insert photos for own social posts"
  ON public.social_post_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.social_posts
      WHERE social_posts.id = social_post_photos.post_id
        AND social_posts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view social likes" ON public.social_post_likes;
CREATE POLICY "Authenticated users can view social likes"
  ON public.social_post_likes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can like as themselves" ON public.social_post_likes;
CREATE POLICY "Users can like as themselves"
  ON public.social_post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own social likes" ON public.social_post_likes;
CREATE POLICY "Users can remove own social likes"
  ON public.social_post_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view social comments" ON public.social_post_comments;
CREATE POLICY "Authenticated users can view social comments"
  ON public.social_post_comments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can comment as themselves" ON public.social_post_comments;
CREATE POLICY "Users can comment as themselves"
  ON public.social_post_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own social comments" ON public.social_post_comments;
CREATE POLICY "Users can delete own social comments"
  ON public.social_post_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-posts',
  'social-posts',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can view social post photos" ON storage.objects;
    CREATE POLICY "Authenticated users can view social post photos"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'social-posts');

    DROP POLICY IF EXISTS "Users can upload own social post photos" ON storage.objects;
    CREATE POLICY "Users can upload own social post photos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'social-posts'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );

    DROP POLICY IF EXISTS "Users can delete own social post photos" ON storage.objects;
    CREATE POLICY "Users can delete own social post photos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'social-posts'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- Ask Supabase/PostgREST to refresh its schema cache immediately.
NOTIFY pgrst, 'reload schema';
