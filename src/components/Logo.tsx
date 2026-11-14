export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg viewBox="0 0 24 24" className="size-5 text-primary" aria-hidden>
        <path
          d="M2 12h4l2.5-6 4 12 3-9 2 3H22"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-xl tracking-tight">Pulse Finance</span>
    </span>
  );
}
