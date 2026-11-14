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
export const sendsInFlight=new Set<string>();