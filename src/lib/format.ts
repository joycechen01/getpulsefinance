export function formatMoney(v: number | null | undefined, currency: string, digits = 2) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(v);
}

export function formatPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return null;
  const s = (v * 100).toFixed(Math.abs(v) >= 1 ? 0 : 1);
  return `${v > 0 ? "+" : ""}${s}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (m: number) => MONTHS[(m - 1 + 12) % 12];

export function formatDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}
