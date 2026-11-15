import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { gmail, buildDigest, deliverDigest } from "./digest.server";
import { ensureCompany } from "./company.server";
import { latestEarnings, mailboxOwner } from "./digest";
import { eligibleEarnings, MAX_DIGESTS_PER_RUN, pendingDigest } from "./earnings-newsletter";
import { AiError } from "./ai.server";

export async function runEarningsNewsletter() {
  // The personal mailbox must never be used on behalf of another account.
  const mailbox = await gmail("profile");
  if (!mailbox.emailAddress) throw new Error("Gmail identity is unavailable.");
  const { data: subscribers, error } = await supabaseAdmin.from("profiles").select("id,delivery_email,digest_newsletter_since").eq("digest_newsletter_enabled", true).limit(100);
  if (error) throw error;
  for (const profile of subscribers ?? []) {
    const { data, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (userError) throw userError;
    if (!mailboxOwner(data.user?.email, mailbox.emailAddress)) continue;
    const token = crypto.randomUUID();
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_earnings_digest_check", { _user_id: profile.id, _token: token });
    if (claimError) throw claimError;
    if (!claimed) return { checked: 0, sent: 0, pausedOrBusy: true };
    const update = async (values: { cursor?: number; paused_reason?: string | null; last_checked_at?: string; lease_until?: string | null }) => {
      const { error } = await supabaseAdmin.from("earnings_digest_monitor").update(values).eq("user_id", profile.id).eq("lease_token", token);
      if (error) throw error;
    };
    let checked = 0, sent = 0;
    try {
      const { data: monitor, error: monitorError } = await supabaseAdmin.from("earnings_digest_monitor").select("cursor").eq("user_id", profile.id).single();
      if (monitorError) throw monitorError;
      const { data: holdings, error: holdingsError } = await supabaseAdmin.from("holdings").select("ticker,cik,company_name").eq("user_id", profile.id).order("ticker").limit(1000);
      if (holdingsError) throw holdingsError;
      const rows = holdings ?? [];
      const recipient = z.string().email().parse(profile.delivery_email ?? data.user?.email);
      for (let i = 0; i < Math.min(MAX_DIGESTS_PER_RUN, rows.length); i++) {
        const index = ((monitor?.cursor ?? 0) + i) % rows.length;
        const holding = rows[index];
        if (!holding) continue;
        // Recheck opt-in at every entry to expensive work and immediately before sending.
        const { data: current, error: currentError } = await supabaseAdmin.from("profiles").select("digest_newsletter_enabled,digest_newsletter_since,delivery_email").eq("id", profile.id).single();
        if (currentError) throw currentError;
        if (!current.digest_newsletter_enabled || current.digest_newsletter_since !== profile.digest_newsletter_since) break;
        await ensureCompany(holding.cik, holding.ticker, holding.company_name, true);
        const { data: filings, error: filingsError } = await supabaseAdmin.from("filings").select("accession,form,filing_date,report_date").eq("cik", holding.cik).in("form", ["10-Q", "10-K"]).order("filing_date", { ascending: false }).limit(1);
        if (filingsError) throw filingsError;
        const filing = latestEarnings(filings ?? []);
        checked++;
        await update({ cursor: (index + 1) % rows.length, last_checked_at: new Date().toISOString() });
        if (!filing || !eligibleEarnings(filing, current.digest_newsletter_since)) continue;
        const { data: previous, error: readError } = await supabaseAdmin.from("digest_deliveries").select("status").eq("user_id", profile.id).eq("ticker", holding.ticker).eq("accession", filing.accession).maybeSingle();
        if (readError) throw readError;
        if (!pendingDigest(previous)) continue;
        const digest = await buildDigest(holding.ticker, true);
        if (!digest.reviewComplete || digest.filing.accession !== filing.accession) continue;
        const period = digest.filing.report_date ?? digest.period;
        const { data: periodClaim, error: periodError } = await supabaseAdmin.from("digest_deliveries").select("status").eq("user_id", profile.id).eq("ticker", holding.ticker).eq("period_end", period).maybeSingle();
        if (periodError) throw periodError;
        if (!pendingDigest(periodClaim)) continue;
        const { data: still, error: stillError } = await supabaseAdmin.from("profiles").select("digest_newsletter_enabled,digest_newsletter_since,delivery_email").eq("id", profile.id).single();
        if (stillError) throw stillError;
        if (!still.digest_newsletter_enabled || still.digest_newsletter_since !== profile.digest_newsletter_since || still.delivery_email !== profile.delivery_email) break;
        const result = await deliverDigest(profile.id, recipient, digest);
        if (!result.alreadySent) sent++;
      }
      return { checked, sent };
    } catch (e) {
      // Rate limits park until next hour. All other failures require a fresh owner action.
      const reason = e instanceof Error ? e.message : "Automatic earnings check failed.";
      if (!(e instanceof AiError && e.status === 429)) await update({ paused_reason: reason });
      throw e;
    } finally { await update({ lease_until: null }); }
  }
  return { checked: 0, sent: 0 };
}