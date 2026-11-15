ALTER TABLE public.profiles ADD COLUMN digest_newsletter_enabled boolean NOT NULL DEFAULT false, ADD COLUMN digest_newsletter_since timestamptz;
CREATE FUNCTION public.stamp_digest_subscription() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
 IF NEW.digest_newsletter_enabled AND (TG_OP = 'INSERT' OR NOT OLD.digest_newsletter_enabled) THEN NEW.digest_newsletter_since := now();
 ELSIF NOT NEW.digest_newsletter_enabled THEN NEW.digest_newsletter_since := NULL;
 ELSE NEW.digest_newsletter_since := OLD.digest_newsletter_since; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER stamp_digest_subscription BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.stamp_digest_subscription();
CREATE TABLE public.earnings_digest_monitor (user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, cursor integer NOT NULL DEFAULT 0, lease_until timestamptz, lease_token uuid, paused_reason text, last_checked_at timestamptz);
GRANT SELECT ON public.earnings_digest_monitor TO authenticated;
GRANT ALL ON public.earnings_digest_monitor TO service_role;
ALTER TABLE public.earnings_digest_monitor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read earnings digest status" ON public.earnings_digest_monitor FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE FUNCTION public.claim_earnings_digest_check(_user_id uuid, _token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
 INSERT INTO public.earnings_digest_monitor(user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
 UPDATE public.earnings_digest_monitor SET lease_until = now() + interval '10 minutes', lease_token = _token WHERE user_id = _user_id AND paused_reason IS NULL AND (lease_until IS NULL OR lease_until < now());
 RETURN FOUND;
 END $$;
REVOKE ALL ON FUNCTION public.claim_earnings_digest_check(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_earnings_digest_check(uuid, uuid) TO service_role;