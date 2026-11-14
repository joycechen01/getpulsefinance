/** Tiny SSR-safe trend line. Gaps (null) break the line. */
export function Sparkline({
  values,
  className,
  width = 120,
  height = 32,
}: {
  values: (number | null)[];
  className?: string;
  width?: number;
  height?: number;
}) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return <div style={{ width, height }} aria-hidden />;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    const x = i * step;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });
  let lastIdx = values.length - 1;
  while (lastIdx > 0 && values[lastIdx] == null) lastIdx--;
  const last = values[lastIdx]!;
  const ly = height - 2 - ((last - min) / span) * (height - 4);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      {min < 0 && max > 0 && (
        <line
          x1={0}
          x2={width}
          y1={height - 2 - ((0 - min) / span) * (height - 4)}
          y2={height - 2 - ((0 - min) / span) * (height - 4)}
          stroke="var(--color-rule)"
          strokeDasharray="2 3"
        />
      )}
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={lastIdx * step} cy={ly} r={2.5} fill="currentColor" />
    </svg>
  );
}
