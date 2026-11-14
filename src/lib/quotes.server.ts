import { z } from "zod";

export type Quote = { price: number; change: number; changePct: number; at: number };
const GATEWAY_URL = "https://connector-gateway.lovable.dev/udc_finnhub/api/v1/quote";
const quoteSchema = z.object({
  c: z.number().finite().positive(),
  d: z.number().finite(),
  dp: z.number().finite(),
  t: z.number().int().positive(),
});

export async function fetchHoldingQuotes(
  tickers: string[],
  credentials: { gatewayKey: string | undefined; connectionKey: string | undefined },
  request: typeof fetch = fetch,
) {
  const quotes: Record<string, Quote | null> = {};
  const errors: Record<string, { status: number; body: string }> = {};
  if (!credentials.gatewayKey || !credentials.connectionKey) {
    return { available: false, quotes, errors };
  }
  for (const ticker of [...new Set(tickers)]) {
    quotes[ticker] = null;
    try {
      const url = new URL(GATEWAY_URL);
      url.searchParams.set("symbol", ticker.replaceAll("-", "."));
      const response = await request(url, {
        headers: {
          Authorization: `Bearer ${credentials.gatewayKey}`,
          "X-Connection-Api-Key": credentials.connectionKey,
        },
      });
      if (!response.ok) {
        const body = await response.text();
        console.error(`Finnhub quote failed [${response.status}]: ${body}`);
        errors[ticker] = { status: response.status, body };
        continue;
      }
      const body: unknown = await response.json();
      const parsed = quoteSchema.safeParse(body);
      if (!parsed.success) {
        errors[ticker] = { status: response.status, body: JSON.stringify(body) };
        continue;
      }
      const q = parsed.data;
      quotes[ticker] = { price: q.c, change: q.d, changePct: q.dp, at: q.t * 1000 };
    } catch (error) {
      console.error("Finnhub quote request failed", error);
      errors[ticker] = { status: 0, body: "Finnhub quote request could not be completed." };
    }
  }
  return { available: true, quotes, errors };
}