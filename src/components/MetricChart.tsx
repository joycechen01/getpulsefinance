import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import type { SeriesPoint } from "@/lib/metrics";
import { formatDate } from "@/lib/format";

export type ChartPoint = SeriesPoint & { change: string | null };

function ChartTooltip({
  active,
  payload,
  fmt,
}: TooltipProps<number, string> & { fmt: (v: number | null) => string }) {
  const p = payload?.[0]?.payload as ChartPoint | undefined;
  if (!active || !p) return null;
  return (
    <div className="min-w-44 rounded-md border border-input bg-popover px-3 py-2.5 shadow-pop">
      <div className="eyebrow">{p.label}</div>
      <div className="figure mt-1 text-lg">{p.value == null ? "Not reported" : fmt(p.value)}</div>
      {p.change && <div className="figure text-xs text-muted-foreground">{p.change} vs. year ago</div>}
      <div className="mt-1.5 text-xs text-muted-foreground">Period ended {formatDate(p.end)}</div>
      {p.derived && (
        <div className="mt-1 text-xs text-muted-foreground italic">Derived from year-to-date / full-year totals</div>
      )}
    </div>
  );
}

export function MetricChart({
  data,
  kind,
  fmt,
  axisFmt,
  color = "var(--color-chart-1)",
  height = 240,
}: {
  data: ChartPoint[];
  kind: "bar" | "line";
  fmt: (v: number | null) => string;
  axisFmt: (v: number) => string;
  color?: string;
  height?: number;
}) {
  const hasNeg = data.some((d) => (d.value ?? 0) < 0);
  // Recharts 2 ignores children wrapped in fragments, so these are a keyed array.
  const common = [
    <CartesianGrid key="g" vertical={false} strokeDasharray="2 4" />,
    <XAxis key="x" dataKey="label" tickLine={false} axisLine={false} minTickGap={18} tickMargin={8} />,
    <YAxis key="y" tickFormatter={axisFmt} tickLine={false} axisLine={false} width={64} tickCount={5} />,
    <Tooltip
      key="t"
      cursor={{ fill: "var(--color-accent)", fillOpacity: 0.5, stroke: "var(--color-rule)" }}
      content={<ChartTooltip fmt={fmt} />}
    />,
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      {kind === "bar" ? (
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
          {common}
          {hasNeg && <ReferenceLine y={0} stroke="var(--color-rule)" />}
          <Bar dataKey="value" radius={[2, 2, 0, 0]} animationDuration={450}>
            {data.map((d) => (
              <Cell
                key={d.label}
                fill={(d.value ?? 0) < 0 ? "var(--color-negative)" : color}
                fillOpacity={d.derived ? 0.55 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      ) : (
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {common}
          {hasNeg && <ReferenceLine y={0} stroke="var(--color-rule)" />}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            connectNulls
            activeDot={{ r: 4, stroke: "var(--color-card)", strokeWidth: 2 }}
            animationDuration={450}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
