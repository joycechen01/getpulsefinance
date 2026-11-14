// Pure Phase 3 rules: evidence validation, conservative registrant matching and TTM comparisons.
import { z } from "zod";
import { growth, type Financials, type FinRow } from "./metrics";

export const COMPARISON_METRICS = [
  { id: "revenueYoY", label: "Revenue growth", term: "revenueGrowth" },
  { id: "grossMargin", label: "Gross margin", term: "grossMargin" },
  { id: "operatingMargin", label: "Operating margin", term: "operatingMargin" },
  { id: "rndPct", label: "R&D / revenue", term: "rndPct" },
  { id: "fcfMargin", label: "Free cash flow margin", term: "fcfMargin" },
] as const;
export type ComparisonMetric = (typeof COMPARISON_METRICS)[number]["id"];
export const MAX_COMPETITORS = 5;
export const comparisonInput = z.object({ ticker: z.string().trim().min(1).max(12), peers: z.array(z.string().trim().min(1).max(160)).max(5).optional() });

export const FilingResearchSchema = z.object({
  competitors: z.array(z.object({ name: z.string().min(1).max(160), passage_ids: z.array(z.number().int()), note: z.string().max(400).nullable() })).max(20),
  risks: z.array(z.object({ key: z.string().min(1).max(160), title: z.string().max(120), description: z.string().max(500), uncertain: z.string().max(300), passage_ids: z.array(z.number().int()) })).max(12),
});
export type FilingResearch = z.infer<typeof FilingResearchSchema>;
export type ResearchPassage = { id: number; section: string; body: string };

export function validateResearch(data: FilingResearch, passages: ResearchPassage[]): FilingResearch {
  const risks = new Set(passages.filter(p => p.section === "risk").map(p => p.id));
  return {
    competitors: data.competitors.flatMap(c => {
      const ids = c.passage_ids.filter(id => passages.some(p => p.id === id && ["competition", "risk"].includes(p.section) && p.body.toLowerCase().includes(c.name.toLowerCase())));
      return ids.length ? [{ ...c, passage_ids: [...new Set(ids)] }] : [];
    }),
    risks: data.risks.flatMap(r => {
      const ids = r.passage_ids.filter(id => risks.has(id));
      return ids.length ? [{ ...r, key: r.key.toLowerCase().trim(), passage_ids: [...new Set(ids)] }] : [];
    }),
  };
}

const normalize = (s: string) => s.toLowerCase().replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc)\b/g, "").replace(/[^a-z0-9]/g, "");
export function matchRegistrant<T extends { name: string; ticker: string; cik: number }>(name: string, list: T[]): T | null {
  const n = normalize(name);
  if (!n) return null;
  const matches = list.filter(c => normalize(c.name) === n || c.ticker.toLowerCase() === name.toLowerCase());
  const ciks = new Set(matches.map(c => c.cik));
  return ciks.size === 1 ? matches[0] ?? null : null;
}

const index = (r: FinRow) => r.fiscalYear * 4 + (r.quarter ?? 0);
function consecutive(rows: FinRow[]) {
  return rows.length === 4 && rows.every((r, i) => r.quarter != null && (!i || index(r) - index(rows[i - 1] ?? r) === 1));
}
function sum(rows: FinRow[], id: keyof FinRow["v"]) {
  return rows.every(r => r.v[id] != null) ? rows.reduce((total, r) => total + (r.v[id] ?? 0), 0) : null;
}
const ratio = (n: number | null, d: number | null) => n == null || d == null || d === 0 ? null : n / d;
export function comparisonTTM(fin: Financials | null) {
  const missing: Record<ComparisonMetric, number | null> = { revenueYoY: null, grossMargin: null, operatingMargin: null, rndPct: null, fcfMargin: null };
  if (!fin) return { end: null, start: null, revenue: null, values: missing };
  const rows = fin.quarterly.slice().sort((a,b) => index(a) - index(b));
  const window = rows.slice(-4);
  const last = window[3];
  if (!consecutive(window) || !last) return { end: null, start: null, revenue: null, values: missing };
  const revenue = sum(window, "revenue");
  const prior = window.map(r => rows.find(p => p.fiscalYear === r.fiscalYear - 1 && p.quarter === r.quarter)).filter((r): r is FinRow => !!r);
  const priorRevenue = consecutive(prior) ? sum(prior, "revenue") : null;
  const ocf = sum(window, "operatingCashFlow"), capex = sum(window, "capex");
  const endDate = new Date(`${last.end}T00:00:00Z`);
  endDate.setUTCFullYear(endDate.getUTCFullYear() - 1);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { start: endDate.toISOString().slice(0,10), end: last.end, revenue, values: {
    revenueYoY: growth(revenue, priorRevenue),
    grossMargin: ratio(sum(window,"grossProfit"), revenue),
    operatingMargin: ratio(sum(window,"operatingIncome"), revenue),
    rndPct: ratio(sum(window,"rnd"), revenue),
    fcfMargin: ratio(ocf == null || capex == null ? null : ocf - capex, revenue),
  } };
}

export function sharedRiskGroups<T extends { ticker: string; risks: FilingResearch["risks"] }>(companies: T[]) {
  const groups = new Map<string, { title: string; members: { ticker: string; risk: FilingResearch["risks"][number] }[] }>();
  for (const c of companies) for (const risk of c.risks) {
    const g = groups.get(risk.key) ?? { title: risk.title, members: [] };
    if (!g.members.some(m => m.ticker === c.ticker)) g.members.push({ ticker: c.ticker, risk });
    groups.set(risk.key, g);
  }
  return [...groups.entries()].filter(([,g]) => g.members.length >= 2).map(([key,g]) => ({ key, ...g }));
}
/** Calendar quarter label of a period end (fiscal calendars differ, so peers align on this). */
export function calendarQuarter(end: string) {
  const [y, m] = end.split("-").map(Number);
  return `${y} Q${Math.ceil((m ?? 1) / 3)}`;
}

/** Rolling four-quarter values for the last `quarters` quarterly period ends. Missing windows stay null. */
export function comparisonTrend(fin: Financials | null, quarters = 12) {
  if (!fin) return [];
  const rows = fin.quarterly.slice().sort((a, b) => index(a) - index(b));
  const out: { end: string; quarter: string; values: Record<ComparisonMetric, number | null> }[] = [];
  for (let k = Math.max(0, rows.length - quarters); k < rows.length; k++) {
    const row = rows[k];
    if (!row) continue;
    const t = comparisonTTM({ ...fin, quarterly: rows.slice(0, k + 1) });
    out.push({ end: row.end, quarter: calendarQuarter(row.end), values: t.values });
  }
  return out;
}

/** "Select all": filing order, capped at the comparison limit. */
export function selectAllPeers(names: string[], max = MAX_COMPETITORS) {
  return [...new Set(names)].slice(0, max);
}
