import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { SectionId } from "./filing-sections";
import type { Financials } from "./metrics";
import type { Change } from "./redline";

const tickerSchema = z.string().trim().min(1).max(12);

export type Citation = {
  id: number;
  section: SectionId;
  accession: string;
  form: string;
  filing_date: string;
  url: string | null;
  text: string;
};

export type SignalView = {
  id: string;
  cik: number;
  ticker: string;
  accession: string;
  filed_date: string | null;
  category: string;
  title: string;
  what_happened: string;
  whats_new: string;
  why_it_matters: string;
  history: string;
  uncertain: string;
  confidence: string;
  metric_note: string | null;
  citations: Citation[];
};

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

function docUrl(cik: number, accession: string, doc: string | null) {
  return doc ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, "")}/${doc}` : null;
}

async function citationsFor(sb: Admin, ids: number[]): Promise<Map<number, Citation>> {
  const out = new Map<number, Citation>();
  if (!ids.length) return out;
  const { data: ps } = await sb.from("filing_passages").select("id,accession,cik,section,body").in("id", ids);
  const accs = [...new Set((ps ?? []).map((p) => p.accession))];
  const { data: fs } = accs.length
    ? await sb.from("filings").select("accession,form,filing_date,primary_document").in("accession", accs)
    : { data: [] };
  for (const p of ps ?? []) {
    const f = fs?.find((x) => x.accession === p.accession);
    out.set(p.id, {
      id: p.id,
      section: p.section as SectionId,
      accession: p.accession,
      form: f?.form ?? "",
      filing_date: f?.filing_date ?? "",
      url: docUrl(p.cik, p.accession, f?.primary_document ?? null),
      text: p.body,
    });
  }
  return out;
}

async function signalViews(sb: Admin, ciks: number[], tickers: Map<number, string>): Promise<SignalView[]> {
  if (!ciks.length) return [];
  const { data } = await sb.from("signals").select("*").in("cik", ciks).order("filed_date", { ascending: false }).limit(60);
  const cites = await citationsFor(sb, [...new Set((data ?? []).flatMap((s) => s.passage_ids))]);
  return (data ?? []).map((s) => ({
    id: s.id,
    cik: s.cik,
    ticker: tickers.get(s.cik) ?? "",
    accession: s.accession,
    filed_date: s.filed_date,
    category: s.category,
    title: s.title,
    what_happened: s.what_happened,
    whats_new: s.whats_new,
    why_it_matters: s.why_it_matters,
    history: s.history,
    uncertain: s.uncertain,
    confidence: s.confidence,
    metric_note: s.metric_note,
    citations: s.passage_ids.map((id) => cites.get(id)).filter((c): c is Citation => !!c),
  }));
}

async function resolve(ticker: string) {
  const { findTicker } = await import("./edgar.server");
  const { ensureCompany } = await import("./company.server");
  const match = await findTicker(ticker);
  if (!match) return null;
  await ensureCompany(match.cik, match.ticker, match.name);
  return match;
}

export type FilingMeta = { accession: string; form: string; filing_date: string; report_date: string | null; url: string | null };

export type ChangesResult =
  | { ok: true; current: FilingMeta; prior: FilingMeta; changes: Change[] }
  | { ok: false; error: string };

export const getChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticker: tickerSchema }).parse(d))
  .handler(async ({ data }): Promise<ChangesResult> => {
    try {
      const match = await resolve(data.ticker);
      if (!match) return { ok: false, error: "Unknown ticker." };
      const { listFilings, pickComparable, ensureRedline } = await import("./analysis.server");
      const pair = pickComparable(await listFilings(match.cik));
      if (!pair) return { ok: false, error: "There aren’t two comparable 10-K or 10-Q filings to compare yet." };
      const r = await ensureRedline(pair.cur, pair.prior);
      if (!r) return { ok: false, error: "The risk factor and MD&A sections couldn’t be read from these filings." };
      const meta = (f: typeof pair.cur): FilingMeta => ({
        accession: f.accession,
        form: f.form,
        filing_date: f.filing_date,
        report_date: f.report_date,
        url: docUrl(f.cik, f.accession, f.primary_document),
      });
      return { ok: true, current: meta(pair.cur), prior: meta(pair.prior), changes: r.changes };
    } catch (e) {
      console.error("getChanges failed", e);
      return { ok: false, error: "The SEC filing couldn’t be loaded. Please try again shortly." };
    }
  });

export type SignalsResult = { ok: true; signals: SignalView[]; analyzedAccession: string | null } | { ok: false; error: string };

/** Detects signals for the latest periodic filing once (shared), then returns all stored signals. */
export const getCompanySignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticker: tickerSchema }).parse(d))
  .handler(async ({ data }): Promise<SignalsResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const match = await resolve(data.ticker);
      if (!match) return { ok: false, error: "Unknown ticker." };
      const { ensureSignals } = await import("./analysis.server");
      const { data: f } = await supabaseAdmin.from("financial_facts").select("data").eq("cik", match.cik).maybeSingle();
      const r = await ensureSignals(match.cik, match.name, (f?.data as unknown as Financials) ?? null);
      const signals = await signalViews(supabaseAdmin, [match.cik], new Map([[match.cik, match.ticker]]));
      return { ok: true, signals, analyzedAccession: r.analyzed ? r.accession : null };
    } catch (e) {
      const { AiError } = await import("./ai.server");
      if (e instanceof AiError) return { ok: false, error: e.message };
      console.error("signals failed", e);
      return { ok: false, error: "Signal detection couldn’t finish. Please try again shortly." };
    }
  });

/** Stored signals for the signed-in user's holdings (no new analysis). */
export const getPortfolioSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: holdings } = await context.supabase.from("holdings").select("cik,ticker");
    const tickers = new Map((holdings ?? []).map((h) => [h.cik, h.ticker]));
    const ciks = [...tickers.keys()];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signals = await signalViews(supabaseAdmin, ciks, tickers);
    const { data: analyses } = ciks.length
      ? await supabaseAdmin.from("signal_analyses").select("cik").in("cik", ciks)
      : { data: [] };
    const analyzed = new Set((analyses ?? []).map((a) => a.cik));
    return {
      signals,
      pending: (holdings ?? []).filter((h) => !analyzed.has(h.cik)).map((h) => h.ticker),
    };
  });

const AnswerSchema = z.object({
  answer: z.string(),
  uncertain: z.string(),
  cited: z.array(z.string()),
  answerable: z.boolean(),
});

export type AnswerResult =
  | { ok: true; answer: string; uncertain: string; answerable: boolean; citations: (Citation & { ref: string })[] }
  | { ok: false; error: string };

export const askCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticker: tickerSchema, question: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data }): Promise<AnswerResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const match = await resolve(data.ticker);
      if (!match) return { ok: false, error: "Unknown ticker." };
      const { listFilings, ensureExtracted } = await import("./analysis.server");
      const filings = await listFilings(match.cik);
      // make sure the latest 10-K, latest 10-Q and recent 8-Ks are searchable
      const targets = [
        filings.find((f) => f.form === "10-K"),
        filings.find((f) => f.form === "10-Q"),
        ...filings.filter((f) => f.form === "8-K").slice(0, 3),
      ].filter((f): f is NonNullable<typeof f> => !!f);
      for (const f of targets) await ensureExtracted(f);

      const { data: hits, error } = await supabaseAdmin.rpc("search_passages", { _cik: match.cik, _q: data.question, _limit: 12 });
      if (error) throw error;
      const cites = await citationsFor(supabaseAdmin, (hits ?? []).map((h) => h.id));
      const list = (hits ?? []).map((h, i) => ({ ref: `S${i + 1}`, ...cites.get(h.id)! })).filter((c) => c.id);
      if (!list.length)
        return {
          ok: true,
          answer: `I couldn’t find passages in ${match.name}’s recent filings that address this question.`,
          uncertain: "The answer may be in parts of filings that aren’t indexed yet (only risk factors, MD&A, competition and 8-K items are read).",
          answerable: false,
          citations: [],
        };
      const { aiObject } = await import("./ai.server");
      const out = await aiObject(
        AnswerSchema,
        `You answer questions about a public company using ONLY the SEC filing excerpts provided.
