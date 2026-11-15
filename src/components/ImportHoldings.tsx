import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format";
import { addHolding } from "@/lib/portfolio.functions";
import { parsePortfolioCsv, type ImportRow, type ParsedImport } from "@/lib/portfolio-csv";
import { cn } from "@/lib/utils";

const SAMPLE_CSV = "Symbol,Shares,Average Cost\nNVDA,10,120.50\nCRWD,5,\nINTC,,\n";
const MAX_FILE_BYTES = 1_000_000;

type Failure = { ticker: string; error: string };

/** Imports holdings from a brokerage export or simple CSV, previewing rows before anything is saved. */
export function ImportHoldings({ held, className }: { held: string[]; className?: string }) {
  const qc = useQueryClient();
  const add = useServerFn(addHolding);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [progress, setProgress] = useState<{ done: number; current: string } | null>(null);
  const [failures, setFailures] = useState<Failure[] | null>(null);
  const importing = progress != null;
  const heldSet = new Set(held);

  const reset = () => {
    setFileName("");
    setParsed(null);
    setProgress(null);
    setFailures(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFailures(null);
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setParsed({
        rows: [],
        skipped: [],
        error: "This file is larger than 1 MB. Export positions only.",
      });
      return;
    }
    setParsed(parsePortfolioCsv(await file.text()));
  };

  const runImport = async (rows: ImportRow[]) => {
    const failed: Failure[] = [];
    for (const [i, r] of rows.entries()) {
      setProgress({ done: i, current: r.ticker });
      // Omit missing position fields so an existing holding keeps its saved position.
      const res = await add({
        data: {
          ticker: r.ticker,
          ...(r.shares != null && { shares: r.shares }),
          ...(r.avgPrice != null && { avgPrice: r.avgPrice }),
        },
      }).catch(() => null);
      if (!res?.ok)
        failed.push({ ticker: r.ticker, error: res?.error ?? "Couldn’t save this holding." });
    }
    setProgress(null);
    setFailures(failed);
    await qc.invalidateQueries({ queryKey: ["portfolio"] });
    const saved = rows.length - failed.length;
    if (saved) toast.success(`Imported ${saved} ${saved === 1 ? "holding" : "holdings"}`);
  };

  const rows = parsed?.rows ?? [];
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (importing) return;
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <FileUp /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import holdings from CSV</DialogTitle>
          <DialogDescription>
            Use a positions export from your brokerage, or any file with a Symbol or Ticker column.
            Shares and average cost are optional. Nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>

        {failures ? (
          <ImportSummary total={rows.length} failures={failures} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                disabled={importing}
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
              >
                <FileUp /> {fileName ? "Choose another file" : "Choose file"}
              </Button>
              {fileName && (
                <span className="min-w-0 truncate text-xs text-muted-foreground">{fileName}</span>
              )}
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`}
                download="pulse-portfolio-sample.csv"
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <Download className="size-3" /> Sample CSV
              </a>
            </div>

            {parsed?.error && (
              <p role="alert" className="text-sm text-destructive">
                {parsed.error}
              </p>
            )}

            {rows.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="eyebrow border-b text-left">
                      <th className="px-3 py-2 font-normal">Ticker</th>
                      <th className="px-3 py-2 text-right font-normal">Shares</th>
                      <th className="px-3 py-2 text-right font-normal">Avg cost</th>
                      <th className="px-3 py-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r, i) => (
                      <tr
                        key={r.ticker}
                        className={cn(progress?.current === r.ticker && "bg-secondary/60")}
                      >
                        <td className="figure px-3 py-1.5 text-primary">{r.ticker}</td>
                        <td className="figure px-3 py-1.5 text-right">
                          {r.shares?.toLocaleString("en-US") ?? "—"}
                        </td>
                        <td className="figure px-3 py-1.5 text-right">{formatPrice(r.avgPrice)}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {progress && i < progress.done
                            ? "Done"
                            : progress?.current === r.ticker
                              ? "Adding…"
                              : !heldSet.has(r.ticker)
                                ? "New"
                                : r.shares != null || r.avgPrice != null
                                  ? "Updates position"
                                  : "Already held"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {parsed && parsed.skipped.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  {parsed.skipped.length} {parsed.skipped.length === 1 ? "line" : "lines"} skipped
                  (no valid ticker)
                </summary>
                <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                  {parsed.skipped.map((s) => (
                    <li key={s.line} className="truncate">
                      Line {s.line}: {s.text || "(blank)"}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <DialogFooter>
          {failures ? (
            <Button
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Done
            </Button>
          ) : (
            <Button disabled={!rows.length || importing} onClick={() => runImport(rows)}>
              {importing ? (
                <>
                  <Loader2 className="animate-spin" /> Adding {progress.current} (
                  {progress.done + 1} of {rows.length})
                </>
              ) : rows.length ? (
                `Import ${rows.length} ${rows.length === 1 ? "holding" : "holdings"}`
              ) : (
                "Import holdings"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportSummary({ total, failures }: { total: number; failures: Failure[] }) {
  const saved = total - failures.length;
  return (
    <div className="space-y-3 text-sm">
      <p>
        {saved} of {total} {total === 1 ? "holding" : "holdings"} imported.
        {failures.length > 0 && " These couldn’t be added:"}
      </p>
      {failures.length > 0 && (
        <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
          {failures.map((f) => (
            <li key={f.ticker} className="flex gap-3 px-3 py-2">
              <span className="figure w-16 shrink-0 text-primary">{f.ticker}</span>
              <span className="text-muted-foreground">{f.error}</span>
            </li>
          ))}
        </ul>
      )}
      {failures.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Mutual funds and cash positions usually aren’t in the SEC’s company list, so they can’t be
          added.
        </p>
      )}
    </div>
  );
}
