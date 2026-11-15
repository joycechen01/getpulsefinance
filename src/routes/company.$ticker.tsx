import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClientOnly, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, Loader2, Lock, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EvidenceBadge } from "@/components/EvidenceBadge";
import { InfoTip } from "@/components/InfoTip";
import { MetricChart, type ChartPoint } from "@/components/MetricChart";
import { Segmented } from "@/components/Segmented";
import { Sparkline } from "@/components/Sparkline";
import { Button } from "@/components/ui/button";
import { CompanySearch } from "@/components/CompanySearch";
import { AskPanel } from "@/components/research/AskPanel";
import { RedlineView } from "@/components/research/RedlineView";
import { SignalsPanel } from "@/components/research/SignalsPanel";
import { NewsPanel } from "@/components/research/NewsPanel";
import { CompetitorComparison } from "@/components/research/CompetitorComparison";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PulseLogo } from "@/components/PulseLogo";
import { supabase } from "@/integrations/supabase/client";
import { companyQuery } from "@/lib/edgar-queries";
import { formatDate, formatMoney, monthName, secDocUrl } from "@/lib/format";
import { GROUPS, HEADLINE, fmtChange, fmtValue, isCalculated, type MetricSpec } from "@/lib/metric-config";
import { latestWithYoY, series, valueOf, type FinRow } from "@/lib/metrics";
import { addHolding } from "@/lib/portfolio.functions";
import { cn } from "@/lib/utils";

type Freq = "quarterly" | "annual";

