import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { getCompanyNews } from "@/lib/news.functions";
import { formatDate } from "@/lib/format";

export function NewsPanel({ ticker, name }: { ticker: string; name: string }) {
  const q = useQuery({ queryKey: ["company-news", ticker], queryFn: () => getCompanyNews({ data: { ticker } }), staleTime: 15 * 60 * 1000, retry: false });
  return (
    <section className="space-y-4">
      <div>
        <h2>News</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Recent headlines about {name} from the past 30 days, via Finnhub. Outside news, not SEC evidence — open the original article to read it in full.
        </p>
      </div>
      {q.isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded bg-muted" />)}</div>
      ) : !q.data?.ok ? (
        <p className="text-sm text-muted-foreground">{q.data?.error ?? "News couldn't be loaded."}</p>
      ) : !q.data.items.length ? (
        <p className="text-sm text-muted-foreground">No news headlines were found for the past 30 days.</p>
      ) : (
        <ul className="divide-y border-y">
          {q.data.items.map((n) => (
            <li key={n.id} className="py-4">
              <a href={n.url} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-2 font-medium text-foreground hover:text-primary">
                {n.headline}
                <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
              </a>
              <div className="mt-1 text-xs text-muted-foreground">
                {n.source || "Unknown publisher"} · {formatDate(new Date(n.at).toISOString().slice(0, 10))} · <span className="rounded border px-1.5 py-0.5">Outside news</span>
              </div>
              {n.summary && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{n.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
