export function formatMoney(v: number | null | undefined, currency = "USD", digits = 2) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(v);
}

export function formatPrice(v: number | null | undefined, currency = "USD") {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
}

export function formatShares(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(v);
}

/** Ratio (0.42) -> "42.0%". */
export function formatRatio(v: number | null | undefined, digits = 1) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return null;
  const s = (v * 100).toFixed(Math.abs(v) >= 1 ? 0 : 1);
  return `${v > 0 ? "+" : ""}${s}%`;
}

/** Percentage-point change for ratios. */
export function formatPts(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return null;
  const s = (v * 100).toFixed(1);
  return `${v > 0 ? "+" : ""}${s} pts`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (m: number) => MONTHS[(m - 1 + 12) % 12];

export function formatDate(d: string | null | undefined) {
  if (!d) return "";
  const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
  return `${MONTHS[m - 1] ?? ""} ${day}, ${y}`;
}

export function secDocUrl(cik: number, accession: string, doc: string | null) {
  const acc = accession.replace(/-/g, "");
  return doc
    ? `https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/${doc}`
    : `https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/`;
}
