DROP POLICY IF EXISTS "Signed-in users read filing research" ON public.filing_research;
REVOKE ALL PRIVILEGES ON TABLE public.filing_research FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.filing_research TO service_role;
ALTER TABLE public.filing_research ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.filing_research IS 'Server-only shared SEC research cache. Access through authenticated research server functions; no direct anon or authenticated Data API access.';