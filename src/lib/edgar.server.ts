// Server-only SEC EDGAR access. The SEC requires a descriptive User-Agent with contact info and
// allows ~10 requests/second; we space requests and cache results in memory and the database.
import type { CompanyFactsJson } from "./edgar-parse";

export type TickerEntry = { cik: number; ticker: string; name: string };

const DEFAULT_UA = "Pulse Finance research app (contact: ledgerline-app@proton.me)";

function userAgent() {
  return process.env["SEC_USER_AGENT"] || DEFAULT_UA;
}

let lastCall = 0;
async function secFetch(url: string): Promise<Response> {
  const wait = lastCall + 150 - Date.now();
  lastCall = Math.max(Date.now(), lastCall + 150);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return fetch(url, { headers: { "User-Agent": userAgent(), Accept: "application/json" } });
}

let tickerCache: { at: number; list: TickerEntry[] } | null = null;
const TICKER_TTL = 12 * 60 * 60 * 1000;

export async function getTickers(): Promise<TickerEntry[]> {
  if (tickerCache && Date.now() - tickerCache.at < TICKER_TTL) return tickerCache.list;
  const res = await secFetch("https://www.sec.gov/files/company_tickers.json");
  if (!res.ok) {
    console.error(`SEC ticker list failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
    throw new Error(`SEC ticker list unavailable (${res.status})`);
  }
  const raw = (await res.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
  const list = Object.values(raw).map((r) => ({ cik: r.cik_str, ticker: r.ticker, name: r.title }));
  tickerCache = { at: Date.now(), list };
  return list;
}

export async function findTicker(ticker: string) {
  const t = ticker.trim().toUpperCase().replace(/\./g, "-");
  return (await getTickers()).find((m) => m.ticker === t) ?? null;
}

const pad = (cik: number) => String(cik).padStart(10, "0");

export async function getCompanyFactsJson(cik: number): Promise<CompanyFactsJson | null> {
  const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad(cik)}.json`);
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`SEC company facts failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
    throw new Error(`SEC company facts unavailable (${res.status})`);
  }
  return (await res.json()) as CompanyFactsJson;
}

export type Submissions = {
  name: string;
  sicDescription?: string;
  exchanges?: string[];
  fiscalYearEnd?: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
      items: string[];
    };
  };
};

export async function getSubmissions(cik: number): Promise<Submissions | null> {
  const res = await secFetch(`https://data.sec.gov/submissions/CIK${pad(cik)}.json`);
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`SEC submissions failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
    throw new Error(`SEC filing history unavailable (${res.status})`);
  }
  return (await res.json()) as Submissions;
}
