import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {useServerFn} from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/profile";
import {setEventMonitor} from "@/lib/phase5.functions";
import { newsletterStatus, setNewsletter, resumeNewsletter } from "@/lib/earnings-newsletter.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Account settings — Pulse Finance" },
    { name: "description", content: "Manage your Pulse Finance account and earnings digest preferences." },
    { property: "og:title", content: "Account settings — Pulse Finance" },
    { property: "og:description", content: "Manage your Pulse Finance account and earnings digest preferences." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: p, isLoading } = useQuery(profileQuery());
  const [email, setEmail] = useState("");
  const [digest, setDigest] = useState(true);
  const [audio, setAudio] = useState(true);
  const [events, setEvents] = useState(false);
  const [newsletter, setNewsletterEnabled] = useState(false);
  const getNewsletterStatus = useServerFn(newsletterStatus);
  const saveNewsletter = useServerFn(setNewsletter);
  const resume = useServerFn(resumeNewsletter);
  const { data: newsletterInfo, error: newsletterError } = useQuery({ queryKey: ["newsletter-status"], queryFn: () => getNewsletterStatus() });
  const [saving, setSaving] = useState(false);
  const monitor=useServerFn(setEventMonitor);

  useEffect(() => {
    if (!p) return;
    setEmail(p.delivery_email ?? p.email);
    setDigest(p.digest_email_enabled);
    setAudio(p.audio_digest_enabled);
    setEvents(p.material_event_email_enabled);
    setNewsletterEnabled(p.digest_newsletter_enabled);
  }, [p]);

  const save = async () => {
    if (!p) return;
    setSaving(true);
    try { await saveNewsletter({ data: { enabled: newsletter } }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Automatic digest preference could not be saved."); setSaving(false); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ delivery_email: email.trim() || null, digest_email_enabled: digest, audio_digest_enabled: audio, material_event_email_enabled: events, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) toast.error("Couldn’t save settings");
    else {
      try{await monitor({data:{enabled:events}});}catch(e){toast.error(e instanceof Error?e.message:"Event monitoring could not be updated.");}
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["newsletter-status"] });
    }
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <h1 className="text-4xl">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Signed in as {p?.email ?? "…"}</p>
      <div className="panel mt-6 divide-y">
        <label className="flex items-center justify-between gap-4 p-5"><span><span className="block text-sm font-medium">Material event emails</span><span className="block text-xs text-muted-foreground">Daily review of one holding for selected SEC 8-K events. No audio. Existing filings are not backfilled.</span></span><Switch aria-label="Material event emails" disabled={isLoading||saving} checked={events} onCheckedChange={setEvents}/></label>
        <div className="space-y-1.5 p-5">
          <Label htmlFor="delivery">Delivery email</Label>
          <Input id="delivery" type="email" value={email} disabled={isLoading} onChange={(e) => setEmail(e.target.value)} />
          <p className="text-xs text-muted-foreground">Where earnings digests will be sent.</p>
        </div>
        <label className="flex items-center justify-between gap-4 p-5">
          <span><span className="block text-sm font-medium">Earnings digest newsletter</span><span className="block text-xs text-muted-foreground">Email me each holding's earnings digest automatically when a new 10-Q or 10-K is filed.</span></span>
          <Switch aria-label="Earnings digest newsletter" checked={newsletter} disabled={isLoading || saving || (!newsletter && !newsletterInfo?.eligible)} onCheckedChange={setNewsletterEnabled} />
        </label>
        <label className="flex items-center justify-between gap-4 p-5">
          <span>
            <span className="block text-sm font-medium">Earnings digest emails</span>
            <span className="block text-xs text-muted-foreground">
              Allow on-demand delivery of each holding’s latest 10-Q or 10-K digest.
            </span>
          </span>
          <Switch checked={digest} onCheckedChange={setDigest} />
        </label>
        <label className="flex items-center justify-between gap-4 p-5">
          <span>
            <span className="block text-sm font-medium">Audio digest</span>
            <span className="block text-xs text-muted-foreground">A 60–90 second spoken version of each digest.</span>
          </span>
          <Switch checked={audio} onCheckedChange={setAudio} />
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Automatic earnings digests are available only to the connected Gmail account owner, checked hourly, and start with newly filed reports after opt-in. Manual delivery stays available from your portfolio. Audio is not enabled yet.
      </p>
      {newsletterError && <p role="alert" className="mt-3 text-sm text-muted-foreground">{newsletterError instanceof Error ? newsletterError.message : "Gmail availability could not be checked."}</p>}
      {newsletterInfo?.pausedReason && <div className="mt-3 space-y-2"><p role="alert" className="text-sm text-muted-foreground">Automatic digests paused: {newsletterInfo.pausedReason} Resume only after the issue is resolved.</p><Button variant="outline" disabled={saving} onClick={async () => { setSaving(true); try { await resume(); await qc.invalidateQueries({ queryKey: ["newsletter-status"] }); toast.success("Automatic digests will resume at the next hourly check."); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not resume digests."); } finally { setSaving(false); } }}>Resume automatic digests</Button></div>}
      {newsletterInfo?.lastChecked && <p className="mt-2 text-xs text-muted-foreground">Last earnings check: {new Date(newsletterInfo.lastChecked).toLocaleString()}</p>}
      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={saving || !p}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
