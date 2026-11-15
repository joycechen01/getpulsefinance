import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mailboxOwner } from "./digest";

export const newsletterStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { gmail } = await import("./digest.server");
  const mailbox = await gmail("profile");
  const { data, error } = await context.supabase.auth.getUser();
  if (error) throw error;
  const { data: monitor, error: monitorError } = await context.supabase.from("earnings_digest_monitor").select("paused_reason,last_checked_at").eq("user_id", context.userId).maybeSingle();
  if (monitorError) throw monitorError;
  return { eligible: !!mailbox.emailAddress && mailboxOwner(data.user?.email, mailbox.emailAddress), pausedReason: monitor?.paused_reason ?? null, lastChecked: monitor?.last_checked_at ?? null };
});

export const setNewsletter = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(d => z.object({ enabled: z.boolean() }).parse(d)).handler(async ({ context, data }) => {
  if (data.enabled) {
    const { gmail } = await import("./digest.server");
    const mailbox = await gmail("profile");
    const { data: user, error } = await context.supabase.auth.getUser();
    if (error) throw error;
    if (!mailbox.emailAddress || !mailboxOwner(user.user?.email, mailbox.emailAddress)) throw new Error("Automatic digests are available only to the connected Gmail account owner.");
  }
  const { error } = await context.supabase.from("profiles").update({ digest_newsletter_enabled: data.enabled }).eq("id", context.userId);
  if (error) throw error;
});