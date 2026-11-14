// Server-only: filing text extraction, redlines and signal detection, cached in shared tables.
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

import { aiObject } from "./ai.server";
import { getFilingHtml } from "./edgar.server";
import { extractSections, SECTION_LABEL, type SectionId } from "./filing-sections";
import { latestWithYoY, valueOf, type Financials } from "./metrics";
import { diffSection, type Change } from "./redline";

export type FilingRow = {
  accession: string;
  cik: number;
  form: string;
  filing_date: string;
  report_date: string | null;
  primary_document: string | null;
  items: string | null;
};

const FILING_COLS = "accession,cik,form,filing_date,report_date,primary_document,items";

export async function listFilings(cik: number): Promise<FilingRow[]> {
  const { data } = await supabaseAdmin
    .from("filings")
    .select(FILING_COLS)
    .eq("cik", cik)
    .order("filing_date", { ascending: false })
    .limit(300);
  return (data ?? []) as FilingRow[];
}

/** Latest 10-K/10-Q and the prior comparable filing (10-K vs prior 10-K; 10-Q vs the same quarter a year earlier). */
export function pickComparable(filings: FilingRow[]) {
  const periodic = filings.filter((f) => f.form === "10-K" || f.form === "10-Q");
  const cur = periodic[0];
  if (!cur) return null;
  const same = periodic.filter((f) => f.form === cur.form && f.accession !== cur.accession);
  let prior = same[0] ?? null;
  if (cur.form === "10-Q" && cur.report_date) {
    const target = Date.parse(cur.report_date) - 365 * 864e5;
    const yearAgo = same.find((f) => f.report_date && Math.abs(Date.parse(f.report_date) - target) < 40 * 864e5);
    if (yearAgo) prior = yearAgo;
  }
  return prior ? { cur, prior } : null;
}

export async function ensureExtracted(f: FilingRow): Promise<boolean> {
  const { data: done } = await supabaseAdmin.from("filing_extractions").select("status").eq("accession", f.accession).maybeSingle();
  if (done) return done.status === "ok";
  if (!f.primary_document) return false;
  let sections: Partial<Record<SectionId, string[]>> = {};
  try {
    const html = await getFilingHtml(f.cik, f.accession, f.primary_document);
    sections = extractSections(html, f.form);
  } catch (e) {
    console.error("filing fetch failed", f.accession, e);
    return false; // don't record, retry later
  }
  const rows = Object.entries(sections).flatMap(([section, list]) =>
    list!.map((body, pos) => ({ accession: f.accession, cik: f.cik, section, pos, body })),
  );
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabaseAdmin.from("filing_passages").upsert(rows.slice(i, i + 200), { onConflict: "accession,section,pos" });
    if (error) {
      console.error("passage insert failed", error);
      return false;
    }
  }
  const counts = Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v!.length]));
  await supabaseAdmin.from("filing_extractions").upsert({
    accession: f.accession,
    cik: f.cik,
    status: rows.length ? "ok" : "empty",
    section_counts: counts as Json,
  });
  return rows.length > 0;
}

export async function passagesFor(accession: string) {
  const { data } = await supabaseAdmin
    .from("filing_passages")
    .select("id,section,pos,body")
    .eq("accession", accession)
    .order("section")
    .order("pos")
    .limit(5000);
  return data ?? [];
}

export type Redline = { accession: string; prior_accession: string; changes: Change[] };

export async function ensureRedline(cur: FilingRow, prior: FilingRow): Promise<Redline | null> {
  const { data: have } = await supabaseAdmin.from("redlines").select("accession,prior_accession,changes").eq("accession", cur.accession).maybeSingle();
  if (have && have.prior_accession === prior.accession) return have as unknown as Redline;
  const [a, b] = [await ensureExtracted(cur), await ensureExtracted(prior)];
  if (!a || !b) return null;
  const [cp, pp] = await Promise.all([passagesFor(cur.accession), passagesFor(prior.accession)]);
  const changes: Change[] = [];
  for (const section of ["risk", "mdna", "competition"] as SectionId[]) {
    const c = cp.filter((p) => p.section === section).map((p) => p.body);
    const p = pp.filter((x) => x.section === section).map((x) => x.body);
    if (!c.length || !p.length) continue;
    changes.push(...diffSection(section, p, c));
  }
  const row = { accession: cur.accession, prior_accession: prior.accession, cik: cur.cik, changes: changes as unknown as Json };
  await supabaseAdmin.from("redlines").upsert(row);
  return { accession: cur.accession, prior_accession: prior.accession, changes };
}

