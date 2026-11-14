import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import type { MetricKey, PeriodRow } from "@/lib/edgar-parse";
import { formatDate, formatMoney, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export type MetricConfig = {
  key: MetricKey;
  title: string;
  kind: "bar" | "area";
  color: string;
  note: string;
};

function ChartTooltip({
  active,
  payload,
  metric,
  currency,
}: TooltipProps<number, string> & { metric: MetricConfig; currency: string }) {
  const row = payload?.[0]?.payload as PeriodRow | undefined;
  if (!active || !row) return null;
  const value = row[metric.key];
  const growth = formatPct(row[`${metric.key}YoY` as const]);
  const derived =
    metric.key !== "assets" && row[`${metric.key}Derived` as "revenueDerived" | "netIncomeDerived"];
  return (
    <div className="min-w-44 rounded-md border border-input bg-popover px-3 py-2.5 shadow-pop">
      <div className="eyebrow">{row.label}</div>
      <div className="figure mt-1 text-lg font-medium">{formatMoney(value, currency)}</div>
      {growth && (
        <div
          className={cn(
            "figure text-xs",
            (row[`${metric.key}YoY` as const] ?? 0) >= 0 ? "text-positive" : "text-destructive",
          )}
        >
          {growth} vs. prior year
        </div>
      )}
      <div className="mt-1.5 text-xs text-muted-foreground">
        {metric.key === "assets" ? "As of " : "Period ended "}
        {formatDate(row.end)}
      </div>
      {derived && (
        <div className="mt-1 text-xs text-muted-foreground italic">
          Derived: full year minus Q1–Q3
        </div>
      )}
    </div>
  );
}

export function MetricChart({
  data,
  metric,
  currency,
  syncId,
}: {
  data: PeriodRow[];
  metric: MetricConfig;
  currency: string;
  syncId: string;
}) {
  const axisFmt = (v: number) => formatMoney(v, currency, 0);
  const hasNegative = data.some((r) => (r[metric.key] ?? 0) < 0);
  const common = {
    data,
    syncId,
    margin: { top: 8, right: 4, bottom: 0, left: 0 },
  };
  const axes = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="2 4" />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        minTickGap={18}
        tickMargin={8}
      />
      <YAxis
        tickFormatter={axisFmt}
        tickLine={false}
        axisLine={false}
        width={64}
        tickCount={5}
      />
      <Tooltip
        cursor={{ fill: "var(--color-accent)", opacity: 0.6, stroke: "var(--color-rule)", strokeOpacity: 0.3 }}
        content={<ChartTooltip metric={metric} currency={currency} />}
      />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height={260}>
      {metric.kind === "bar" ? (
        <BarChart {...common} barCategoryGap="18%">
          {axes}
          {hasNegative && <ReferenceLine y={0} stroke="var(--color-rule)" strokeOpacity={0.5} />}
          <Bar dataKey={metric.key} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={500}>
            {data.map((r) => {
              const v = r[metric.key] ?? 0;
              const derived =
                metric.key !== "assets" &&
                r[`${metric.key}Derived` as "revenueDerived" | "netIncomeDerived"];
              return (
                <Cell
                  key={r.key}
                  fill={v < 0 ? "var(--color-destructive)" : metric.color}
                  fillOpacity={derived ? 0.6 : 1}
                />
              );
            })}
          </Bar>
        </BarChart>
      ) : (
        <AreaChart {...common}>
          <defs>
            <linearGradient id={`fill-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metric.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={metric.color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {axes}
          <Area
            type="monotone"
            dataKey={metric.key}
            stroke={metric.color}
            strokeWidth={2}
            fill={`url(#fill-${metric.key})`}
            connectNulls
            activeDot={{ r: 4, stroke: "var(--color-card)", strokeWidth: 2 }}
            animationDuration={500}
          />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}
