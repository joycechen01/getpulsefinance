import { formatMoney, formatPct, formatPts, formatRatio, formatShares } from "./format";
import type { GlossaryKey } from "./glossary";
import { CALCULATED, type CalcId } from "./metrics";

export type MetricFmt = "money" | "ratio" | "shares" | "eps";

export type MetricSpec = { id: CalcId; label: string; term: GlossaryKey; fmt: MetricFmt };

export const HEADLINE: MetricSpec[] = [
  { id: "revenue", label: "Revenue", term: "revenue", fmt: "money" },
  { id: "grossMargin", label: "Gross margin", term: "grossMargin", fmt: "ratio" },
  { id: "operatingMargin", label: "Operating margin", term: "operatingMargin", fmt: "ratio" },
  { id: "netIncome", label: "Net income", term: "netIncome", fmt: "money" },
  { id: "operatingCashFlow", label: "Operating cash flow", term: "operatingCashFlow", fmt: "money" },
  { id: "netCash", label: "Cash vs. debt", term: "netCash", fmt: "money" },
];

export const GROUPS: { title: string; metrics: MetricSpec[] }[] = [
  {
    title: "Growth",
    metrics: [
      { id: "revenueYoY", label: "Revenue growth (year over year)", term: "revenueGrowth", fmt: "ratio" },
      { id: "revenueQoQ", label: "Revenue growth (quarter over quarter)", term: "revenueGrowth", fmt: "ratio" },
    ],
  },
  {
    title: "Profitability",
    metrics: [
      { id: "rndPct", label: "R&D as a share of revenue", term: "rndPct", fmt: "ratio" },
      { id: "sgaPct", label: "SG&A as a share of revenue", term: "sgaPct", fmt: "ratio" },
      { id: "epsDiluted", label: "Diluted EPS", term: "epsDiluted", fmt: "eps" },
    ],
  },
  {
    title: "Cash",
    metrics: [
      { id: "capex", label: "Capital expenditure", term: "capex", fmt: "money" },
      { id: "freeCashFlow", label: "Free cash flow", term: "freeCashFlow", fmt: "money" },
      { id: "fcfMargin", label: "Free cash flow margin", term: "fcfMargin", fmt: "ratio" },
    ],
  },
  {
    title: "Quality of earnings",
    metrics: [
      { id: "sbcPct", label: "Stock-based compensation as a share of revenue", term: "sbcPct", fmt: "ratio" },
      { id: "netIncome", label: "Net income", term: "netIncomeVsOcf", fmt: "money" },
      { id: "operatingCashFlow", label: "Operating cash flow", term: "netIncomeVsOcf", fmt: "money" },
    ],
  },
  {
    title: "Balance sheet",
    metrics: [
      { id: "inventory", label: "Inventory", term: "inventory", fmt: "money" },
      { id: "receivables", label: "Receivables", term: "receivables", fmt: "money" },
      { id: "deferredRevenue", label: "Deferred revenue", term: "deferredRevenue", fmt: "money" },
      { id: "totalDebt", label: "Total debt", term: "totalDebt", fmt: "money" },
      { id: "cashTotal", label: "Cash and short-term investments", term: "cash", fmt: "money" },
      { id: "netCash", label: "Net cash", term: "netCash", fmt: "money" },
    ],
  },
  {
    title: "Per share",
    metrics: [{ id: "dilutedShares", label: "Diluted share count", term: "dilutedShares", fmt: "shares" }],
  },
];

export const isCalculated = (id: CalcId) => CALCULATED.has(id);

export function fmtValue(v: number | null | undefined, fmt: MetricFmt, currency: string, digits = 2) {
  if (v == null) return "Not reported";
  switch (fmt) {
    case "money":
      return formatMoney(v, currency, digits);
    case "ratio":
      return formatRatio(v);
    case "shares":
      return formatShares(v);
    case "eps":
      return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
  }
}

/** Change vs. a prior value: percentage points for ratios, percent change otherwise. */
export function fmtChange(cur: number | null, prior: number | null | undefined, fmt: MetricFmt) {
  if (cur == null || prior == null) return null;
  if (fmt === "ratio") return formatPts(cur - prior);
  if (prior === 0) return null;
  return formatPct((cur - prior) / Math.abs(prior));
}
