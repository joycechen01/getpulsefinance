// Pure parsing of SEC "company facts" JSON into fiscal-period rows. No I/O here so it is unit-testable.

export type Fact = {
  start?: string;
  end: string;
  val: number;
  accn?: string;
  fy?: number | null;
  fp?: string | null;
  form: string;
  filed: string;
  frame?: string;
};

type Concept = { label?: string | null; units: Record<string, Fact[]> };

export type CompanyFactsJson = {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, Concept>>;
};

export type MetricKey = "revenue" | "netIncome" | "assets";

export type PeriodRow = {
  key: string;
  label: string;
  fiscalYear: number;
  quarter: number | null;
  end: string;
  revenue: number | null;
  netIncome: number | null;
  assets: number | null;
  revenueDerived: boolean;
  netIncomeDerived: boolean;
  revenueYoY: number | null;
  netIncomeYoY: number | null;
  assetsYoY: number | null;
};

export type ParsedFinancials = {
  currency: string;
  fiscalYearEndMonth: number;
  quarterly: PeriodRow[];
  annual: PeriodRow[];
  concepts: Record<MetricKey, string[]>;
};

export const REVENUE_CONCEPTS = [
  "us-gaap:Revenues",
  "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
  "us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax",
  "us-gaap:SalesRevenueNet",
  "us-gaap:SalesRevenueGoodsNet",
  "us-gaap:RevenuesNetOfInterestExpense",
  "ifrs-full:Revenue",
];
export const NET_INCOME_CONCEPTS = [
  "us-gaap:NetIncomeLoss",
  "us-gaap:ProfitLoss",
  "us-gaap:NetIncomeLossAvailableToCommonStockholdersBasic",
  "ifrs-full:ProfitLossAttributableToOwnersOfParent",
  "ifrs-full:ProfitLoss",
];
export const ASSETS_CONCEPTS = ["us-gaap:Assets", "ifrs-full:Assets"];

export const PERIODIC_FORMS = /^(10-K|10-Q|10-KT|10-QT|20-F|40-F|6-K)(\/A)?$/;
// Annual totals only from annual reports: 10-Qs often carry trailing-twelve-month figures.
export const ANNUAL_FORMS = /^(10-K|10-KT|20-F|40-F)(\/A)?$/;
const DAY_MS = 86_400_000;

function toTime(d: string) {
  return Date.parse(d + "T00:00:00Z");
}
export function daysBetween(a: string, b: string) {
  return Math.round((toTime(b) - toTime(a)) / DAY_MS) + 1;
}

/** 52/53-week years often end in the first days of a month; treat those as the prior month. */
export function adjustedMonth(end: string): { year: number; month: number } {
  const d = new Date(toTime(end));
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth() + 1;
  if (d.getUTCDate() <= 7) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return { year, month };
}

/** Maps a period end date to its fiscal year and quarter, or null if it is not a quarter end. */
export function fiscalPeriodOf(
  end: string,
  fyEndMonth: number,
): { fiscalYear: number; quarter: number } | null {
  const { year, month } = adjustedMonth(end);
  const diff = (month - fyEndMonth + 12) % 12;
  if (diff % 3 !== 0) return null;
  const quarter = diff === 0 ? 4 : diff / 3;
  const fiscalYear = month <= fyEndMonth ? year : year + 1;
  return { fiscalYear, quarter };
}

export function getConcept(json: CompanyFactsJson, id: string): Concept | undefined {
  const [tax = "", name = ""] = id.split(":");
  return json.facts?.[tax]?.[name];
}

export function pickCurrency(json: CompanyFactsJson): string {
  const counts = new Map<string, number>();
  for (const id of [...REVENUE_CONCEPTS, ...NET_INCOME_CONCEPTS, ...ASSETS_CONCEPTS]) {
    const c = getConcept(json, id);
    if (!c) continue;
    for (const [unit, facts] of Object.entries(c.units)) {
      if (!/^[A-Z]{3}$/.test(unit)) continue;
      counts.set(unit, (counts.get(unit) ?? 0) + facts.length);
    }
  }
  let best = "USD";
  let max = -1;
  for (const [u, n] of counts) if (n > max) [best, max] = [u, n];
  return best;
}

type ConceptFacts = { id: string; facts: Fact[]; latestFiled: string; priority: number };

