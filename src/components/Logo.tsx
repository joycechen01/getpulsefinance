export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap ${className ?? ""}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28" fill="none" role="img" aria-label="Pulse Finance" className="text-teal">
        <path d="M3 16H11L14 8L18 24L21 16H29" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-[20px] text-foreground"><span className="font-medium">Pulse</span> <span className="font-normal">Finance</span></span>
    </span>
  );
}
