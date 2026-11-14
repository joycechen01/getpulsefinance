import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCompanyNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticker: z.string().trim().min(1).max(12).regex(/^[A-Za-z.-]+$/) }).parse(d))
  .handler(async ({ data }) => {
    const { fetchCompanyNews } = await import("./news.server");
    try {
      return await fetchCompanyNews(data.ticker.toUpperCase(), { gatewayKey: process.env["LOVABLE_API_KEY"], connectionKey: process.env["UDC_FINNHUB_API_KEY"] });
    } catch (e) {
      console.error("News request failed", e);
      return { ok: false as const, error: "News couldn't be loaded. Please try again." };
    }
  });
