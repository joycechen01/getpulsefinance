import { describe, expect, it, vi } from "vitest";
import { fetchHoldingQuotes } from "./quotes.server";

const credentials = { gatewayKey: "test-gateway", connectionKey: "test-connection" };
describe("Finnhub holdings quotes", () => {
  it("uses only the gateway and maps price, dollar change, percent change and timestamp", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ c: 162.85, d: -3.34, dp: -2.0097, t: 1794603600 })));
    const result = await fetchHoldingQuotes(["NVDA", "NVDA"], credentials, request);
    expect(result.quotes["NVDA"]).toEqual({ price: 162.85, change: -3.34, changePct: -2.0097, at: 1794603600000 });
    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://connector-gateway.lovable.dev/udc_finnhub/api/v1/quote?symbol=NVDA");
    expect(init?.headers).toEqual({ Authorization: "Bearer test-gateway", "X-Connection-Api-Key": "test-connection" });
  });
  it("does not call Finnhub without both secure credentials", async () => {
    const request = vi.fn<typeof fetch>();
    expect((await fetchHoldingQuotes(["NVDA"], { ...credentials, connectionKey: undefined }, request)).available).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("preserves provider status and failure body without fabricating a quote", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"error":"API limit reached"}', { status: 429 }));
    const result = await fetchHoldingQuotes(["NVDA"], credentials, request);
    expect(result.quotes["NVDA"]).toBeNull();
    expect(result.errors["NVDA"]).toEqual({ status: 429, body: '{"error":"API limit reached"}' });
  });
  it("rejects empty quotes and missing day change rather than showing zero", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ c: 0, d: null, dp: null, t: 0 })));
    expect((await fetchHoldingQuotes(["NVDA"], credentials, request)).quotes["NVDA"]).toBeNull();
  });
});