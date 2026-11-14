import { useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";

import { CompanySearch } from "@/components/CompanySearch";
import { MetricChart, type MetricConfig } from "@/components/MetricChart";
import { Segmented } from "@/components/Segmented";
import type { PeriodRow } from "@/lib/edgar-parse";
import { financialsQuery } from "@/lib/edgar-queries";
import type { FinancialsResult } from "@/lib/edgar.functions";
import { formatMoney, formatPct, monthName } from "@/lib/format";
import { cn } from "@/lib/utils";

type Freq = "quarterly" | "annual";
type Range = "3y" | "5y" | "10y" | "all";
const RANGES: Range[] = ["3y", "5y", "10y", "all"];

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { ticker?: string; freq?: "annual"; range?: Range } => ({
    ticker:
      typeof s["ticker"] === "string" && s["ticker"].trim()
        ? s["ticker"].trim().toUpperCase().slice(0, 12)
        : undefined,
    freq: s["freq"] === "annual" ? ("annual" as const) : undefined,
    range: RANGES.includes(s["range"] as Range) ? (s["range"] as Range) : undefined,
  }),
  loaderDeps: ({ search }) => ({ ticker: search.ticker ?? "AAPL" }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(financialsQuery(deps.ticker)),
  head: ({ loaderData }) => {
    const d = loaderData as FinancialsResult | undefined;
    const title = d?.ok
      ? `${d.ticker} · ${d.name} financials — Ledgerline`
      : "Ledgerline — SEC company financials, charted";
    const description = d?.ok
      ? `Quarterly and annual revenue, net income and total assets for ${d.name}, straight from SEC EDGAR filings.`
      : "Chart quarterly and annual revenue, net income and total assets for any US-listed company, straight from SEC EDGAR.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  pendingComponent: PendingView,
  component: Index,
});

const METRICS: MetricConfig[] = [
  {
    key: "revenue",
    title: "Revenue",
    kind: "bar",
    color: "var(--color-chart-1)",
    note: "Top-line sales reported on the income statement.",
  },
  {
    key: "netIncome",
    title: "Net income",
    kind: "bar",
    color: "var(--color-chart-2)",
    note: "Bottom-line profit; losses shown in red.",
  },
  {
    key: "assets",
    title: "Total assets",
    kind: "area",
    color: "var(--color-chart-3)",
    note: "Balance-sheet total at each period end.",
  },
];

function Shell({ children, ticker }: { children: React.ReactNode; ticker: string }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl font-semibold tracking-tight">Ledgerline</span>
            <span className="eyebrow hidden sm:inline">SEC EDGAR · Company facts</span>
          </div>
          <a
            href="https://www.sec.gov/edgar/search/"
            target="_blank"
            rel="noreferrer"
            className="eyebrow inline-flex items-center gap-1 hover:text-foreground"
          >
            EDGAR <ExternalLink className="size-3" />
          </a>
        </div>
        <div className="ledger-rule mt-4" />
        <div className="mt-8">
          <CompanySearch current={ticker} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pt-10 pb-20 sm:px-8">{children}</main>
    </div>
  );
}

function PendingView() {
  const { ticker } = Route.useSearch();
  return (
    <Shell ticker={ticker ?? "AAPL"}>
      <div className="h-10 w-72 animate-pulse rounded bg-muted" />
      <div className="mt-8 grid gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
    </Shell>
  );
}

