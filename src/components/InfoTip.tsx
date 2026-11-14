import { Info } from "lucide-react";
import { useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

type Props =
  | { term: GlossaryKey; title: string; text?: never }
  | { term?: never; title: string; text: string };

/** Info icon: opens on hover (desktop), tap (mobile) and keyboard focus. */
export function InfoTip({ term, title, text }: Props) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entry = term ? GLOSSARY[term] : null;
  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label={`About ${title}`}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && hide()}
        onFocus={show}
        onBlur={hide}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Info className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-72 space-y-2 border-input p-3.5 text-sm shadow-pop"
        onPointerEnter={show}
        onPointerLeave={hide}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="font-medium">{title}</div>
        {entry ? (
          <dl className="space-y-1.5 text-muted-foreground">
            <div>
              <dt className="eyebrow">What it is</dt>
              <dd className="text-foreground/90">{entry.what}</dd>
            </div>
            <div>
              <dt className="eyebrow">Why it matters</dt>
              <dd className="text-foreground/90">{entry.why}</dd>
            </div>
            <div>
              <dt className="eyebrow">How it’s calculated</dt>
              <dd className="text-foreground/90">{entry.how}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-foreground/90">{text}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
