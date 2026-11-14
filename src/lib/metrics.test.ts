import { describe, expect, it } from "vitest";

import type { CompanyFactsJson, Fact } from "./edgar-parse";
import { buildFinancials, latestWithYoY, ttm, valueOf } from "./metrics";

const f = (p: Partial<Fact> & { end: string; val: number }): Fact => ({ form: "10-Q", filed: "2025-01-01", fp: "Q1", ...p });

function co(concepts: Record<string, Fact[]>): CompanyFactsJson {
  const gaap: CompanyFactsJson["facts"][string] = {};
  for (const [k, v] of Object.entries(concepts)) gaap[k] = { units: { USD: v } };
  return { cik: 1, entityName: "T", facts: { "us-gaap": gaap } };
}

const revenue = [
  f({ start: "2024-01-01", end: "2024-03-31", val: 100 }),
  f({ start: "2024-04-01", end: "2024-06-30", val: 100 }),
  f({ start: "2024-07-01", end: "2024-09-30", val: 100 }),
  f({ start: "2024-01-01", end: "2024-12-31", val: 400, form: "10-K", fp: "FY", filed: "2025-02-01" }),
];

describe("Pulse Finance metric rules", () => {
  it("converts year-to-date cash flow into single quarters", () => {
    const ocf = [
      f({ start: "2024-01-01", end: "2024-03-31", val: 10 }),
      f({ start: "2024-01-01", end: "2024-06-30", val: 25 }),
      f({ start: "2024-01-01", end: "2024-09-30", val: 45 }),
      f({ start: "2024-01-01", end: "2024-12-31", val: 70, form: "10-K", fp: "FY" }),
    ];
    const fin = buildFinancials(co({ Revenues: revenue, NetCashProvidedByUsedInOperatingActivities: ocf }));
    expect(fin.quarterly.map((r) => r.v.operatingCashFlow)).toEqual([10, 15, 20, 25]);
    expect(fin.quarterly[1]?.derived).toContain("operatingCashFlow");
  });

  it("derives Q4 revenue as full year minus the first three quarters", () => {
    const fin = buildFinancials(co({ Revenues: revenue }));
    expect(fin.quarterly[3]?.v.revenue).toBe(100);
  });

  it("calculates gross profit as revenue minus cost of revenue when not reported", () => {
    const cost = revenue.map((x) => ({ ...x, val: x.val * 0.4 }));
    const fin = buildFinancials(co({ Revenues: revenue, CostOfRevenue: cost }));
    const q1 = fin.quarterly[0]!;
    expect(q1.v.grossProfit).toBe(60);
    expect(q1.calculated).toContain("grossProfit");
    expect(valueOf(fin.quarterly, q1, "grossMargin")).toBeCloseTo(0.6);
  });

  it("leaves a metric absent (Not reported) instead of zero when no tag matches", () => {
    const fin = buildFinancials(co({ Revenues: revenue }));
    expect(fin.quarterly[0]?.v.inventory).toBeUndefined();
    expect(latestWithYoY(fin.quarterly, "inventory")).toBeNull();
  });

  it("falls back to the next tag in the list", () => {
    const fin = buildFinancials(co({ SalesRevenueNet: revenue }));
    expect(fin.annual[0]?.v.revenue).toBe(400);
  });

  it("sums the last four consecutive quarters for trailing twelve months", () => {
    const fin = buildFinancials(co({ Revenues: revenue }));
    expect(ttm(fin.quarterly, "revenue")?.value).toBe(400);
  });
});