/** Concepts ordered: most recently used first, then by list priority. */
function orderedConcepts(json: CompanyFactsJson, ids: string[], currency: string): ConceptFacts[] {
  const out: ConceptFacts[] = [];
  ids.forEach((id, priority) => {
    const facts = getConcept(json, id)?.units[currency]?.filter((f) => PERIODIC_FORMS.test(f.form));
    if (!facts?.length) return;
    const latestFiled = facts.reduce((m, f) => (f.filed > m ? f.filed : m), "");
    out.push({ id, facts, latestFiled, priority });
  });
  return out.sort((a, b) =>
    a.latestFiled === b.latestFiled
      ? a.priority - b.priority
      : a.latestFiled < b.latestFiled
        ? 1
        : -1,
  );
}

/** Keep the latest-filed value for each identical period (restatements win). */
export function latestByPeriod(facts: Fact[], keyOf: (f: Fact) => string) {
  const map = new Map<string, Fact>();
  for (const f of facts) {
    const k = keyOf(f);
    const prev = map.get(k);
    if (!prev || f.filed > prev.filed) map.set(k, f);
  }
  return [...map.values()];
}

type Value = { val: number; end: string; derived: boolean };
type FlowSeries = {
  quarterly: Map<string, Value>;
  annual: Map<number, Value>;
  used: string[];
};

const qKey = (fy: number, q: number) => `${fy}-Q${q}`;
const parseQKey = (k: string): [number, number] => {
  const [fy = "0", q = "0"] = k.split("-Q");
  return [Number(fy), Number(q)];
};

export function detectFyEndMonth(json: CompanyFactsJson, currency: string): number {
  let latest: Fact | undefined;
  for (const id of [...REVENUE_CONCEPTS, ...NET_INCOME_CONCEPTS]) {
    for (const f of getConcept(json, id)?.units[currency] ?? []) {
      if (!f.start || f.fp !== "FY" || !ANNUAL_FORMS.test(f.form)) continue;
      const len = daysBetween(f.start, f.end);
      if (len < 350 || len > 380) continue;
      if (!latest || f.end > latest.end) latest = f;
    }
  }
  if (!latest) {
    for (const id of ASSETS_CONCEPTS) {
      for (const f of getConcept(json, id)?.units[currency] ?? []) {
        if (f.fp === "FY" && ANNUAL_FORMS.test(f.form) && (!latest || f.end > latest.end))
          latest = f;
      }
    }
  }
  return latest ? adjustedMonth(latest.end).month : 12;
}

function buildFlow(
  json: CompanyFactsJson,
  ids: string[],
  currency: string,
  fyEnd: number,
): FlowSeries {
  const quarterly = new Map<string, Value>();
  const annual = new Map<number, Value>();
  const ytd9 = new Map<number, Value>();
  const used = new Set<string>();

  for (const c of orderedConcepts(json, ids, currency)) {
    const durations = latestByPeriod(
      c.facts.filter((f) => f.start),
      (f) => `${f.start}|${f.end}`,
    );
    for (const f of durations) {
      const len = daysBetween(f.start!, f.end);
      const fp = fiscalPeriodOf(f.end, fyEnd);
      if (!fp) continue;
      const v: Value = { val: f.val, end: f.end, derived: false };
      if (len >= 80 && len <= 100) {
        const k = qKey(fp.fiscalYear, fp.quarter);
        if (!quarterly.has(k)) {
          quarterly.set(k, v);
          used.add(c.id);
        }
      } else if (len >= 350 && len <= 380 && fp.quarter === 4 && ANNUAL_FORMS.test(f.form)) {
        if (!annual.has(fp.fiscalYear)) {
          annual.set(fp.fiscalYear, v);
          used.add(c.id);
        }
      } else if (len >= 255 && len <= 285 && fp.quarter === 3) {
        if (!ytd9.has(fp.fiscalYear)) ytd9.set(fp.fiscalYear, v);
      }
    }
  }

  // Most filers never report Q4 on its own: derive it as full year minus Q1-Q3 (or minus 9-month YTD).
  for (const [fy, a] of annual) {
    const k4 = qKey(fy, 4);
    if (quarterly.has(k4)) continue;
    const q = [1, 2, 3].map((n) => quarterly.get(qKey(fy, n)));
    if (q.every(Boolean)) {
      const sum = q.reduce((s, x) => s + x!.val, 0);
      quarterly.set(k4, { val: a.val - sum, end: a.end, derived: true });
    } else if (ytd9.has(fy)) {
      quarterly.set(k4, { val: a.val - ytd9.get(fy)!.val, end: a.end, derived: true });
    }
  }
  return { quarterly, annual, used: [...used] };
}

