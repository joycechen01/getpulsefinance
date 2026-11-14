CREATE TABLE public.filing_research (
 accession text PRIMARY KEY REFERENCES public.filings(accession) ON DELETE CASCADE,
 cik bigint NOT NULL,
 data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.filing_research TO authenticated;
GRANT ALL ON public.filing_research TO service_role;
ALTER TABLE public.filing_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read filing research" ON public.filing_research FOR SELECT TO authenticated USING (true);
CREATE INDEX filing_research_cik_idx ON public.filing_research(cik);