const WATCH_8K = /\b(1\.03|1\.05|2\.05|2\.06|3\.01|4\.01|4\.02|5\.02)\b/;

function metricContext(fin: Financials | null): string {
  if (!fin) return "No structured financial data.";
  const rows = fin.quarterly;
  const lines: string[] = [];
  const add = (label: string, id: Parameters<typeof valueOf>[1], pct = false) => {
    const l = latestWithYoY(rows, id);
    if (!l) return;
    const f = (v: number | null) => (v == null ? "n/a" : pct ? `${(v * 100).toFixed(1)}%` : `${(v / 1e6).toFixed(0)}M`);
    lines.push(`${label}: ${f(l.value)} in ${l.row.label} vs ${f(l.prior)} a year earlier`);
  };
  add("Revenue", "revenue");
  add("Gross margin", "grossMargin", true);
  add("Operating margin", "operatingMargin", true);
  add("Operating cash flow", "operatingCashFlow");
  add("Inventory", "inventory");
  add("Net cash (cash minus debt)", "netCash");
  return lines.join("\n") || "No structured financial data.";
}

const SignalSchema = z.object({
  signals: z.array(
    z.object({
      category: z.enum(["Financial deterioration", "Business model change", "Operational risk", "Governance", "Legal and regulatory"]),
      title: z.string(),
      what_happened: z.string(),
      whats_new: z.string(),
      why_it_matters: z.string(),
      history: z.string(),
      uncertain: z.string(),
      confidence: z.enum(["High", "Medium", "Low"]),
      passage_refs: z.array(z.string()),
      metric_note: z.string().nullable(),
    }),
  ),
});

const SIGNAL_INSTRUCTIONS = `You are a careful equity research analyst reading SEC filings for an individual investor.
Identify only developments that could materially affect the business, in these categories: Financial deterioration (margins, operating cash flow, debt or liquidity pressure, impairments, restructuring), Business model change (revenue concentration, retention, pricing or demand shifts, segment mix), Operational risk (supplier dependencies, production disruptions, workforce reductions, material incidents), Governance (CEO/CFO departures, auditor changes), Legal and regulatory (material litigation, investigations, changed legal exposure).
Rules:
- Use only the passages and metrics provided. Never invent figures, names or dates. Quote numbers exactly as given.
- Do not flag routine or boilerplate language, and do not treat every negative disclosure as a warning. Returning zero signals is fine.
- Never give buy, sell or hold advice or price targets.
- Cite each signal with the passage ids it relies on (e.g. "P3"); every signal needs at least one.
- what_happened: 1-2 sentences. whats_new: how this differs from prior disclosures (use the change tags). why_it_matters: 1-2 sentences on business impact. history: prior context from the passages or metrics, or "No earlier disclosure in the filings reviewed." uncertain: one sentence on what remains unknown.
- confidence: High when the filing states it directly, Medium when it is implied by changed language, Low when it is inferred.
- metric_note: if a provided metric supports or contradicts the signal, state it in one sentence with the exact numbers; otherwise null.
- At most 6 signals, most material first.`;

