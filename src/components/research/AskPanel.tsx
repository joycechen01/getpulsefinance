import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";

import { EvidenceBadge } from "@/components/EvidenceBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askCompany, type AnswerResult } from "@/lib/analysis.functions";

import { CitationItem } from "./SignalCard";

const SUGGESTIONS = [
  "What are the main supply chain risks?",
  "How does management explain the change in margins?",
  "Who does the company say it competes with?",
  "Are there any legal or regulatory investigations?",
];

export function AskPanel({ ticker, name }: { ticker: string; name: string }) {
  const ask = useServerFn(askCompany);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<(AnswerResult & { question: string }) | null>(null);

  const run = async (question: string) => {
    if (question.trim().length < 3 || busy) return;
    setQ(question);
    setBusy(true);
    try {
      const r = await ask({ data: { ticker, question } });
      setRes({ ...r, question });
    } catch {
      setRes({ ok: false, error: "The answer couldn’t be prepared. Please try again.", question });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <form
        className="panel space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run(q);
        }}
      >
        <label htmlFor="ask" className="eyebrow block">
          Ask about {name}’s filings
        </label>
        <Textarea
          id="ask"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="e.g. What does the company say about customer concentration?"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void run(q);
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void run(s)}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
            >
              {s}
            </button>
          ))}
          <Button type="submit" className="ml-auto" disabled={busy || q.trim().length < 3}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} Ask
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Answers use only risk factors, MD&A, competition and 8-K text from recent filings, with citations. No buy or sell
          advice.
        </p>
      </form>

      {busy && (
        <div className="panel flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Searching filings and preparing an answer…
        </div>
      )}
      {!busy && res && (
        <section className="panel p-5" aria-live="polite">
          <div className="eyebrow mb-2">{res.question}</div>
          {!res.ok ? (
            <p className="text-sm text-destructive">{res.error}</p>
          ) : (
            <>
              <div className="mb-3">
                <EvidenceBadge kind="ai" />
              </div>
              <p className="whitespace-pre-line leading-relaxed">
                {res.answer.split(/(\[S\d+(?:,\s*S\d+)*\])/g).map((part, i) =>
                  /^\[S\d+/.test(part) ? (
                    <sup key={i} className="mx-0.5 font-mono text-[10px] text-primary">
                      {part.replace(/[[\]\s]/g, "")}
                    </sup>
                  ) : (
                    <span key={i}>{part}</span>
                  ),
                )}
              </p>
              <p className="mt-4 border-t pt-3 text-sm">
                <span className="text-muted-foreground">What remains uncertain: </span>
                {res.uncertain}
              </p>
              {res.citations.length > 0 && (
                <div className="mt-4">
                  <div className="eyebrow mb-2">Sources</div>
                  <ul className="space-y-2">
                    {res.citations.map((c) => (
                      <CitationItem key={c.ref} c={c} label={c.ref} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
