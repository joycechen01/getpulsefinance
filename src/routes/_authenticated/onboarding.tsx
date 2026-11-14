import { useQueryClient, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CompanySearch } from "@/components/CompanySearch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { portfolioQuery } from "@/lib/edgar-queries";
import { addHolding, loadDemoPortfolio, removeHolding } from "@/lib/portfolio.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [
    { title: "Set up your portfolio — Pulse Finance" },
    { name: "description", content: "Choose the companies you own to follow their SEC filings with Pulse Finance." },
    { property: "og:title", content: "Set up your portfolio — Pulse Finance" },
    { property: "og:description", content: "Choose the companies you own to follow their SEC filings with Pulse Finance." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Onboarding,
});

function Onboarding() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery(portfolioQuery());
  const add = useServerFn(addHolding);
  const demo = useServerFn(loadDemoPortfolio);
  const remove = useServerFn(removeHolding);
  const [busy, setBusy] = useState<string | null>(null);

  const finish = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) await supabase.from("profiles").update({ onboarded: true }).eq("id", u.user.id);
    await qc.invalidateQueries({ queryKey: ["profile"] });
    navigate({ to: "/home" });
  };

  const onPick = async (ticker: string) => {
    setBusy(ticker);
    const r = await add({ data: { ticker } });
    setBusy(null);
    if (!r.ok) toast.error(r.error);
    await qc.invalidateQueries({ queryKey: ["portfolio"] });
  };

  const loadDemo = async () => {
    setBusy("demo");
    const res = await demo();
    setBusy(null);
    const failed = res.filter((r) => !r.ok);
    if (failed.length) toast.error(`Couldn’t add ${failed.map((f) => f.ticker).join(", ")}`);
    await qc.invalidateQueries({ queryKey: ["portfolio"] });
  };

  const holdings = data?.holdings ?? [];
  return (
    <div className="mx-auto max-w-xl animate-rise py-6">
      <div className="eyebrow">Step 1 of 1</div>
      <h1 className="mt-2 text-4xl">Which companies do you own?</h1>
      <p className="mt-2 text-muted-foreground">
        Add the stocks in your portfolio. Pulse Finance will pull each company’s SEC filings and financials.
      </p>
      <div className="mt-6">
        <CompanySearch onPick={onPick} placeholder="Add a ticker or company name…" />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline" onClick={loadDemo} disabled={!!busy}>
          {busy === "demo" ? <Loader2 className="animate-spin" /> : <Sparkles />} Load demo portfolio
        </Button>
        <span className="text-xs text-muted-foreground">NVDA, CRWD, INTC, TSLA</span>
      </div>

      <ul className="mt-6 divide-y rounded-lg border bg-card">
        {holdings.length === 0 && !busy && (
          <li className="p-4 text-sm text-muted-foreground">No companies yet.</li>
        )}
        {holdings.map((h) => (
          <li key={h.id} className="flex items-center gap-3 px-4 py-3">
            <span className="figure w-14 text-primary">{h.ticker}</span>
            <span className="truncate text-sm">{h.name}</span>
            <button
              type="button"
              aria-label={`Remove ${h.ticker}`}
              className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={async () => {
                await remove({ data: { id: h.id } });
                await qc.invalidateQueries({ queryKey: ["portfolio"] });
              }}
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
        {busy && busy !== "demo" && (
          <li className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Fetching {busy} from SEC EDGAR…
          </li>
        )}
        {busy === "demo" && (
          <li className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Fetching four companies from SEC EDGAR…
          </li>
        )}
      </ul>
      <div className="mt-6 flex justify-end">
        <Button onClick={finish} disabled={holdings.length === 0 || !!busy}>
          Go to my portfolio
        </Button>
      </div>
    </div>
  );
}
