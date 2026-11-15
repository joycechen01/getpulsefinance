// Pure CSV-to-holdings parsing for portfolio import. No I/O, so it stays unit-testable.

export type ImportRow = { ticker: string; shares: number | null; avgPrice: number | null };
export type SkippedLine = { line: number; text: string; reason: string };
export type ParsedImport = { rows: ImportRow[]; skipped: SkippedLine[]; error?: string };

export const MAX_IMPORT_ROWS = 100;

const TICKER_COLS = ["symbol", "ticker", "ticker symbol", "stock symbol", "security symbol"];
const SHARES_COLS = [
  "quantity",
  "qty quantity",
  "shares",
  "qty",
  "share quantity",
  "shares owned",
  "units",
];
const AVG_COLS = [
  "average cost",
  "avg cost",
  "average price",
  "avg price",
  "average cost basis",
  "average cost per share",
  "cost per share",
  "cost basis per share",
  "avg cost per share",
  "purchase price",
  "price paid",
];
const TOTAL_COST_COLS = ["cost basis total", "total cost", "cost basis", "total cost basis"];

const TICKER_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;

/** Splits CSV text into rows of cells, honoring quotes, escaped quotes and CRLF. */
export function splitCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
  const count = (d: string) => sample.split(d).length - 1;
  return [",", ";", "\t"].reduce((best, d) => (count(d) > count(best) ? d : best), ",");
}

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[_*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-z ]/g, "")
    .trim();

function findCol(header: string[], names: string[]) {
  const cells = header.map(norm);
  return cells.findIndex((c) => names.includes(c));
}

/**
 * Parses a positive amount such as "12", "1,234.50" or "$98.10". Anything else, including
 * negatives and decimal commas ("12,5"), is rejected rather than guessed.
 */
export function parseAmount(raw: string | undefined): number | null {
  const s = (raw ?? "").trim().replace(/^\$\s*/, "");
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(s)) return null;
  const n = Number(s.replace(/,/g, ""));
  return n > 0 ? n : null;
}

/** Normalizes a ticker cell; brokerages sometimes append "*" or "**" to symbols. */
export function normalizeTicker(raw: string | undefined): string | null {
  const t = (raw ?? "").trim().toUpperCase().replace(/\*+$/, "");
  return TICKER_RE.test(t) ? t : null;
}

/**
 * Reads holdings from a brokerage export or a simple "ticker,shares,avg price" file.
 * The header may follow a few preamble lines; without one, columns are read positionally.
 * Repeated tickers (one stock held in several accounts) are merged.
 */
export function parsePortfolioCsv(text: string): ParsedImport {
  const clean = text.replace(/^\uFEFF/, "");
  const table = splitCsv(clean, detectDelimiter(clean));
  const nonEmpty = table
    .map((cells, i) => ({ cells, line: i + 1 }))
    .filter((r) => r.cells.some((c) => c.trim()));
  if (!nonEmpty.length) return { rows: [], skipped: [], error: "The file is empty." };

  const headerIdx = nonEmpty.slice(0, 15).findIndex((r) => findCol(r.cells, TICKER_COLS) >= 0);
  let tickerCol = 0;
  let sharesCol = 1;
  let avgCol = 2;
  let totalCol = -1;
  let body = nonEmpty;
  if (headerIdx >= 0) {
    const header = nonEmpty[headerIdx]!.cells;
    tickerCol = findCol(header, TICKER_COLS);
    sharesCol = findCol(header, SHARES_COLS);
    avgCol = findCol(header, AVG_COLS);
    totalCol = findCol(header, TOTAL_COST_COLS);
    body = nonEmpty.slice(headerIdx + 1);
  } else if (!normalizeTicker(nonEmpty[0]!.cells[0])) {
    return {
      rows: [],
      skipped: [],
      error:
        "Couldn’t find a Symbol or Ticker column. Add a header row, or put tickers in the first column.",
    };
  }

  const merged = new Map<
    string,
    { shares: number | null; cost: number | null; allShares: boolean; allCost: boolean }
  >();
  const skipped: SkippedLine[] = [];
  for (const { cells, line } of body) {
    const ticker = normalizeTicker(cells[tickerCol]);
    if (!ticker) {
      skipped.push({ line, text: cells.join(", ").slice(0, 80), reason: "No valid ticker" });
      continue;
    }
    const shares = sharesCol >= 0 ? parseAmount(cells[sharesCol]) : null;
    let avg = avgCol >= 0 ? parseAmount(cells[avgCol]) : null;
    if (avg == null && totalCol >= 0 && shares) {
      const total = parseAmount(cells[totalCol]);
      avg = total == null ? null : total / shares;
    }
    const prev = merged.get(ticker);
    const cost = shares != null && avg != null ? shares * avg : null;
    if (!prev)
      merged.set(ticker, { shares, cost, allShares: shares != null, allCost: cost != null });
    else {
      prev.allShares &&= shares != null;
      prev.allCost &&= cost != null;
      prev.shares = prev.allShares ? prev.shares! + shares! : null;
      prev.cost = prev.allCost ? prev.cost! + cost! : null;
    }
  }

  const rows = [...merged].map(([ticker, m]) => ({
    ticker,
    shares: m.shares,
    avgPrice: m.shares && m.cost != null ? Math.round((m.cost / m.shares) * 10000) / 10000 : null,
  }));
  if (!rows.length) return { rows, skipped, error: "No rows with a valid ticker were found." };
  if (rows.length > MAX_IMPORT_ROWS)
    return {
      rows: [],
      skipped,
      error: `This file has ${rows.length} holdings; import up to ${MAX_IMPORT_ROWS} at a time.`,
    };
  return { rows, skipped };
}
