import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CompanySearch } from "@/components/CompanySearch";
import { DevelopmentsPanel } from "@/components/research/DevelopmentsPanel";
import { SharedRisksPanel } from "@/components/research/SharedRisksPanel";
import { EarningsDigestPanel } from "@/components/research/EarningsDigestPanel";
import { MaterialEventsPanel } from "@/components/research/MaterialEventsPanel";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { InfoTip } from "@/components/InfoTip";
import { Sparkline } from "@/components/Sparkline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { portfolioQuery, quotesQuery } from "@/lib/edgar-queries";
import { formatDate, formatPrice, secDocUrl } from "@/lib/format";
import { fmtChange, fmtValue } from "@/lib/metric-config";
import { latestWithYoY, series } from "@/lib/metrics";
import { addHolding, removeHolding, updateHolding, type PortfolioRow } from "@/lib/portfolio.functions";
import { profileQuery } from "@/lib/profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [
    { title: "Your portfolio — Pulse Finance" },
    { name: "description", content: "Follow the companies you own with SEC filings and evidence-backed research." },
    { property: "og:title", content: "Your portfolio — Pulse Finance" },
    { property: "og:description", content: "Follow the companies you own with SEC filings and evidence-backed research." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Home,
});

function Home() {
  const qc = useQueryClient();
  const profile = useQuery(profileQuery());
  const pf = useQuery(portfolioQuery());
  const add = useServerFn(addHolding);
  const [adding, setAdding] = useState<string | null>(null);
  const tickers = (pf.data?.holdings ?? []).map((h) => h.ticker);
  const quotes = useQuery(quotesQuery(tickers));

  if (profile.data && !profile.data.onboarded && pf.data && pf.data.holdings.length === 0) {
    return <Navigate to="/onboarding" />;
  }
  if (pf.isLoading || profile.isLoading) {
    return (
      <div className="grid gap-4">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="h-72 animate-pulse rounded-lg bg-card" />
      </div>
    );
  }
  if (pf.error) return <p className="text-destructive">{pf.error.message}</p>;
  const data = pf.data;
  if (!data) return null;

  const onPick = async (ticker: string) => {
    setAdding(ticker);
    const r = await add({ data: { ticker } });
    setAdding(null);
    if (!r.ok) toast.error(r.error);
    else toast.success(`${r.ticker} added`);
    qc.invalidateQueries({ queryKey: ["portfolio"] });
  };

  return (
    <div className="space-y-8 animate-rise">
      <div className="editorial-masthead flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Your portfolio · {data.holdings.length} holdings</div>
          <h1 className="mt-1">Your portfolio</h1>
        </div>
        <div className="w-full sm:w-80">
          <CompanySearch onPick={onPick} placeholder="Add a holding…" />
          {adding && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Fetching {adding} from SEC EDGAR…
            </p>
          )}
        </div>
      </div>

      <HoldingsTable rows={data.holdings} quotes={quotes.data} quotesLoading={quotes.isLoading} />
      <div className="editorial-research grid items-start gap-8 lg:grid-cols-[3fr_2fr]">
        <EarningsDigestPanel tickers={tickers} />
        <MaterialEventsPanel tickers={tickers} />
      </div>
      <SharedRisksPanel tickers={tickers} />

      <div className="grid items-start gap-8 lg:grid-cols-[2fr_3fr]">
        <section className="editorial-section">
          <h2 className="text-2xl">Recent SEC filing activity</h2>
          <ul className="mt-4 divide-y">
            {data.recentFilings.length === 0 && <li className="py-3 text-sm text-muted-foreground">No filings yet.</li>}
            {data.recentFilings.map((f) => (
              <li key={f.accession} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="figure w-12 text-primary">{f.ticker}</span>
                <span className="w-14 rounded-sm bg-secondary px-1.5 py-0.5 text-center font-mono text-xs">{f.form}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{f.description ?? f.form}</span>
                <span className="figure text-xs text-muted-foreground">{formatDate(f.filing_date)}</span>
                <a
                  href={secDocUrl(f.cik, f.accession, f.primary_document)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open on SEC"
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </section>
        <DevelopmentsPanel />
      </div>
    </div>
  );
}

function HoldingsTable({
  rows,
  quotes,
  quotesLoading,
}: {
  rows: PortfolioRow[];
  quotes: { available: boolean; quotes: Record<string, { price: number; change: number; changePct: number; at: number } | null> } | undefined;
  quotesLoading: boolean;
}) {
  const latestAt = quotes?.available
    ? Math.max(0, ...Object.values(quotes.quotes).map((q) => q?.at ?? 0))
    : 0;
  return (
    <section className="overflow-hidden border-y bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="text-2xl">Holdings</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <EvidenceBadge kind="market" compact />
          {quotes?.available
            ? `Prices from Finnhub${latestAt ? ` · as of ${new Date(latestAt).toLocaleString()}` : ""}`
            : quotesLoading
              ? "Loading prices…"
              : "Prices temporarily unavailable"}
          <a href="https://finnhub.io/docs/api/quote" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
            Finnhub source <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="eyebrow border-b text-left">
              <th className="px-5 py-3 font-normal">Company</th>
              <th className="px-3 py-3 text-right font-normal">
                <span className="inline-flex items-center gap-1">
                  Price & day change <InfoTip term="price" title="Price and day change" />
                </span>
              </th>
              <th className="px-3 py-3 text-right font-normal">
                <span className="inline-flex items-center gap-1">
                  Revenue (latest qtr) <InfoTip term="revenue" title="Revenue" />
                </span>
              </th>
              <th className="px-3 py-3 font-normal">
                <span className="inline-flex items-center gap-1">
                  Operating margin <InfoTip term="operatingMargin" title="Operating margin" />
                </span>
              </th>
              <th className="px-3 py-3 font-normal">Latest filing</th>
              <th className="px-3 py-3 font-normal">Position</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <HoldingRow key={r.id} r={r} quote={quotes?.available ? (quotes.quotes[r.ticker] ?? null) : undefined} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HoldingRow({
  r,
  quote,
}: {
  r: PortfolioRow;
  quote: { price: number; change: number; changePct: number } | null | undefined;
}) {
  const qc = useQueryClient();
  const remove = useServerFn(removeHolding);
  const update = useServerFn(updateHolding);
  const [shares, setShares] = useState(r.shares?.toString() ?? "");
  const [avg, setAvg] = useState(r.avgPrice?.toString() ?? "");
  const cur = r.currency ?? "USD";
  const q = r.financials?.quarterly ?? [];
  const rev = latestWithYoY(q, "revenue");
  const opm = series(q, "operatingMargin").slice(-12);
  const opmLatest = latestWithYoY(q, "operatingMargin");
  const revChange = rev ? fmtChange(rev.value, rev.prior, "money") : null;

  return (
    <tr className="hover:bg-secondary/40">
      <td className="px-5 py-3">
        <Link to="/company/$ticker" params={{ ticker: r.ticker }} className="group flex items-center gap-3">
          <span className="figure w-14 font-medium text-primary group-hover:underline">{r.ticker}</span>
          <span className="max-w-56 truncate">{r.name}</span>
        </Link>
      </td>
      <td className="px-3 py-3 text-right">
        {quote ? (
          <div>
            <div className="figure">{formatPrice(quote.price)}</div>
            <div className="figure whitespace-nowrap text-xs text-muted-foreground">
              {quote.change >= 0 ? "+" : "−"}{formatPrice(Math.abs(quote.change))}
              {" ("}{quote.changePct >= 0 ? "+" : ""}{quote.changePct.toFixed(1)}%{ ")"}
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Not reported</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="figure">{fmtValue(rev?.value, "money", cur)}</div>
        <div className="text-xs text-muted-foreground">
          {rev?.row.label}
          {revChange && <span className="figure"> · {revChange} YoY</span>}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <Sparkline values={opm.map((p) => p.value)} className="text-chart-1" width={72} height={22} />
          <span className="figure text-xs">{fmtValue(opmLatest?.value, "ratio", cur)}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        {r.latestFiling ? (
          <a
            href={secDocUrl(r.cik, r.latestFiling.accession, r.latestFiling.primary_document)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
          >
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-foreground">{r.latestFiling.form}</span>
            {formatDate(r.latestFiling.filing_date)}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {r.shares ? (
          <span className="figure">
            {r.shares} sh{r.avgPrice ? ` @ ${formatPrice(r.avgPrice)}` : ""}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-1">
          <Popover>
            <PopoverTrigger aria-label={`Edit ${r.ticker} position`} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Pencil className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3">
              <div className="text-sm font-medium">{r.ticker} position (optional)</div>
              <Input placeholder="Shares" inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} />
              <Input placeholder="Average purchase price" inputMode="decimal" value={avg} onChange={(e) => setAvg(e.target.value)} />
              <Button
                size="sm"
                className="w-full"
                onClick={async () => {
                  const s = parseFloat(shares);
                  const a = parseFloat(avg);
                  try {
                    await update({ data: { id: r.id, shares: s > 0 ? s : null, avgPrice: a > 0 ? a : null } });
                    toast.success("Position saved");
                    qc.invalidateQueries({ queryKey: ["portfolio"] });
                  } catch {
                    toast.error("Couldn’t save position");
                  }
                }}
              >
                Save
              </Button>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label={`Remove ${r.ticker}`}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
            onClick={async () => {
              await remove({ data: { id: r.id } });
              qc.invalidateQueries({ queryKey: ["portfolio"] });
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

