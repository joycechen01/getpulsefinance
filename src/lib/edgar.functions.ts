import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getTickers } from "./edgar.server";

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

