import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Radar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getCompanySignals } from "@/lib/analysis.functions";
import { portfolioSignalsQuery } from "@/lib/edgar-queries";

import { SignalCard } from "./SignalCard";

export function DevelopmentsPanel() {
  const qc = useQueryClient();
  const q = useQuery(portfolioSignalsQuery());
  const analyze = useServerFn(getCompanySignals);
  const [scanning, setScanning] = useState<string | null>(null);

  const scan = async () => {
    for (const t of q.data?.pending ?? []) {
      setScanning(t);
      const r = await analyze({ data: { ticker: t } }).catch(() => null);
      if (r && !r.ok) {
        toast.error(`${t}: ${r.error}`);
        if (/credits|blocked/i.test(r.error)) break;
      }
      await qc.invalidateQueries({ queryKey: ["portfolio-signals"] });
    }
    setScanning(null);
  };

  const pending = q.data?.pending ?? [];
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">Developments to watch</h2>
        {pending.length > 0 && (
          <Button size="sm" variant="outline" onClick={scan} disabled={!!scanning}>
            {scanning ? <Loader2 className="animate-spin" /> : <Radar />}
            {scanning ? `Reading ${scanning}…` : `Scan latest filings (${pending.length})`}
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Material developments detected in each holding’s latest 10-K or 10-Q and recent 8-Ks. Filing alone never triggers
        an alert.
      </p>
      <div className="mt-4 space-y-3">
        {q.isLoading ? (
          <div className="h-24 animate-pulse rounded-md bg-muted" />
        ) : !q.data?.signals.length ? (
          <p className="text-sm text-muted-foreground">
            {pending.length
              ? "Your holdings’ latest filings haven’t been analysed yet. Run a scan to check them."
              : "No material developments detected in your holdings’ latest filings."}
          </p>
        ) : (
          q.data.signals.slice(0, 8).map((s) => <SignalCard key={s.id} s={s} showTicker />)
        )}
      </div>
    </section>
  );
}
