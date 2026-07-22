-- Associate each profile with an airline company and crew base.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company TEXT NOT NULL DEFAULT 'GOL',
  ADD COLUMN IF NOT EXISTS base TEXT NOT NULL DEFAULT 'SAO';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_company_check,
  ADD CONSTRAINT profiles_company_check
    CHECK (company IN ('LATAM', 'GOL', 'AZUL')),
  DROP CONSTRAINT IF EXISTS profiles_base_check,
  ADD CONSTRAINT profiles_base_check
    CHECK (base IN ('SAO', 'GIG', 'FOR', 'BSB', 'POA'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, username, company, base)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    public.normalize_username(NEW.raw_user_meta_data->>'username'),
    CASE
      WHEN NEW.raw_user_meta_data->>'company' IN ('LATAM', 'GOL', 'AZUL')
        THEN NEW.raw_user_meta_data->>'company'
      ELSE 'GOL'
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'base' IN ('SAO', 'GIG', 'FOR', 'BSB', 'POA')
        THEN NEW.raw_user_meta_data->>'base'
      ELSE 'SAO'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    username = COALESCE(EXCLUDED.username, profiles.username),
    company = EXCLUDED.company,
    base = EXCLUDED.base,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
