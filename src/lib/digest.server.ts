import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureCompany } from "./company.server";
import { findTicker } from "./edgar.server";
import { ensureSignals } from "./analysis.server";
import { latestEarnings,digestMetrics,type EarningsDigest } from "./digest";
import type { Financials } from "./metrics";
import { signalViews } from "./analysis.functions";
import { secDocUrl } from "./format";

export async function buildDigest(ticker:string):Promise<EarningsDigest> {
  const match=await findTicker(ticker);
  if(!match)throw new Error("No SEC-registered ticker found.");
  await ensureCompany(match.cik,match.ticker,match.name);
  const {data:filings,error}=await supabaseAdmin.from("filings").select("accession,form,filing_date,report_date,primary_document").eq("cik",match.cik).in("form",["10-Q","10-K"]).order("filing_date",{ascending:false}).limit(60);
  if(error)throw error;
  const f=latestEarnings(filings??[]);
  if(!f)throw new Error("No 10-Q or 10-K available for this company.");
  const {data:fact,error:factError}=await supabaseAdmin.from("financial_facts").select("data").eq("cik",match.cik).maybeSingle();
  if(factError)throw factError;
  const fin=fact?.data as unknown as Financials|null;
  const filing={...f,url:secDocUrl(match.cik,f.accession,f.primary_document)};
  let reviewComplete=false;
  try{const r=await ensureSignals(match.cik,match.name,fin);reviewComplete=r.analyzed;}catch(e){console.error("Digest developments unavailable",e);}
  const all=await signalViews(supabaseAdmin,[match.cik],new Map([[match.cik,match.ticker]]));
  return {ticker:match.ticker,name:match.name,filing,...digestMetrics(fin,filing),reviewComplete,developments:all.filter(s=>s.accession===f.accession&&s.citations.length>0)};
}

export async function gmail(path:string,method="GET",body?:object) {
  const key=process.env["LOVABLE_API_KEY"],connection=process.env["GOOGLE_MAIL_API_KEY"];
  if(!key||!connection)throw new Error("Gmail is not connected.");
  const res=await fetch(`https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/${path}`,{method,headers:{Authorization:`Bearer ${key}`,"X-Connection-Api-Key":connection,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
  if(!res.ok){const error=await res.text();console.error(`Gmail failed [${res.status}]`,error);throw new Error(`Gmail request failed (${res.status}): ${error}`);}
  return res.json() as Promise<{emailAddress?:string;messages?:{id:string}[];id?:string}>;
}
export async function deliverDigest(userId:string,recipient:string,digest:EarningsDigest) {
  const {digestMessageId,rawDigestEmail}=await import("./digest");
  const period=digest.filing.report_date??digest.period;
  const id=digestMessageId(digest.ticker,period);
  const {data:previous,error:readError}=await supabaseAdmin.from("digest_deliveries").select("status").eq("user_id",userId).eq("ticker",digest.ticker).eq("period_end",period).maybeSingle();
  if(readError)throw readError;
  if(previous?.status==="sent")return {alreadySent:true};
  if(previous?.status==="sending"||previous?.status==="uncertain")throw new Error("This digest's delivery is pending or unconfirmed. Check Gmail Sent mail before attempting another send.");
  if(previous?.status==="failed")throw new Error("This delivery failed. Check delivery history before retrying.");
  const {error:claimError}=await supabaseAdmin.from("digest_deliveries").insert({user_id:userId,ticker:digest.ticker,period_end:period,accession:digest.filing.accession,recipient,status:"sending"});
  if(claimError){if(claimError.code==="23505")throw new Error("This company’s digest is already being processed for this period.");throw claimError;}
  const update=(values:{status:string;gmail_id?:string;sent_at?:string;error?:string})=>supabaseAdmin.from("digest_deliveries").update(values).eq("user_id",userId).eq("ticker",digest.ticker).eq("period_end",period);
  try{
    const sent=await gmail(`messages?q=${encodeURIComponent(`in:sent rfc822msgid:${id}`)}&maxResults=1`);
    if(sent.messages?.length){const saved=await update({status:"sent",gmail_id:sent.messages[0]?.id??"",sent_at:new Date().toISOString()});if(saved.error)throw saved.error;return {alreadySent:true};}
    const result=await gmail("messages/send","POST",{raw:rawDigestEmail(digest,recipient,id)});
    if(!result.id)throw new Error("Gmail did not confirm the send.");
    const saved=await update({status:"sent",gmail_id:result.id,sent_at:new Date().toISOString()});
    if(saved.error)throw new Error("Gmail accepted the email, but delivery history could not be saved. Do not resend.");
    return {alreadySent:false};
  }catch(e){await update({status:"uncertain",error:e instanceof Error?e.message:"Delivery not confirmed"});throw e;}
}