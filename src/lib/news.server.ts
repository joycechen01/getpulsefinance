import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/udc_finnhub/api/v1/company-news";
const itemSchema = z.object({
  id: z.number().optional(),
  headline: z.string().min(1),
  source: z.string().default(""),
  summary: z.string().default(""),
  url: z.string().url(),
  datetime: z.number().int().positive(),
});
export type NewsItem = { id: string; headline: string; source: string; summary: string; url: string; at: number };

const cache = new Map<string, { at: number; items: NewsItem[] }>();

export async function fetchCompanyNews(ticker: string, keys: { gatewayKey?: string; connectionKey?: string }, request: typeof fetch = fetch) {
  if (!keys.gatewayKey || !keys.connectionKey) return { ok: false as const, error: "News isn't connected right now." };
  const hit = cache.get(ticker);
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return { ok: true as const, items: hit.items };
  const to = new Date(), from = new Date(Date.now() - 30 * 86400000);
  const url = new URL(GATEWAY_URL);
  url.searchParams.set("symbol", ticker.replaceAll("-", "."));
  url.searchParams.set("from", from.toISOString().slice(0, 10));
  url.searchParams.set("to", to.toISOString().slice(0, 10));
  const res = await request(url, { headers: { Authorization: `Bearer ${keys.gatewayKey}`, "X-Connection-Api-Key": keys.connectionKey } });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Finnhub news failed [${res.status}]: ${body}`);
    return { ok: false as const, error: `News couldn't be loaded (${res.status}).` };
  }
  const raw: unknown = await res.json();
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const items = list.flatMap((r) => {
    const p = itemSchema.safeParse(r);
    if (!p.success || !/^https?:/.test(p.data.url) || seen.has(p.data.headline)) return [];
    seen.add(p.data.headline);
    return [{ id: String(p.data.id ?? p.data.url), headline: p.data.headline, source: p.data.source, summary: p.data.summary.slice(0, 400), url: p.data.url, at: p.data.datetime * 1000 }];
  }).sort((a, b) => b.at - a.at).slice(0, 30);
  cache.set(ticker, { at: Date.now(), items });
  return { ok: true as const, items };
}
