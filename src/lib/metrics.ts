// Pure: turns SEC company-facts JSON into per-period values for every metric Pulse Finance shows.
// Rules: tag fallback lists per metric, YTD cash-flow -> quarter conversion, Q4 = FY - (Q1..Q3),
// missing values stay absent ("Not reported"), never zero.
import {
  ANNUAL_FORMS,
  PERIODIC_FORMS,
  daysBetween,
  detectFyEndMonth,
  fiscalPeriodOf,
  getConcept,
  latestByPeriod,
  pickCurrency,
  type CompanyFactsJson,
  type Fact,
} from "./edgar-parse";

export type MetricId =
  | "revenue"
  | "costOfRevenue"
  | "grossProfit"
  | "operatingIncome"
  | "netIncome"
  | "operatingCashFlow"
  | "capex"
  | "rnd"
  | "sga"
  | "sbc"
  | "epsDiluted"
  | "dilutedShares"
  | "cash"
  | "shortTermInvestments"
  | "inventory"
  | "receivables"
  | "deferredRevenue"
  | "debtCurrent"
  | "debtLongTerm"
  | "assets";

type Def = {
  kind: "flow" | "instant";
  unit: "currency" | "shares" | "perShare";
  derive: boolean;
  tags: string[];
};

const g = (...n: string[]) => n.map((x) => (x.includes(":") ? x : `us-gaap:${x}`));

