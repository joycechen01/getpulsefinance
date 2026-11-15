import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { z } from "zod";

export const Route = createFileRoute("/api/public/jobs/earnings-digests")({ server: { handlers: { POST: async ({ request }) => {
  const failure = await authenticateCronRequest(request);
  if (failure) return failure;
  const body = z.object({ kind: z.literal("earnings") }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { runEarningsNewsletter } = await import("@/lib/earnings-newsletter.server");
  const waitUntil = (request as Request & { waitUntil?: (p: Promise<unknown>) => void }).waitUntil;
  const work = runEarningsNewsletter();
  if (waitUntil) {
    waitUntil.call(request, work.catch(e => console.error("Earnings digest check paused", e)));
    return Response.json({ accepted: true });
  }
  try { return Response.json(await work); }
  catch { return Response.json({ error: "Earnings digest check paused; review Settings." }, { status: 502 }); }
} } } });