function Index() {
  const search = Route.useSearch();
  const ticker = search.ticker ?? "AAPL";
  const freq: Freq = search.freq ?? "quarterly";
  const range: Range = search.range ?? "10y";
  const navigate = useNavigate({ from: "/" });
  const { data } = useSuspenseQuery(financialsQuery(ticker));

  if (!data.ok) {
    return (
      <Shell ticker={ticker}>
        <div className="rounded-lg border bg-card p-8 shadow-card">
          <div className="eyebrow">{data.ticker}</div>
          <h1 className="mt-2 text-3xl">Nothing to chart yet</h1>
          <p className="mt-2 max-w-lg text-muted-foreground">{data.error}</p>
        </div>
      </Shell>
    );
  }

  const quarterlyUsable = data.quarterly.filter((r) => r.revenue != null || r.netIncome != null).length >= 4;
  const effFreq: Freq = quarterlyUsable ? freq : "annual";
  const all = effFreq === "quarterly" ? data.quarterly : data.annual;
  const years = range === "all" ? Infinity : Number(range.replace("y", ""));
  const rows = trimEmpty(all).slice(-(effFreq === "quarterly" ? years * 4 : years));

  const setSearch = (patch: Partial<{ freq: Freq; range: Range }>) =>
    navigate({
      search: (prev) => ({
        ...prev,
        ...("freq" in patch ? { freq: patch.freq === "annual" ? ("annual" as const) : undefined } : {}),
        ...("range" in patch ? { range: patch.range === "10y" ? undefined : patch.range } : {}),
      }),
      replace: true,
      resetScroll: false,
    });

  const cikPadded = String(data.cik).padStart(10, "0");

  return (
    <Shell ticker={data.ticker}>
      <section className="animate-rise">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="eyebrow">
              {data.ticker} · CIK {cikPadded} · Fiscal year ends {monthName(data.fiscalYearEndMonth)} ·{" "}
              {data.currency}
            </div>
            <h1 className="mt-2 text-4xl leading-tight font-medium tracking-tight sm:text-5xl">
              {data.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Period"
              value={effFreq}
              onChange={(v) => setSearch({ freq: v })}
              options={[
                { value: "quarterly", label: "Quarterly" },
                { value: "annual", label: "Annual" },
              ]}
            />
            <Segmented
              label="Range"
              value={range}
              onChange={(v) => setSearch({ range: v })}
              options={RANGES.map((r) => ({ value: r, label: r === "all" ? "All" : r.toUpperCase() }))}
            />
          </div>
        </div>
        {!quarterlyUsable && (
          <p className="mt-4 text-sm text-muted-foreground">
            This company files annual reports only on EDGAR, so quarterly figures aren’t available.
          </p>
        )}
      </section>

      <div className="mt-8 grid gap-5">
        {METRICS.map((m, i) => (
          <MetricCard
            key={m.key}
            metric={m}
            rows={rows}
            currency={data.currency}
            freq={effFreq}
            delay={i * 80}
          />
        ))}
      </div>

      <footer className="mt-10 flex flex-col gap-2 border-t pt-5 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <p className="max-w-2xl">
          Source: SEC EDGAR XBRL company facts ({[...data.concepts.revenue, ...data.concepts.netIncome, ...data.concepts.assets].join(", ")}).
          Fourth-quarter flows are often derived as full year minus Q1–Q3 and appear lighter. Figures are as filed, including later amendments.
        </p>
        <a
          className="inline-flex shrink-0 items-center gap-1 hover:text-foreground"
          href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cikPadded}&type=10-&dateb=&owner=include&count=40`}
          target="_blank"
          rel="noreferrer"
        >
          View filings on EDGAR <ExternalLink className="size-3" />
        </a>
      </footer>
    </Shell>
  );
}

function trimEmpty(rows: PeriodRow[]) {
  let start = 0;
  while (start < rows.length && rows[start]?.revenue == null && rows[start]?.netIncome == null)
    start++;
  return rows.slice(start);
}

function MetricCard({
  metric,
  rows,
  currency,
  freq,
  delay,
}: {
  metric: MetricConfig;
  rows: PeriodRow[];
  currency: string;
  freq: Freq;
  delay: number;
}) {
  const latest = [...rows].reverse().find((r) => r[metric.key] != null);
  const growth = latest ? latest[`${metric.key}YoY` as const] : null;
  const g = formatPct(growth);
  const hasData = rows.some((r) => r[metric.key] != null);

  return (
    <article
      className="animate-rise rounded-lg border bg-card p-5 shadow-card sm:p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: metric.color }} />
            <h2 className="text-xl font-medium">{metric.title}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{metric.note}</p>
        </div>
        {latest && (
          <div className="text-right">
            <div className="eyebrow">
              {latest.label} · {freq === "quarterly" ? "latest quarter" : "latest year"}
            </div>
            <div className="figure mt-1 text-3xl font-medium">
              {formatMoney(latest[metric.key], currency)}
            </div>
            {g && (
              <div
                className={cn(
                  "figure mt-0.5 inline-flex items-center gap-0.5 text-sm",
                  (growth ?? 0) >= 0 ? "text-positive" : "text-destructive",
                )}
              >
                {(growth ?? 0) >= 0 ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {g} YoY
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-5">
        {hasData ? (
          <ClientOnly fallback={<div className="h-[260px] animate-pulse rounded bg-muted" />}>
            <MetricChart data={rows} metric={metric} currency={currency} syncId="ledger" />
          </ClientOnly>
        ) : (
          <div className="flex h-[160px] items-center justify-center rounded border border-dashed text-sm text-muted-foreground">
            Not reported in this period range
          </div>
        )}
      </div>
    </article>
  );
}
