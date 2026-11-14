import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { signalsQuery } from "@/lib/edgar-queries";

import { SignalCard } from "./SignalCard";

export function SignalsPanel({ ticker }: { ticker: string }) {
  const q = useQuery(signalsQuery(ticker));
  if (q.isLoading)
    return (
      <div className="panel flex items-center gap-3 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Checking the latest filing for material developments… the first analysis of a
        filing can take a minute.
      </div>
    );
  if (!q.data?.ok) return <div className="panel p-6 text-sm text-muted-foreground">{q.data?.error ?? "Couldn’t load signals."}</div>;
  if (!q.data.signals.length)
    return (
      <div className="panel p-6 text-sm text-muted-foreground">
        No material developments were detected in the latest filing compared with prior disclosures. Routine disclosures
        aren’t flagged.
      </div>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {q.data.signals.map((s) => (
        <SignalCard key={s.id} s={s} />
      ))}
    </div>
  );
}
