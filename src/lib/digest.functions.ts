import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { digestInput,mailboxOwner,type EarningsDigest } from "./digest";

export type DigestResult={ok:true;digest:EarningsDigest}|{ok:false;error:string};
export const previewDigest=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(d=>digestInput.parse(d)).handler(async({data}):Promise<DigestResult>=>{
  try{const {buildDigest}=await import("./digest.server");return {ok:true,digest:await buildDigest(data.ticker)};}catch(e){console.error("Digest failed",e);return {ok:false,error:e instanceof Error?e.message:"The earnings digest could not be prepared."};}
});
export const sendDigest=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(d=>digestInput.parse(d)).handler(async({data,context})=>{
  const {gmail,buildDigest,deliverDigest}=await import("./digest.server");
  try{
    const {data:user,error:authError}=await context.supabase.auth.getUser();
    if(authError||!user.user)throw new Error("Please sign in again.");
    const mailbox=await gmail("profile");
    if(!mailbox.emailAddress||!mailboxOwner(user.user.email,mailbox.emailAddress))throw new Error("Only the account signed in with the connected Gmail address can send digests from this mailbox.");
    const {data:profile,error}=await context.supabase.from("profiles").select("delivery_email,digest_email_enabled").eq("id",context.userId).single();
    if(error||!profile)throw new Error("Save your delivery email in Settings first.");
    if(!profile.digest_email_enabled)throw new Error("Enable earnings digest emails in Settings first.");
    const recipient=z.string().email().parse(profile.delivery_email??mailbox.emailAddress);
    const {data:holding}=await context.supabase.from("holdings").select("ticker").eq("ticker",data.ticker).maybeSingle();
    if(!holding)throw new Error("Add this company to your portfolio before emailing its digest.");
    const digest=await buildDigest(data.ticker);
    if(!digest.reviewComplete)throw new Error("The developments review is incomplete. Retry the preview before sending.");
    const delivery=await deliverDigest(context.userId,recipient,digest);
    return {ok:true as const,...delivery,recipient};
  }catch(e){console.error("Digest send failed",e);return {ok:false as const,error:e instanceof Error?e.message:"The email could not be sent."};}
});