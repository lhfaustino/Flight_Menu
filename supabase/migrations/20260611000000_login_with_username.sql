-- Allow the login form to resolve a username to the user's auth email.

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