export const METRIC_DEFS: Record<MetricId, Def> = {
  revenue: {
    kind: "flow",
    unit: "currency",
    derive: true,
    tags: g(
      "Revenues",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "SalesRevenueNet",
      "SalesRevenueGoodsNet",
      "RevenuesNetOfInterestExpense",
      "ifrs-full:Revenue",
    ),
  },
  costOfRevenue: {
    kind: "flow",
    unit: "currency",
    derive: true,
    tags: g(
      "CostOfRevenue",
      "CostOfGoodsAndServicesSold",
      "CostOfGoodsSold",
      "CostOfServices",
      "ifrs-full:CostOfSales",
    ),
  },
  grossProfit: { kind: "flow", unit: "currency", derive: true, tags: g("GrossProfit", "ifrs-full:GrossProfit") },
  operatingIncome: {
    kind: "flow",
    unit: "currency",
    derive: true,
    tags: g("OperatingIncomeLoss", "ifrs-full:ProfitLossFromOperatingActivities"),
  },
  netIncome: {
    kind: "flow",
    unit: "currency",
    derive: true,
    tags: g(
      "NetIncomeLoss",
      "ProfitLoss",
      "NetIncomeLossAvailableToCommonStockholdersBasic",
      "ifrs-full:ProfitLossAttributableToOwnersOfParent",
      "ifrs-full:ProfitLoss",
    ),
  },
  operatingCashFlow: {
    kind: "flow",
    unit: "currency",
    derive: true,
    tags: g(
      "NetCashProvidedByUsedInOperatingActivities",
      "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
      "ifrs-full:CashFlowsFromUsedInOperatingActivities",
    ),
  },
  capex: {
    kind: "flow",
    unit: "currency",
    derive: true,
    tags: g(
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsToAcquireProductiveAssets",
      "PaymentsForCapitalImprovements",
      "ifrs-full:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
    ),
  },
  rnd: {
    kind: "flow",
    unit: "currency",
    derive: true,
    tags: g("ResearchAndDevelopmentExpense", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"),
  },
  sga: { kind: "flow", unit: "currency", derive: true, tags: g("SellingGeneralAndAdministrativeExpense") },
  sbc: {
    kind: "flow",
    unit: "currency",
    derive: true,
    tags: g("ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"),
  },
  epsDiluted: { kind: "flow", unit: "perShare", derive: false, tags: g("EarningsPerShareDiluted") },
  dilutedShares: {
    kind: "flow",
    unit: "shares",
    derive: false,
    tags: g("WeightedAverageNumberOfDilutedSharesOutstanding"),
  },
  cash: {
    kind: "instant",
    unit: "currency",
    derive: false,
    tags: g(
      "CashAndCashEquivalentsAtCarryingValue",
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
      "ifrs-full:CashAndCashEquivalents",
    ),
  },
  shortTermInvestments: {
    kind: "instant",
    unit: "currency",
    derive: false,
    tags: g("ShortTermInvestments", "MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"),
  },
  inventory: { kind: "instant", unit: "currency", derive: false, tags: g("InventoryNet", "ifrs-full:Inventories") },
  receivables: {
    kind: "instant",
    unit: "currency",
    derive: false,
    tags: g("AccountsReceivableNetCurrent", "ReceivablesNetCurrent"),
  },
  deferredRevenue: {
    kind: "instant",
    unit: "currency",
    derive: false,
    tags: g(
      "ContractWithCustomerLiabilityCurrent",
      "DeferredRevenueCurrent",
      "ContractWithCustomerLiability",
      "DeferredRevenue",
    ),
  },
  debtCurrent: {
    kind: "instant",
    unit: "currency",
    derive: false,
    tags: g("DebtCurrent", "LongTermDebtCurrent", "ShortTermBorrowings", "CommercialPaper"),
  },
  debtLongTerm: {
    kind: "instant",
    unit: "currency",
    derive: false,
    tags: g("LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations", "LongTermDebt"),
  },
  assets: { kind: "instant", unit: "currency", derive: false, tags: g("Assets", "ifrs-full:Assets") },
};

export const METRIC_IDS = Object.keys(METRIC_DEFS) as MetricId[];

export type FinRow = {
  key: string;
  label: string;
  fiscalYear: number;
  quarter: number | null;
  end: string;
  v: Partial<Record<MetricId, number>>;
  /** Values derived by subtraction (Q4 or YTD -> quarter). */
  derived: MetricId[];
  /** Values calculated from other reported values (e.g. gross profit fallback). */
  calculated: MetricId[];
};

export type Financials = {
  currency: string;
  fyEndMonth: number;
  quarterly: FinRow[];
  annual: FinRow[];
  tags: Partial<Record<MetricId, string[]>>;
};

type Val = { val: number; end: string; derived: boolean };

function unitKey(unit: Def["unit"], currency: string) {
  return unit === "currency" ? currency : unit === "shares" ? "shares" : `${currency}/shares`;
}

function orderedFacts(json: CompanyFactsJson, tags: string[], unit: string) {
  const out: { id: string; facts: Fact[]; latest: string; prio: number }[] = [];
  tags.forEach((id, prio) => {
    const facts = getConcept(json, id)?.units[unit]?.filter((f) => PERIODIC_FORMS.test(f.form));
    if (!facts?.length) return;
    out.push({ id, facts, latest: facts.reduce((m, f) => (f.filed > m ? f.filed : m), ""), prio });
  });
  return out.sort((a, b) => (a.latest === b.latest ? a.prio - b.prio : a.latest < b.latest ? 1 : -1));
}

const key = (fy: number, q: number) => `${fy}-Q${q}`;

function buildFlow(json: CompanyFactsJson, def: Def, unit: string, fyEnd: number) {
  const direct = new Map<string, Val>();
  const ytd = new Map<string, Val>(); // `${fy}-${n}` cumulative n quarters
  const used = new Set<string>();
  for (const c of orderedFacts(json, def.tags, unit)) {
    for (const f of latestByPeriod(
      c.facts.filter((x) => x.start),
      (x) => `${x.start}|${x.end}`,
    )) {
      const fp = fiscalPeriodOf(f.end, fyEnd);
      if (!fp) continue;
      const len = daysBetween(f.start!, f.end);
      const v: Val = { val: f.val, end: f.end, derived: false };
      let n = 0;
      if (len >= 80 && len <= 100) {
        const k = key(fp.fiscalYear, fp.quarter);
        if (!direct.has(k)) {
          direct.set(k, v);
          used.add(c.id);
        }
        if (fp.quarter === 1) n = 1;
      } else if (len >= 170 && len <= 195 && fp.quarter === 2) n = 2;
      else if (len >= 255 && len <= 285 && fp.quarter === 3) n = 3;
      else if (len >= 350 && len <= 380 && fp.quarter === 4 && ANNUAL_FORMS.test(f.form)) n = 4;
      if (n) {
        const k = `${fp.fiscalYear}-${n}`;
        if (!ytd.has(k)) {
          ytd.set(k, v);
          used.add(c.id);
        }
      }
    }
  }
  const years = new Set<number>();
  for (const k of [...direct.keys(), ...ytd.keys()]) years.add(Number(k.split("-")[0]));

  const quarterly = new Map<string, Val>(direct);
  if (def.derive) {
    const cumulative = (fy: number, n: number): number | null => {
      const y = ytd.get(`${fy}-${n}`);
      if (y) return y.val;
      let sum = 0;
      for (let q = 1; q <= n; q++) {
        const d = quarterly.get(key(fy, q));
        if (!d) return null;
        sum += d.val;
      }
      return sum;
    };
    for (const fy of [...years].sort()) {
      for (let q = 2; q <= 4; q++) {
        const k = key(fy, q);
        if (quarterly.has(k)) continue;
        const cur = ytd.get(`${fy}-${q}`);
        const prev = cumulative(fy, q - 1);
        if (cur && prev != null) quarterly.set(k, { val: cur.val - prev, end: cur.end, derived: true });
      }
    }
  }
  const annual = new Map<number, Val>();
  for (const [k, v] of ytd) {
    const [fy, n] = k.split("-").map(Number);
    if (n === 4 && fy != null) annual.set(fy, v);
  }
  return { quarterly, annual, used: [...used] };
}

function buildInstant(json: CompanyFactsJson, def: Def, unit: string, fyEnd: number) {
  const quarterly = new Map<string, Val>();
  const used = new Set<string>();
  for (const c of orderedFacts(json, def.tags, unit)) {
    for (const f of latestByPeriod(
      c.facts.filter((x) => !x.start),
      (x) => x.end,
    )) {
      const fp = fiscalPeriodOf(f.end, fyEnd);
      if (!fp) continue;
      const k = key(fp.fiscalYear, fp.quarter);
      if (!quarterly.has(k)) {
        quarterly.set(k, { val: f.val, end: f.end, derived: false });
        used.add(c.id);
      }
    }
  }
  const annual = new Map<number, Val>();
  for (const [k, v] of quarterly) {
    const [fy, q] = k.split("-Q").map(Number);
    if (q === 4 && fy != null) annual.set(fy, v);
  }
  return { quarterly, annual, used: [...used] };
}

export function buildFinancials(json: CompanyFactsJson): Financials {
  const currency = pickCurrency(json);
  const fyEndMonth = detectFyEndMonth(json, currency);
  const qRows = new Map<string, FinRow>();
  const aRows = new Map<number, FinRow>();
  const tags: Financials["tags"] = {};

  const qRow = (k: string) => {
    let r = qRows.get(k);
    if (!r) {
      const [fy = 0, q = 0] = k.split("-Q").map(Number);
      r = { key: k, label: `Q${q} FY${String(fy).slice(-2)}`, fiscalYear: fy, quarter: q, end: "", v: {}, derived: [], calculated: [] };
      qRows.set(k, r);
    }
    return r;
  };
  const aRow = (fy: number) => {
    let r = aRows.get(fy);
    if (!r) {
      r = { key: `${fy}`, label: `FY${fy}`, fiscalYear: fy, quarter: null, end: "", v: {}, derived: [], calculated: [] };
      aRows.set(fy, r);
    }
    return r;
  };

  for (const id of METRIC_IDS) {
    const def = METRIC_DEFS[id];
    const unit = unitKey(def.unit, currency);
    const s = def.kind === "flow" ? buildFlow(json, def, unit, fyEndMonth) : buildInstant(json, def, unit, fyEndMonth);
    if (s.used.length) tags[id] = s.used;
    for (const [k, v] of s.quarterly) {
      const r = qRow(k);
      r.v[id] = v.val;
      if (v.derived) r.derived.push(id);
      if (!r.end || v.end > r.end) r.end = v.end;
    }
    for (const [fy, v] of s.annual) {
      const r = aRow(fy);
      r.v[id] = v.val;
      if (!r.end || v.end > r.end) r.end = v.end;
    }
  }

  const finish = (rows: FinRow[]) => {
    for (const r of rows) {
      // Gross profit fallback: revenue minus cost of revenue.
      if (r.v.grossProfit == null && r.v.revenue != null && r.v.costOfRevenue != null) {
        r.v.grossProfit = r.v.revenue - r.v.costOfRevenue;
        r.calculated.push("grossProfit");
      }
    }
    return rows
      .filter((r) => r.v.revenue != null || r.v.netIncome != null || r.v.assets != null)
      .sort((a, b) => a.fiscalYear - b.fiscalYear || (a.quarter ?? 0) - (b.quarter ?? 0));
  };

  return {
    currency,
    fyEndMonth,
    quarterly: finish([...qRows.values()]),
    annual: finish([...aRows.values()]),
    tags,
  };
}

// ---------- Calculated metrics ----------

export type CalcId =
  | MetricId
  | "grossMargin"
  | "operatingMargin"
  | "freeCashFlow"
  | "fcfMargin"
  | "rndPct"
  | "sgaPct"
  | "sbcPct"
  | "cashTotal"
  | "totalDebt"
  | "netCash"
  | "revenueYoY"
  | "revenueQoQ";

export const CALCULATED: ReadonlySet<CalcId> = new Set<CalcId>([
  "grossMargin",
  "operatingMargin",
  "freeCashFlow",
  "fcfMargin",
  "rndPct",
  "sgaPct",
  "sbcPct",
  "cashTotal",
  "totalDebt",
  "netCash",
  "revenueYoY",
  "revenueQoQ",
]);

const ratio = (a?: number, b?: number) => (a == null || b == null || b === 0 ? null : a / b);

function priorYear(rows: FinRow[], r: FinRow) {
  return rows.find((x) => x.fiscalYear === r.fiscalYear - 1 && x.quarter === r.quarter);
}
function priorQuarter(rows: FinRow[], r: FinRow) {
  if (r.quarter == null) return undefined;
  const fy = r.quarter === 1 ? r.fiscalYear - 1 : r.fiscalYear;
  const q = r.quarter === 1 ? 4 : r.quarter - 1;
  return rows.find((x) => x.fiscalYear === fy && x.quarter === q);
}

export function valueOf(rows: FinRow[], r: FinRow, id: CalcId): number | null {
  const v = r.v;
  switch (id) {
    case "grossMargin":
      return ratio(v.grossProfit, v.revenue);
    case "operatingMargin":
      return ratio(v.operatingIncome, v.revenue);
    case "freeCashFlow":
      return v.operatingCashFlow != null && v.capex != null ? v.operatingCashFlow - v.capex : null;
    case "fcfMargin": {
      const f = valueOf(rows, r, "freeCashFlow");
      return f == null ? null : ratio(f, v.revenue);
    }
    case "rndPct":
      return ratio(v.rnd, v.revenue);
    case "sgaPct":
      return ratio(v.sga, v.revenue);
    case "sbcPct":
      return ratio(v.sbc, v.revenue);
    case "cashTotal":
      return v.cash == null ? null : v.cash + (v.shortTermInvestments ?? 0);
    case "totalDebt":
      return v.debtCurrent == null && v.debtLongTerm == null ? null : (v.debtCurrent ?? 0) + (v.debtLongTerm ?? 0);
    case "netCash": {
      const c = valueOf(rows, r, "cashTotal");
      const d = valueOf(rows, r, "totalDebt");
      return c == null || d == null ? null : c - d;
    }
    case "revenueYoY": {
      const p = priorYear(rows, r);
      return p ? growth(v.revenue, p.v.revenue) : null;
    }
    case "revenueQoQ": {
      const p = priorQuarter(rows, r);
      return p ? growth(v.revenue, p.v.revenue) : null;
    }
    default:
      return v[id] ?? null;
  }
}

export function growth(cur?: number | null, prev?: number | null) {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}

export type SeriesPoint = { label: string; end: string; value: number | null; derived: boolean };

export function series(rows: FinRow[], id: CalcId): SeriesPoint[] {
  return rows.map((r) => ({
    label: r.label,
    end: r.end,
    value: valueOf(rows, r, id),
    derived: r.derived.includes(id as MetricId) || (id === "freeCashFlow" && r.derived.includes("operatingCashFlow")),
  }));
}

/** Latest value plus the same period a year earlier (for "vs. year ago" changes). */
export function latestWithYoY(rows: FinRow[], id: CalcId) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]!;
    const value = valueOf(rows, r, id);
    if (value == null) continue;
    const p = priorYear(rows, r);
    const prior = p ? valueOf(rows, p, id) : null;
    return { row: r, value, prior };
  }
  return null;
}

/** Trailing twelve months for a flow metric: sum of the last four consecutive quarters. */
export function ttm(quarterly: FinRow[], id: MetricId) {
  const withVal = quarterly.filter((r) => r.v[id] != null);
  const last = withVal.slice(-4);
  if (last.length < 4) return null;
  for (let i = 1; i < 4; i++) {
    const a = last[i - 1]!;
    const b = last[i]!;
    const consecutive =
      (b.fiscalYear === a.fiscalYear && b.quarter === (a.quarter ?? 0) + 1) ||
      (b.fiscalYear === a.fiscalYear + 1 && a.quarter === 4 && b.quarter === 1);
    if (!consecutive) return null;
  }
  return { value: last.reduce((s, r) => s + (r.v[id] ?? 0), 0), from: last[0]!.label, to: last[3]!.label };
}
