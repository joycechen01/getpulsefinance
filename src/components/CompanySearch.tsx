import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { searchQuery } from "@/lib/edgar-queries";
import { cn } from "@/lib/utils";

export function CompanySearch({
  onPick,
  placeholder = "Search a company or ticker — e.g. Nvidia, CRWD",
  quick = [],
}: {
  onPick?: (ticker: string) => void;
  placeholder?: string;
  quick?: string[];
}) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 150);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const { data: results = [], isFetching } = useQuery(searchQuery(debounced));

  const go = (ticker: string) => {
    setOpen(false);
    setText("");
    if (onPick) onPick(ticker);
    else navigate({ to: "/company/$ticker", params: { ticker } });
  };

  return (
    <div className="w-full">
      <div ref={boxRef} className="relative">
        <label htmlFor="company-search" className="sr-only">
          Search a company or ticker
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="company-search"
          value={text}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              const pick = results[active]?.ticker ?? (text.trim() ? text.trim() : null);
              if (pick) go(pick.toUpperCase());
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-11 w-full rounded-md border border-input bg-surface pr-4 pl-10 text-sm shadow-card outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/25"
        />
        {open && debounced && (
          <ul
            role="listbox"
            className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-md border border-input bg-popover shadow-pop"
          >
            {results.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                {isFetching ? "Searching EDGAR…" : "No matching companies"}
              </li>
            )}
            {results.map((r, i) => (
              <li
                key={r.cik}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(r.ticker);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm",
                  i === active && "bg-accent",
                )}
              >
                <span className="figure w-16 shrink-0 font-medium text-primary">{r.ticker}</span>
                <span className="truncate">{r.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {quick.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1">Try</span>
          {quick.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => go(t)}
              className={cn(
                "rounded-sm border border-input px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
