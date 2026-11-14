import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { parseCompanyFacts, type ParsedFinancials } from "./edgar-parse";
import { getCompanyFactsJson, getTickers } from "./edgar.server";

export type CompanyMatch = { cik: number; ticker: string; name: string };

export const normalizeTicker = (t: string) => t.trim().toUpperCase().replace(/\./g, "-");

export const searchCompanies = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().max(60) }).parse(d))
  .handler(async ({ data }): Promise<CompanyMatch[]> => {
    const q = data.q.trim().toUpperCase();
    if (!q) return [];
    const list = await getTickers();
    const tq = normalizeTicker(q);
    const scored: { m: CompanyMatch; s: number }[] = [];
    for (const m of list) {
      const name = m.name.toUpperCase();
      let s = 0;
      if (m.ticker === tq) s = 100;
      else if (m.ticker.startsWith(tq)) s = 80 - m.ticker.length;
      else if (name.startsWith(q)) s = 60;
      else if (name.includes(q)) s = 40;
      if (s) scored.push({ m, s });
    }
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, 8).map((x) => x.m);
  });

export type FinancialsResult =
  | ({ ok: true; cik: number; ticker: string; name: string } & ParsedFinancials)
  | { ok: false; ticker: string; error: string };

export const getCompanyFinancials = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ ticker: z.string().min(1).max(12) }).parse(d))
  .handler(async ({ data }): Promise<FinancialsResult> => {
    const ticker = normalizeTicker(data.ticker);
    try {
      const list = await getTickers();
      const match = list.find((m) => m.ticker === ticker);
      if (!match) {
        return { ok: false, ticker, error: `No SEC-registered company found for “${ticker}”.` };
      }
      const json = await getCompanyFactsJson(match.cik);
      if (!json) {
        return {
          ok: false,
          ticker,
          error: `${match.name} has no structured financial data on EDGAR.`,
        };
      }
      const parsed = parseCompanyFacts(json);
      return {
        ok: true,
        cik: match.cik,
        ticker: match.ticker,
        name: json.entityName || match.name,
        ...parsed,
      };
    } catch (e) {
      console.error("getCompanyFinancials failed", e);
      return {
        ok: false,
        ticker,
        error: "The SEC data service didn’t respond. Please try again shortly.",
      };
    }
  });
