-- Social feed tables and photo storage.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_meal_plan_refreshed_at TIMESTAMPTZ;

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

DO $$
BEGIN
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
END $$;

DO $$
BEGIN
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
END $$;

DO $$
BEGIN
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
END $$;

DO $$
BEGIN
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
END $$;

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
