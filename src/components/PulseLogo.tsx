import { useState } from "react";

type PulseLogoProps = {
  /** Height of the mark in px. The wordmark scales with it. */
  size?: number;
  /** Stroke color of the pulse line. Swap for your accent token. */
  color?: string;
  /** Show "Pulse Finance" next to the mark. */
  showWordmark?: boolean;
  /** Repeat the draw animation every 4s instead of once. */
  loop?: boolean;
  className?: string;
};

const PATH = "M3 16H11L14 8L18 24L21 16H29";

const styles = `
@keyframes pulse-logo-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes pulse-logo-beat { 0% { stroke-dashoffset: 1; } 28%, 100% { stroke-dashoffset: 0; } }
.pulse-logo-line { stroke-dasharray: 1; stroke-dashoffset: 0; }
.pulse-logo-once .pulse-logo-line { animation: pulse-logo-draw 900ms cubic-bezier(.65,0,.35,1) both; }
.pulse-logo-loop .pulse-logo-line { animation: pulse-logo-beat 4s cubic-bezier(.65,0,.35,1) infinite; }
@media (prefers-reduced-motion: reduce) { .pulse-logo-line { animation: none !important; } }
`;

export function PulseLogo({
  size = 28,
  color = "#1C5B3C",
  showWordmark = true,
  loop = false,
  className = "",
}: PulseLogoProps) {
  // Changing the key remounts the SVG, which restarts the draw animation on hover.
  const [run, setRun] = useState(0);

  return (
    <span
      className={`${loop ? "pulse-logo-loop" : "pulse-logo-once"} ${className}`}
      onMouseEnter={() => !loop && setRun((n) => n + 1)}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3 }}
    >
      <style>{styles}</style>
      <svg
        key={run}
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        role="img"
        aria-label="Pulse Finance"
      >
        {/* Faint base line so the mark never disappears mid-animation */}
        <path
          d={PATH}
          stroke={color}
          strokeOpacity={0.22}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="pulse-logo-line"
          pathLength={1}
          d={PATH}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span
          style={{
            fontSize: size * 0.64,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          Pulse Finance
        </span>
      )}
    </span>
  );
}

export default PulseLogo;