export async function ensureSignals(cik: number, companyName: string, fin: Financials | null) {
  const filings = await listFilings(cik);
  const pair = pickComparable(filings);
  const cur = pair?.cur ?? filings.find((f) => f.form === "10-K" || f.form === "10-Q");
  if (!cur) return { analyzed: false as const, reason: "No 10-K or 10-Q on file." };
  const { data: done } = await supabaseAdmin.from("signal_analyses").select("accession").eq("accession", cur.accession).maybeSingle();
  if (done) return { analyzed: true as const, accession: cur.accession };

  const redline = pair ? await ensureRedline(pair.cur, pair.prior) : null;
  if (!redline) await ensureExtracted(cur);
  const curPassages = await passagesFor(cur.accession);

  const refs: { ref: string; id: number; text: string }[] = [];
  const addRef = (id: number, text: string, label: string) => {
    const ref = `P${refs.length + 1}`;
    refs.push({ ref, id, text: `[${ref}] (${label}) ${text.slice(0, 1400)}` });
  };
  const byPos = new Map(curPassages.map((p) => [`${p.section}:${p.pos}`, p]));
  const material = (redline?.changes ?? [])
    .filter((c) => c.tag !== "reworded")
    .sort((a, b) => (b.text ?? b.priorText ?? "").length - (a.text ?? a.priorText ?? "").length)
    .slice(0, 30);
  for (const c of material) {
    const p = c.pos != null ? byPos.get(`${c.section}:${c.pos}`) : undefined;
    if (p) addRef(p.id, c.tag === "expanded" ? `${p.body}\n  ADDED: ${c.added.join(" ")}` : p.body, `${c.tag.toUpperCase()} in ${SECTION_LABEL[c.section as SectionId]}`);
  }
  // removed passages cite the prior filing
  if (redline) {
    const prior = await passagesFor(redline.prior_accession);
    const pmap = new Map(prior.map((p) => [`${p.section}:${p.pos}`, p]));
    for (const c of material.filter((x) => x.tag === "removed")) {
      const p = pmap.get(`${c.section}:${c.priorPos}`);
      if (p) addRef(p.id, p.body, `REMOVED from ${SECTION_LABEL[c.section as SectionId]} (prior filing)`);
    }
  }
  if (!redline) for (const p of curPassages.filter((x) => x.section === "risk").slice(0, 12)) addRef(p.id, p.body, SECTION_LABEL.risk);

  const since = Date.now() - 180 * 864e5;
  const eightKs = filings.filter((f) => f.form === "8-K" && Date.parse(f.filing_date) > since && WATCH_8K.test(f.items ?? "")).slice(0, 4);
  for (const k of eightKs) {
    await ensureExtracted(k);
    for (const p of (await passagesFor(k.accession)).slice(0, 4)) addRef(p.id, p.body, `8-K filed ${k.filing_date}, items ${k.items}`);
  }

  const prompt = `Company: ${companyName}
Latest filing: ${cur.form} filed ${cur.filing_date} (period ${cur.report_date ?? "n/a"})${pair ? `, compared with ${pair.prior.form} filed ${pair.prior.filing_date}` : ""}.

Key metrics from XBRL data (computed in code):
${metricContext(fin)}

Passages:
${refs.map((r) => r.text).join("\n\n") || "(no passages extracted)"}`;

  const out = refs.length ? await aiObject(SignalSchema, SIGNAL_INSTRUCTIONS, prompt) : { signals: [] };
  const refMap = new Map(refs.map((r) => [r.ref, r.id]));
  const rows = out.signals
    .slice(0, 6)
    .map((s) => ({
      cik,
      accession: cur.accession,
      filed_date: cur.filing_date,
      category: s.category,
      title: s.title,
      what_happened: s.what_happened,
      whats_new: s.whats_new,
      why_it_matters: s.why_it_matters,
      history: s.history,
      uncertain: s.uncertain,
      confidence: s.confidence,
      metric_note: s.metric_note,
      passage_ids: s.passage_refs.map((r) => refMap.get(r.replace(/[[\]\s]/g, ""))).filter((x): x is number => x != null),
    }))
    .filter((r) => r.passage_ids.length > 0);
  if (rows.length) await supabaseAdmin.from("signals").insert(rows);
  await supabaseAdmin.from("signal_analyses").upsert({ accession: cur.accession, cik, signal_count: rows.length });
  return { analyzed: true as const, accession: cur.accession };
}
