// Server-only SEC EDGAR access. The SEC requires a descriptive User-Agent with contact info
// and allows ~10 requests/second; responses are cached in memory to stay well under that.
import type { CompanyFactsJson } from "./edgar-parse";

export type TickerEntry = { cik: number; ticker: string; name: string };

const DEFAULT_UA = "Ledgerline SEC charts app (contact: ledgerline-app@proton.me)";

function userAgent() {
  return process.env.SEC_USER_AGENT || DEFAULT_UA;
}

async function secFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": userAgent(), Accept: "application/json" },
  });
}

let tickerCache: { at: number; list: TickerEntry[] } | null = null;
const TICKER_TTL = 12 * 60 * 60 * 1000;

export async function getTickers(): Promise<TickerEntry[]> {
  if (tickerCache && Date.now() - tickerCache.at < TICKER_TTL) return tickerCache.list;
  const res = await secFetch("https://www.sec.gov/files/company_tickers.json");
  if (!res.ok) {
    const body = await res.text();
    console.error(`SEC ticker list failed [${res.status}]: ${body.slice(0, 300)}`);
    throw new Error(`SEC ticker list unavailable (${res.status})`);
  }
  const raw = (await res.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
  const list = Object.values(raw).map((r) => ({ cik: r.cik_str, ticker: r.ticker, name: r.title }));
  tickerCache = { at: Date.now(), list };
  return list;
}

const factsCache = new Map<number, { at: number; json: CompanyFactsJson }>();
const FACTS_TTL = 60 * 60 * 1000;

export async function getCompanyFactsJson(cik: number): Promise<CompanyFactsJson | null> {
  const hit = factsCache.get(cik);
  if (hit && Date.now() - hit.at < FACTS_TTL) return hit.json;
  const padded = String(cik).padStart(10, "0");
  const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    console.error(`SEC company facts failed [${res.status}]: ${body.slice(0, 300)}`);
    throw new Error(`SEC company facts unavailable (${res.status})`);
  }
  const json = (await res.json()) as CompanyFactsJson;
  if (factsCache.size > 40) factsCache.delete(factsCache.keys().next().value!);
  factsCache.set(cik, { at: Date.now(), json });
  return json;
}