- Cite every factual sentence with excerpt ids in square brackets, e.g. [S2]. Never cite ids that weren't provided.
- Quote figures exactly; never compute or invent numbers, and don't use outside knowledge.
- If the excerpts don't answer the question, say so plainly and set answerable to false.
- Never give buy, sell or hold advice, price targets or predictions.
- Keep the answer under 180 words, plain language. Plain text only: no markdown, no asterisks; use short lines starting with "• " for lists.
- uncertain: one sentence on what remains uncertain or isn't disclosed.
- cited: the excerpt ids you used.`,
        `Company: ${match.name} (${match.ticker})
Question: ${data.question}

Excerpts:
${list.map((c) => `[${c.ref}] ${c.form} filed ${c.filing_date}, section ${c.section}: ${c.text.slice(0, 1500)}`).join("\n\n")}`,
      );
      const used = new Set([...out.cited, ...(out.answer.match(/S\d+/g) ?? [])]);
      return {
        ok: true,
        answer: out.answer.replace(/\*\*/g, ""),
        uncertain: out.uncertain.replace(/\s*\[S\d+(?:,\s*S\d+)*\]/g, "").trim(),
        answerable: out.answerable,
        citations: list.filter((c) => used.has(c.ref)),
      };
    } catch (e) {
      const { AiError } = await import("./ai.server");
      if (e instanceof AiError) return { ok: false, error: e.message };
      console.error("askCompany failed", e);
      return { ok: false, error: "The answer couldn’t be prepared. Please try again." };
    }
  });
