import { describe, expect, it } from "vitest";

import { fiscalPeriodOf, parseCompanyFacts, type CompanyFactsJson, type Fact } from "./edgar-parse";

const f = (p: Partial<Fact> & { end: string; val: number }): Fact => ({
  form: "10-Q",
  filed: "2025-01-01",
  fp: "Q1",
  ...p,
});

function company(revenue: Fact[], assets: Fact[] = []): CompanyFactsJson {
  return {
    cik: 1,
    entityName: "Test Co",
    facts: {
      "us-gaap": {
        Revenues: { units: { USD: revenue } },
        Assets: { units: { USD: assets } },
      },
    },
  };
}

const fy2024 = [
  f({ start: "2024-01-01", end: "2024-03-31", val: 10 }),
  f({ start: "2024-04-01", end: "2024-06-30", val: 20 }),
  f({ start: "2024-07-01", end: "2024-09-30", val: 30 }),
  f({ start: "2024-01-01", end: "2024-12-31", val: 100, form: "10-K", fp: "FY", filed: "2025-02-01" }),
];

describe("SEC company facts parsing", () => {
  it("derives Q4 as the full year minus Q1–Q3", () => {
    const p = parseCompanyFacts(company(fy2024));
    const q4 = p.quarterly.find((r) => r.fiscalYear === 2024 && r.quarter === 4)!;
    expect(q4.revenue).toBe(40);
    expect(q4.revenueDerived).toBe(true);
  });

  it("uses the latest-filed value when a period is restated", () => {
    const p = parseCompanyFacts(
      company([...fy2024, f({ start: "2024-01-01", end: "2024-03-31", val: 12, filed: "2025-05-01" })]),
    );
    expect(p.quarterly.find((r) => r.quarter === 1)!.revenue).toBe(12);
  });

  it("ignores trailing-twelve-month totals found in quarterly reports", () => {
    const p = parseCompanyFacts(
      company([...fy2024, f({ start: "2024-07-01", end: "2025-06-30", val: 999, form: "10-Q" })]),
    );
    expect(p.annual.map((r) => r.revenue)).toEqual([100]);
    expect(p.fiscalYearEndMonth).toBe(12);
  });

  it("uses the fiscal-year-end balance for annual assets", () => {
    const p = parseCompanyFacts(
      company(fy2024, [
        f({ end: "2024-09-30", val: 500 }),
        f({ end: "2024-12-31", val: 700, form: "10-K", fp: "FY" }),
      ]),
    );
    expect(p.annual[0]?.assets).toBe(700);
  });

  it("labels a September fiscal year's December quarter as Q1 of the next fiscal year", () => {
    expect(fiscalPeriodOf("2025-12-27", 9)).toEqual({ fiscalYear: 2026, quarter: 1 });
    // 52/53-week year ending in the first days of October still counts as September.
    expect(fiscalPeriodOf("2023-10-01", 9)).toEqual({ fiscalYear: 2023, quarter: 4 });
  });

  it("computes year-over-year growth against the same quarter last year", () => {
    const next = fy2024.map((x) => ({
      ...x,
      start: x.start!.replace("2024", "2025"),
      end: x.end.replace("2024", "2025"),
      val: x.val * 2,
      filed: "2026-02-01",
    }));
    const p = parseCompanyFacts(company([...fy2024, ...next]));
    const q1 = p.quarterly.find((r) => r.fiscalYear === 2025 && r.quarter === 1)!;
    expect(q1.revenueYoY).toBe(1);
  });
});
