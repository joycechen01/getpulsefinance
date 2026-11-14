import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { EvidenceBadge } from "@/components/EvidenceBadge";
import { InfoTip } from "@/components/InfoTip";
import { Segmented } from "@/components/Segmented";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { changesQuery } from "@/lib/edgar-queries";
import { SECTION_LABEL } from "@/lib/filing-sections";
import { formatDate } from "@/lib/format";
import { CHANGE_TAGS } from "@/lib/glossary";
import type { Change, ChangeTag } from "@/lib/redline";
import { cn } from "@/lib/utils";

const TAG_TONE: Record<ChangeTag, string> = {
  new: "text-surface border-teal bg-teal",
  expanded: "text-accent-foreground border-accent bg-accent",
  removed: "text-foreground border-foreground bg-surface",
  reworded: "text-muted-foreground border-transparent bg-transparent",
};

type Sec = "all" | "risk" | "mdna" | "competition";

export function RedlineView({ ticker }: { ticker: string }) {
  const q = useQuery(changesQuery(ticker));
  const [sec, setSec] = useState<Sec>("all");
  const [showReworded, setShowReworded] = useState(false);
  const [limit, setLimit] = useState(25);

  const changes = q.data?.ok ? q.data.changes : [];
  const counts = useMemo(() => {
    const c: Record<ChangeTag, number> = { new: 0, expanded: 0, removed: 0, reworded: 0 };
    for (const x of changes) if (sec === "all" || x.section === sec) c[x.tag]++;
    return c;
  }, [changes, sec]);
  const visible = changes.filter((c) => (sec === "all" || c.section === sec) && (showReworded || c.tag !== "reworded"));
  const sections = [...new Set(changes.map((c) => c.section))];

  if (q.isLoading)
    return (
      <div className="panel flex items-center gap-3 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Reading the latest filing and the prior comparable one from SEC EDGAR… this
        can take up to a minute the first time.
      </div>
    );
  if (!q.data?.ok)
    return <div className="panel p-6 text-sm text-muted-foreground">{q.data?.error ?? "Couldn’t load the filing comparison."}</div>;
  const { current, prior } = q.data;

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="text-sm">
          <div className="eyebrow mb-1">Comparing</div>
          <FilingLink f={current} /> <span className="text-muted-foreground">with</span> <FilingLink f={prior} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Segmented
            label="Section"
            value={sec}
            onChange={setSec}
            options={[
              { value: "all", label: "All" },
              ...(sections.includes("risk") ? [{ value: "risk" as const, label: "Risk factors" }] : []),
              ...(sections.includes("mdna") ? [{ value: "mdna" as const, label: "MD&A" }] : []),
              ...(sections.includes("competition") ? [{ value: "competition" as const, label: "Competition" }] : []),
            ]}
          />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showReworded} onCheckedChange={setShowReworded} /> Show reworded ({counts.reworded})
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(["new", "expanded", "removed"] as const).map((t) => (
          <span key={t} className="inline-flex items-center gap-1">
            <TagPill tag={t} /> <span className="font-mono">{counts[t]}</span>
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          Change tags <EvidenceBadge kind="calc" compact /> · text <EvidenceBadge kind="fact" compact />
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="panel p-6 text-sm text-muted-foreground">No material changes in this section between the two filings.</div>
      ) : (
        <ul className="space-y-3">
          {visible.slice(0, limit).map((c, i) => (
            <ChangeRow key={`${c.section}-${c.tag}-${c.pos ?? "x"}-${c.priorPos ?? "x"}-${i}`} c={c} />
          ))}
        </ul>
      )}
      {visible.length > limit && (
        <Button variant="outline" onClick={() => setLimit((l) => l + 25)}>
          Show more ({visible.length - limit} left)
        </Button>
      )}
    </div>
  );
}

function FilingLink({ f }: { f: { form: string; filing_date: string; url: string | null } }) {
  const label = `${f.form} filed ${formatDate(f.filing_date)}`;
  return f.url ? (
    <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-primary">
      {label} <ExternalLink className="size-3" />
    </a>
  ) : (
    <span className="font-medium">{label}</span>
  );
}

function TagPill({ tag }: { tag: ChangeTag }) {
  const t = CHANGE_TAGS[tag];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("rounded-sm border px-1.5 py-px font-mono text-[10px] uppercase", TAG_TONE[tag])}>{t.label}</span>
      <InfoTip title={t.label} text={t.text} />
    </span>
  );
}

function Highlighted({ text, added }: { text: string; added: string[] }) {
  if (!added.length) return <>{text}</>;
  const parts = text.split(/(?<=[.!?])\s+/);
  const set = new Set(added);
  return (
    <>
      {parts.map((p, i) =>
        set.has(p) ? (
          <mark key={i} className="rounded-sm bg-accent px-0.5 text-foreground">
            {p}{" "}
          </mark>
        ) : (
          <span key={i}>{p} </span>
        ),
      )}
    </>
  );
}

function ChangeRow({ c }: { c: Change }) {
  return (
    <li className="panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <TagPill tag={c.tag} />
        <span className="text-xs text-muted-foreground">{SECTION_LABEL[c.section as keyof typeof SECTION_LABEL]}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="eyebrow mb-1">Prior filing</div>
          {c.priorText ? (
            <p className={cn("text-sm leading-relaxed text-muted-foreground", c.tag === "removed" && "line-through decoration-foreground")}>
              {c.priorText}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">Not present</p>
          )}
        </div>
        <div>
          <div className="eyebrow mb-1">Latest filing</div>
          {c.text ? (
            <p className="text-sm leading-relaxed">
              {c.tag === "new" ? <mark className="rounded-sm bg-accent text-foreground">{c.text}</mark> : <Highlighted text={c.text} added={c.added} />}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">Removed</p>
          )}
        </div>
      </div>
    </li>
  );
}
