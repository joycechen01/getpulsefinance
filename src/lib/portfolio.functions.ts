import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { Financials } from "./metrics";

const tickerSchema = z.string().trim().min(1).max(12);

export const DEMO_TICKERS = ["NVDA", "CRWD", "INTC", "TSLA"];

async function addOne(
  supabase: SupabaseClient<Database>,
  userId: string,
  ticker: string,
  extra: { shares?: number | null | undefined; avgPrice?: number | null | undefined } = {},
) {
  const { findTicker } = await import("./edgar.server");
  const { ensureCompany } = await import("./company.server");
  const match = await findTicker(ticker);
  if (!match) return { ok: false as const, ticker, error: `“${ticker.toUpperCase()}” isn’t an SEC-registered ticker.` };
  await ensureCompany(match.cik, match.ticker, match.name);
  const { error } = await supabase.from("holdings").upsert(
    {
      user_id: userId,
      ticker: match.ticker,
      cik: match.cik,
      company_name: match.name,
      shares: extra.shares ?? null,
      avg_price: extra.avgPrice ?? null,
    },
    { onConflict: "user_id,ticker" },
  );
  if (error) {
    console.error("holding insert failed", error);
    return { ok: false as const, ticker, error: "Couldn’t save this holding. Please try again." };
  }
  return { ok: true as const, ticker: match.ticker };
}

export const addHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ticker: tickerSchema,
        shares: z.number().positive().nullable().optional(),
        avgPrice: z.number().positive().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      return await addOne(context.supabase, context.userId, data.ticker, data);
    } catch (e) {
      console.error(e);
      return { ok: false as const, ticker: data.ticker, error: "The SEC data service didn’t respond. Try again shortly." };
    }
  });

export const loadDemoPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const results = [];
    for (const t of DEMO_TICKERS) {
      try {
        results.push(await addOne(context.supabase, context.userId, t));
      } catch (e) {
        console.error(e);
        results.push({ ok: false as const, ticker: t, error: "SEC data unavailable" });
      }
    }
    return results;
  });

export type CompanyBundle =
  | {
      ok: true;
      company: {
        cik: number;
        ticker: string;
        name: string;
        sic_description: string | null;
        exchanges: string[] | null;
        fiscal_year_end: string | null;
      };
      financials: Financials | null;
      filings: {
        accession: string;
        form: string;
        filing_date: string;
        report_date: string | null;
        primary_document: string | null;
        description: string | null;
        items: string | null;
      }[];
      held: boolean;
    }
  | { ok: false; error: string };

export const getCompany = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticker: tickerSchema }).parse(d))
  .handler(async ({ data, context }): Promise<CompanyBundle> => {
    const { findTicker } = await import("./edgar.server");
    const { ensureCompany } = await import("./company.server");
    try {
      const match = await findTicker(data.ticker);
      if (!match) return { ok: false, error: `No SEC-registered company found for “${data.ticker.toUpperCase()}”.` };
      await ensureCompany(match.cik, match.ticker, match.name);
      const sb = context.supabase;
      const [c, f, fl, h] = await Promise.all([
        sb.from("companies").select("cik,ticker,name,sic_description,exchanges,fiscal_year_end").eq("cik", match.cik).single(),
        sb.from("financial_facts").select("data").eq("cik", match.cik).maybeSingle(),
        sb
          .from("filings")
          .select("accession,form,filing_date,report_date,primary_document,description,items")
          .eq("cik", match.cik)
          .order("filing_date", { ascending: false })
          .limit(60),
        sb.from("holdings").select("id").eq("cik", match.cik).maybeSingle(),
      ]);
      if (c.error || !c.data) return { ok: false, error: "Company data isn’t available yet." };
      return {
        ok: true,
        company: c.data,
        financials: (f.data?.data as unknown as Financials) ?? null,
        filings: fl.data ?? [],
        held: !!h.data,
      };
    } catch (e) {
      console.error("getCompany failed", e);
      return { ok: false, error: "The SEC data service didn’t respond. Please try again shortly." };
    }
  });

export type PortfolioRow = {
  id: string;
  ticker: string;
  cik: number;
  name: string;
  shares: number | null;
  avgPrice: number | null;
  currency: string | null;
  financials: Financials | null;
  latestFiling: { form: string; filing_date: string; accession: string; primary_document: string | null } | null;
};

export const getPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: holdings, error } = await sb.from("holdings").select("*").order("created_at");
    if (error) throw new Error("Couldn’t load your portfolio.");
    const ciks = (holdings ?? []).map((h) => h.cik);
    if (!ciks.length) return { holdings: [] as PortfolioRow[], recentFilings: [] };
    const [facts, filings] = await Promise.all([
      sb.from("financial_facts").select("cik,currency,data").in("cik", ciks),
      sb
        .from("filings")
        .select("accession,cik,form,filing_date,primary_document,description")
        .in("cik", ciks)
        .order("filing_date", { ascending: false })
        .limit(80),
    ]);
    const rows: PortfolioRow[] = (holdings ?? []).map((h) => {
      const fx = facts.data?.find((x) => x.cik === h.cik);
      const lf = filings.data?.find((x) => x.cik === h.cik) ?? null;
      return {
        id: h.id,
        ticker: h.ticker,
        cik: h.cik,
        name: h.company_name,
        shares: h.shares,
        avgPrice: h.avg_price,
        currency: fx?.currency ?? null,
        financials: (fx?.data as unknown as Financials) ?? null,
        latestFiling: lf,
      };
    });
    const tickerOf = new Map(rows.map((r) => [r.cik, r.ticker]));
    return {
      holdings: rows,
      recentFilings: (filings.data ?? []).slice(0, 12).map((f) => ({ ...f, ticker: tickerOf.get(f.cik) ?? "" })),
    };
  });

export const updateHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        shares: z.number().positive().nullable(),
        avgPrice: z.number().positive().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("holdings")
      .update({ shares: data.shares, avg_price: data.avgPrice })
      .eq("id", data.id);
    if (error) throw new Error("Couldn’t update this holding.");
    return { ok: true };
  });

export const removeHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("holdings").delete().eq("id", data.id);
    if (error) throw new Error("Couldn’t remove this holding.");
    return { ok: true };
  });

export type Quote = { price: number; change: number; changePct: number; at: number };

const quoteCache = new Map<string, { at: number; q: Quote | null }>();

export const getQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tickers: z.array(tickerSchema).max(50) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["FINNHUB_API_KEY"];
    if (!key) return { available: false as const, quotes: {} as Record<string, Quote | null> };
    const quotes: Record<string, Quote | null> = {};
    for (const t of data.tickers) {
      const hit = quoteCache.get(t);
      if (hit && Date.now() - hit.at < 5 * 60 * 1000) {
        quotes[t] = hit.q;
        continue;
      }
      try {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(t.replace("-", "."))}&token=${key}`);
        if (!res.ok) {
          console.error(`Finnhub quote failed [${res.status}]: ${(await res.text()).slice(0, 200)}`);
          quotes[t] = null;
          continue;
        }
        const j = (await res.json()) as { c: number; d: number; dp: number; t: number };
        const q = j.c ? { price: j.c, change: j.d, changePct: j.dp, at: j.t * 1000 } : null;
        quoteCache.set(t, { at: Date.now(), q });
        quotes[t] = q;
      } catch (e) {
        console.error("Finnhub error", e);
        quotes[t] = null;
      }
    }
    return { available: true as const, quotes };
  });
