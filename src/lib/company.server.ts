// Server-only: fetch a company's SEC data once and cache it in the database (refreshed daily).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

import { getCompanyFactsJson, getSubmissions } from "./edgar.server";
import { buildFinancials } from "./metrics";

const DAY = 24 * 60 * 60 * 1000;
const FORMS = /^(10-K|10-Q|8-K)(\/A)?$/;

export async function ensureCompany(cik: number, ticker: string, name: string, force = false) {
  const { data: existing } = await supabaseAdmin.from("companies").select("*").eq("cik", cik).maybeSingle();
  const stale = (t?: string | null) => force || !t || Date.now() - Date.parse(t) > DAY;

  if (!existing || stale(existing.submissions_fetched_at)) {
    const sub = await getSubmissions(cik);
    const now = new Date().toISOString();
    await supabaseAdmin.from("companies").upsert({
      cik,
      ticker,
      name: sub?.name ?? name,
      sic_description: sub?.sicDescription ?? null,
      exchanges: sub?.exchanges ?? null,
      fiscal_year_end: sub?.fiscalYearEnd ?? null,
      submissions_fetched_at: now,
      facts_fetched_at: existing?.facts_fetched_at ?? null,
    });
    const r = sub?.filings.recent;
    if (r) {
      const rows = r.accessionNumber
        .map((acc, i) => ({
          accession: acc,
          cik,
          form: r.form[i] ?? "",
          filing_date: r.filingDate[i] ?? "",
          report_date: r.reportDate[i] || null,
          primary_document: r.primaryDocument[i] || null,
          description: r.primaryDocDescription[i] || null,
          items: r.items[i] || null,
        }))
        .filter((x) => FORMS.test(x.form) && x.filing_date)
        .slice(0, 300);
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabaseAdmin.from("filings").upsert(rows.slice(i, i + 100));
        if (error) console.error("filings upsert failed", error);
      }
    }
  }

  if (!existing || stale(existing.facts_fetched_at)) {
    const json = await getCompanyFactsJson(cik);
    if (json) {
      const fin = buildFinancials(json);
      const { error } = await supabaseAdmin.from("financial_facts").upsert({
        cik,
        currency: fin.currency,
        fiscal_year_end_month: fin.fyEndMonth,
        data: fin as unknown as Json,
        fetched_at: new Date().toISOString(),
      });
      if (error) console.error("facts upsert failed", error);
    }
    await supabaseAdmin.from("companies").update({ facts_fetched_at: new Date().toISOString() }).eq("cik", cik);
  }
}