function buildInstant(json: CompanyFactsJson, ids: string[], currency: string, fyEnd: number) {
  const quarterly = new Map<string, Value>();
  const used = new Set<string>();
  for (const c of orderedConcepts(json, ids, currency)) {
    const points = latestByPeriod(
      c.facts.filter((f) => !f.start),
      (f) => f.end,
    );
    for (const f of points) {
      const fp = fiscalPeriodOf(f.end, fyEnd);
      if (!fp) continue;
      const k = qKey(fp.fiscalYear, fp.quarter);
      if (!quarterly.has(k)) {
        quarterly.set(k, { val: f.val, end: f.end, derived: false });
        used.add(c.id);
      }
    }
  }
  return { quarterly, used: [...used] };
}

function yoy(curr: number | null, prev: number | null | undefined): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return (curr - prev) / Math.abs(prev);
}

function addGrowth(rows: PeriodRow[], lag: number) {
  rows.forEach((r, i) => {
    const byKey = (fy: number, q: number | null) =>
      rows.find((x) => x.fiscalYear === fy && x.quarter === q);
    const prev = lag === 4 ? byKey(r.fiscalYear - 1, r.quarter) : byKey(r.fiscalYear - 1, null);
    void i;
    r.revenueYoY = yoy(r.revenue, prev?.revenue);
    r.netIncomeYoY = yoy(r.netIncome, prev?.netIncome);
    r.assetsYoY = yoy(r.assets, prev?.assets);
  });
  return rows;
}

function emptyRow(
  key: string,
  label: string,
  fiscalYear: number,
  quarter: number | null,
): PeriodRow {
  return {
    key,
    label,
    fiscalYear,
    quarter,
    end: "",
    revenue: null,
    netIncome: null,
    assets: null,
    revenueDerived: false,
    netIncomeDerived: false,
    revenueYoY: null,
    netIncomeYoY: null,
    assetsYoY: null,
  };
}

export function parseCompanyFacts(json: CompanyFactsJson): ParsedFinancials {
  const currency = pickCurrency(json);
  const fyEnd = detectFyEndMonth(json, currency);
  const revenue = buildFlow(json, REVENUE_CONCEPTS, currency, fyEnd);
  const netIncome = buildFlow(json, NET_INCOME_CONCEPTS, currency, fyEnd);
  const assets = buildInstant(json, ASSETS_CONCEPTS, currency, fyEnd);

  // Quarterly rows
  const qRows = new Map<string, PeriodRow>();
  const qRow = (k: string) => {
    let r = qRows.get(k);
    if (!r) {
      const [fy, q] = parseQKey(k);
      r = emptyRow(k, `Q${q} FY${String(fy).slice(-2)}`, fy, q);
      qRows.set(k, r);
    }
    return r;
  };
  for (const [k, v] of revenue.quarterly) {
    const r = qRow(k);
    r.revenue = v.val;
    r.revenueDerived = v.derived;
    r.end ||= v.end;
  }
  for (const [k, v] of netIncome.quarterly) {
    const r = qRow(k);
    r.netIncome = v.val;
    r.netIncomeDerived = v.derived;
    r.end ||= v.end;
  }
  for (const [k, v] of assets.quarterly) {
    const r = qRow(k);
    r.assets = v.val;
    r.end ||= v.end;
  }

  // Annual rows (assets = fiscal-year-end balance)
  const aRows = new Map<number, PeriodRow>();
  const aRow = (fy: number) => {
    let r = aRows.get(fy);
    if (!r) {
      r = emptyRow(`${fy}`, `FY${fy}`, fy, null);
      aRows.set(fy, r);
    }
    return r;
  };
  for (const [fy, v] of revenue.annual) {
    const r = aRow(fy);
    r.revenue = v.val;
    r.end ||= v.end;
  }
  for (const [fy, v] of netIncome.annual) {
    const r = aRow(fy);
    r.netIncome = v.val;
    r.end ||= v.end;
  }
  for (const [k, v] of assets.quarterly) {
    const [fy, q] = parseQKey(k);
    if (q !== 4) continue;
    const r = aRow(fy);
    r.assets = v.val;
    r.end ||= v.end;
  }

  const sortRows = (rows: PeriodRow[]) =>
    rows.sort((a, b) => a.fiscalYear - b.fiscalYear || (a.quarter ?? 0) - (b.quarter ?? 0));

  return {
    currency,
    fiscalYearEndMonth: fyEnd,
    quarterly: addGrowth(sortRows([...qRows.values()]), 4),
    annual: addGrowth(sortRows([...aRows.values()]), 1),
    concepts: { revenue: revenue.used, netIncome: netIncome.used, assets: assets.used },
  };
}