const TABS = ["overview", "changes", "signals", "news", "competitors", "ask"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/company/$ticker")({
  ssr: false,
  // The research tab lives in the URL so refresh, back and shared links keep it.
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const tab = TABS.find((t) => t === search["tab"]);
    return tab && tab !== "overview" ? { tab } : {};
  },
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    return { signedIn: !!data.session };
  },
  head: ({ params }) => {
    const t = params.ticker.toUpperCase();
    const title = `${t} financials from SEC filings — Pulse Finance`;
    const description = `Revenue, margins, cash flow and recent SEC filings for ${t}, straight from EDGAR.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: CompanyLayout,
});

function CompanyLayout() {
  const { signedIn } = Route.useRouteContext();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to={signedIn ? "/home" : "/"} aria-label="Pulse Finance home">
            <PulseLogo size={28} color="var(--color-primary)" />
          </Link>
          <div className="ml-auto hidden w-80 md:block">
            <CompanySearch placeholder="Search any ticker…" />
          </div>
          <Button asChild size="sm" variant={signedIn ? "ghost" : "default"}>
            <Link to={signedIn ? "/home" : "/auth"}>{signedIn ? "Portfolio" : "Sign up free"}</Link>
          </Button>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <CompanySearch placeholder="Search any ticker…" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <CompanyPage signedIn={signedIn} />
      </main>
    </div>
  );
}

function CompanyPage({ signedIn }: { signedIn: boolean }) {
  const { ticker } = Route.useParams();
  const { tab = "overview" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isLoading, error } = useQuery(companyQuery(ticker, signedIn));
  const [freq, setFreq] = useState<Freq>("quarterly");

  if (isLoading)
    return (
      <div className="space-y-4">
        <div className="eyebrow flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" /> Loading {ticker.toUpperCase()} from SEC EDGAR…
        </div>
        <div className="h-12 w-80 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      </div>
    );
  if (error || !data) return <p className="text-destructive">Couldn’t load this company.</p>;
  if (!data.ok)
    return (
      <div className="panel p-8">
        <h1 className="text-3xl">Nothing to show</h1>
        <p className="mt-2 text-muted-foreground">{data.error}</p>
      </div>
    );

  const { company, financials: fin, filings, held } = data;
  const rows = fin ? (freq === "quarterly" ? fin.quarterly : fin.annual) : [];
  const cur = fin?.currency ?? "USD";
  const overview = (
    <>
      {fin && (
        <div className="flex justify-end">
          <Segmented
            label="Period"
            value={freq}
            onChange={setFreq}
            options={[
              { value: "quarterly", label: "Quarterly" },
              { value: "annual", label: "Annual" },
            ]}
          />
        </div>
      )}
      {!fin || rows.length === 0 ? (
          <div className="panel p-6 text-sm text-muted-foreground">
            {company.name} has no structured XBRL financial data on EDGAR for this view.
          </div>
        ) : (
          <>
            <section className="company-metrics grid sm:grid-cols-2 lg:grid-cols-3">
              {HEADLINE.map((m) => (
                <HeadlineCard key={m.id} spec={m} rows={rows} currency={cur} freq={freq} />
              ))}
            </section>
  
            {signedIn ? (
              <>
                <TrendExplorer rows={rows} currency={cur} />
                <section className="metric-groups grid gap-8 lg:grid-cols-2">
                  {GROUPS.map((g) => (
                    <MetricGroup key={g.title} title={g.title} specs={g.metrics} rows={rows} currency={cur} freq={freq} />
                  ))}
                </section>
              </>
            ) : (
              <section className="panel flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex items-start gap-3">
                  <Lock className="mt-1 size-4 text-primary" />
                  <div>
                    <h2 className="text-2xl">See the full picture with a free account</h2>
                    <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                      Build a portfolio, monitor several companies side by side, see what changed between filings, get signals on material developments, ask Pulse AI questions with citations, explore trend charts and every
                      metric group (growth, profitability, cash, quality of earnings, balance sheet, per share).
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <Link to="/auth">Sign up free</Link>
                </Button>
              </section>
            )}
          </>
        )}
  
        <FilingList cik={company.cik} filings={filings} />
    </>
  );

  return (
    <div className="space-y-8 animate-rise">
      <header className="editorial-masthead flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow">
            {company.ticker} · CIK {String(company.cik).padStart(10, "0")}
            {company.exchanges?.length ? ` · ${company.exchanges.join(", ")}` : ""}
          </div>
          <h1 className="mt-1">{company.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {company.sic_description ? `${toTitle(company.sic_description)}. ` : ""}
            {fin ? `Fiscal year ends in ${monthName(fin.fyEndMonth)}; periods are labeled as the company reports them. ` : ""}
            <span className="inline-flex items-center gap-1 align-middle">
              <EvidenceBadge kind="fact" compact />
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {signedIn ? (
            <HoldButton ticker={company.ticker} held={held} />
          ) : (
            <Button asChild variant="outline">
              <Link to="/auth">
                <Plus /> Add to portfolio
              </Link>
            </Button>
          )}
        </div>
      </header>

      {signedIn ? (
        <Tabs
          value={tab}
          onValueChange={(t) =>
            navigate({ search: t === "overview" ? {} : { tab: t as Tab }, replace: true, resetScroll: false })
          }
          className="space-y-6"
        >
          <TabsList className="research-tabs">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="changes">What changed</TabsTrigger>
            <TabsTrigger value="signals">Signals</TabsTrigger>
            <TabsTrigger value="news">News</TabsTrigger>
            <TabsTrigger value="competitors">Competitors</TabsTrigger>
            <TabsTrigger value="ask">Pulse AI</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-8">
            {overview}
          </TabsContent>
          <TabsContent value="changes">
            <RedlineView ticker={company.ticker} />
          </TabsContent>
          <TabsContent value="signals">
            <SignalsPanel ticker={company.ticker} />
          </TabsContent>
          <TabsContent value="news">
            <NewsPanel ticker={company.ticker} name={company.name} />
          </TabsContent>
          <TabsContent value="competitors">
            <CompetitorComparison ticker={company.ticker} />
          </TabsContent>
          <TabsContent value="ask">
            <AskPanel ticker={company.ticker} name={company.name} />
          </TabsContent>
        </Tabs>
      ) : (
        overview
      )}

      <p className="text-xs text-muted-foreground">
        All figures come from SEC XBRL company facts as filed, including amendments. Fourth-quarter and quarterly cash
        flow values are derived from full-year and year-to-date totals. Values a company doesn’t report show as “Not
        reported”.
      </p>
    </div>
  );
}

function toTitle(s: string) {
  return s.toLowerCase().replace(/(^|\s|&)\w/g, (m) => m.toUpperCase());
}

function HoldButton({ ticker, held }: { ticker: string; held: boolean }) {
  const qc = useQueryClient();
  const add = useServerFn(addHolding);
  const [busy, setBusy] = useState(false);
  if (held)
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm text-muted-foreground">
        <Check className="size-4 text-positive" /> In your portfolio
      </span>
    );
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await add({ data: { ticker } });
        setBusy(false);
        if (!r.ok) toast.error(r.error);
        else {
          toast.success(`${ticker} added to your portfolio`);
          qc.invalidateQueries({ queryKey: ["company", ticker] });
          qc.invalidateQueries({ queryKey: ["portfolio"] });
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Plus />} Add to portfolio
    </Button>
  );
}

function MetricName({ spec }: { spec: MetricSpec }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {spec.label}
      <InfoTip term={spec.term} title={spec.label} />
    </span>
  );
}

function changeTone(change: string | null) {
  if (!change) return "text-muted-foreground";
  return change.startsWith("-") ? "text-negative" : "text-positive";
}

function HeadlineCard({ spec, rows, currency, freq }: { spec: MetricSpec; rows: FinRow[]; currency: string; freq: Freq }) {
  const latest = latestWithYoY(rows, spec.id);
  const change = latest ? fmtChange(latest.value, latest.prior, spec.fmt) : null;
  const points = series(rows, spec.id).slice(freq === "quarterly" ? -12 : -8);
  const isNetCash = spec.id === "netCash";
  return (
    <article className="panel flex flex-col p-5">
      <div className="flex items-start justify-between gap-2 text-sm text-muted-foreground">
        <MetricName spec={spec} />
        {isCalculated(spec.id) ? <EvidenceBadge kind="calc" compact /> : <EvidenceBadge kind="fact" compact />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="figure text-3xl">{fmtValue(latest?.value, spec.fmt, currency)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {latest ? latest.row.label : "No data"}
            {change && (
              <span className={cn("figure", changeTone(change))}> · {change} vs. year ago</span>
            )}
          </div>
        </div>
        <Sparkline values={points.map((p) => p.value)} className="text-chart-1" />
      </div>
      {isNetCash && latest && (
        <div className="mt-3 flex gap-4 border-t pt-3 text-xs text-muted-foreground">
          <span>
            Cash <span className="figure text-foreground">{formatMoney(valueOf(rows, latest.row, "cashTotal"), currency)}</span>
          </span>
          <span>
            Debt <span className="figure text-foreground">{formatMoney(valueOf(rows, latest.row, "totalDebt"), currency)}</span>
          </span>
        </div>
      )}
    </article>
  );
}

function MetricGroup({
  title,
  specs,
  rows,
  currency,
  freq,
}: {
  title: string;
  specs: MetricSpec[];
  rows: FinRow[];
  currency: string;
  freq: Freq;
}) {
  return (
    <section className="panel p-5">
      <h2 className="text-2xl">{title}</h2>
      <ul className="mt-3 divide-y">
        {specs.map((s) => {
          const latest = latestWithYoY(rows, s.id);
          const growthMetric = s.id === "revenueYoY" || s.id === "revenueQoQ";
          const change = latest && !growthMetric ? fmtChange(latest.value, latest.prior, s.fmt) : null;
          const qoqNA = s.id === "revenueQoQ" && freq === "annual";
          const points = series(rows, s.id).slice(freq === "quarterly" ? -12 : -8);
          return (
            <li key={`${s.id}-${s.label}`} className="flex items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <MetricName spec={s} />
                  {isCalculated(s.id) && <EvidenceBadge kind="calc" compact />}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {qoqNA ? "Quarterly view only" : latest ? latest.row.label : ""}
                  {change && <span className={cn("figure", changeTone(change))}> · {change} vs. year ago</span>}
                </div>
              </div>
              <Sparkline values={points.map((p) => p.value)} className="text-chart-1" width={80} height={24} />
              <div className={cn("figure w-28 text-right", !latest && "text-muted-foreground text-xs")}>
                {qoqNA ? "—" : fmtValue(latest?.value, s.fmt, currency)}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const TREND_OPTIONS: MetricSpec[] = [
  HEADLINE[0]!,
  HEADLINE[3]!,
  HEADLINE[1]!,
  HEADLINE[2]!,
  HEADLINE[4]!,
  { id: "freeCashFlow", label: "Free cash flow", term: "freeCashFlow", fmt: "money" },
  { id: "assets", label: "Total assets", term: "cash", fmt: "money" },
];

function TrendExplorer({ rows, currency }: { rows: FinRow[]; currency: string }) {
  const [id, setId] = useState(TREND_OPTIONS[0]!.id);
  const [range, setRange] = useState<"3y" | "5y" | "10y" | "all">("5y");
  const spec = TREND_OPTIONS.find((o) => o.id === id)!;
  const quarterly = rows.some((r) => r.quarter != null);
  const years = range === "all" ? Infinity : Number(range.replace("y", ""));
  const all = series(rows, id);
  let start = all.findIndex((p) => p.value != null);
  if (start < 0) start = all.length;
  const pts: ChartPoint[] = all
    .map((p, i) => {
      const r = rows[i]!;
      const prior = rows.find((x) => x.fiscalYear === r.fiscalYear - 1 && x.quarter === r.quarter);
      return { ...p, change: prior ? fmtChange(p.value, valueOf(rows, prior, id), spec.fmt) : null };
    })
    .slice(start)
    .slice(-(quarterly ? years * 4 : years));
  const kind = spec.fmt === "ratio" || id === "assets" ? "line" : "bar";
  return (
    <section className="editorial-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {TREND_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setId(o.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                o.id === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Segmented
          label="Range"
          value={range}
          onChange={setRange}
          options={[
            { value: "3y", label: "3Y" },
            { value: "5y", label: "5Y" },
            { value: "10y", label: "10Y" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      <div className="mt-5">
        <ClientOnly fallback={<div className="h-[240px] animate-pulse rounded bg-muted" />}>
          <MetricChart
            data={pts}
            kind={kind}
            color="var(--color-chart-1)"
            fmt={(v) => fmtValue(v, spec.fmt, currency)}
            axisFmt={(v) => (spec.fmt === "ratio" ? `${Math.round(v * 100)}%` : formatMoney(v, currency, 0))}
          />
        </ClientOnly>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Lighter bars are derived from year-to-date or full-year totals.</p>
    </section>
  );
}

function FilingList({
  cik,
  filings,
}: {
  cik: number;
  filings: { accession: string; form: string; filing_date: string; report_date: string | null; primary_document: string | null; description: string | null; items: string | null }[];
}) {
  const [form, setForm] = useState<"all" | "10-K" | "10-Q" | "8-K">("all");
  const shown = filings.filter((f) => form === "all" || f.form.startsWith(form)).slice(0, 25);
  return (
    <section className="editorial-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">Filing history</h2>
        <Segmented
          label="Form"
          value={form}
          onChange={setForm}
          options={[
            { value: "all", label: "All" },
            { value: "10-K", label: "10-K" },
            { value: "10-Q", label: "10-Q" },
            { value: "8-K", label: "8-K" },
          ]}
        />
      </div>
      <ul className="mt-4 divide-y">
        {shown.length === 0 && <li className="py-3 text-sm text-muted-foreground">No filings of this type.</li>}
        {shown.map((f) => (
          <li key={f.accession}>
            <a
              href={secDocUrl(cik, f.accession, f.primary_document)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 py-2.5 text-sm hover:text-primary"
            >
              <span className="w-16 rounded-sm bg-secondary px-1.5 py-0.5 text-center font-mono text-xs text-foreground">{f.form}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {f.description ?? f.form}
                {f.items ? ` · Items ${f.items}` : ""}
                {f.report_date ? ` · period ${formatDate(f.report_date)}` : ""}
              </span>
              <span className="figure text-xs text-muted-foreground">{formatDate(f.filing_date)}</span>
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

