import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Citation } from "./analysis.functions";
import type { Financials } from "./metrics";
import { comparisonInput, comparisonTTM, matchRegistrant, MAX_COMPETITORS, sharedRiskGroups } from "./research";
import { secDocUrl } from "./format";
import type { SectionId } from "./filing-sections";

type Client = SupabaseClient<Database>;
const tickerInput = z.object({ ticker: z.string().trim().min(1).max(12) });
const failure = (error: unknown) => {
  console.error("Phase 3 research failed", error);
  return { ok: false as const, error: "SEC research could not be completed. Please try again shortly." };
};

async function citations(sb: Client, ids: number[]): Promise<Citation[]> {
  if (!ids.length) return [];
  const { data: ps, error } = await sb.from("filing_passages").select("id,accession,cik,section,body").in("id", ids);
  if (error) throw error;
  const accs = [...new Set((ps ?? []).map(p => p.accession))];
  const { data: fs, error: e } = accs.length ? await sb.from("filings").select("accession,form,filing_date,primary_document").in("accession", accs) : {data:[],error:null};
  if (e) throw e;
  return (ps ?? []).map(p => {
    const f = fs?.find(f => f.accession === p.accession);
    return { id:p.id, accession:p.accession, section:p.section as SectionId, form:f?.form ?? "", filing_date:f?.filing_date ?? "", text:p.body, url:secDocUrl(p.cik,p.accession,f?.primary_document ?? null) };
  });
}

async function prepare(ticker: string) {
  const { findTicker } = await import("./edgar.server");
  const { ensureCompany } = await import("./company.server");
  const match = await findTicker(ticker);
  if (!match) throw new Error("Unknown SEC ticker");
  await ensureCompany(match.cik, match.ticker, match.name);
  return match;
}

async function annualResearch(ticker: string, sb: Client) {
  const match = await prepare(ticker);
  const { data: filing, error } = await sb.from("filings").select("accession,cik,form,filing_date,report_date,primary_document,items").eq("cik",match.cik).eq("form","10-K").order("filing_date",{ascending:false}).limit(1).maybeSingle();
  if (error || !filing) throw new Error("No annual filing available");
  const { ensureFilingResearch } = await import("./research.server");
  const research = await ensureFilingResearch(filing);
  return { match, filing, research };
}

export const getNamedCompetitors = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(d=>tickerInput.parse(d)).handler(async({data,context})=>{
  try {
    const { match, filing, research } = await annualResearch(data.ticker,context.supabase);
    const { getTickers } = await import("./edgar.server");
    const list = await getTickers();
    const refs = await citations(context.supabase,research.competitors.flatMap(c=>c.passage_ids));
    return {ok:true as const, filingDate:filing.filing_date, competitors:research.competitors.map(c=>{
      const registrant = matchRegistrant(c.name,list);
      return {...c, registrant:registrant?.cik === match.cik ? null : registrant, citations:refs.filter(r=>c.passage_ids.includes(r.id))};
    })};
  } catch(e) { return failure(e); }
});

export const getComparison = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(d=>comparisonInput.parse(d)).handler(async({data,context})=>{
  try {
    const { match, research } = await annualResearch(data.ticker,context.supabase);
    const { getTickers } = await import("./edgar.server");
    const list = await getTickers();
    const allowed = research.competitors.map(c=>({...c, match:matchRegistrant(c.name,list)})).filter(c=>c.match && c.match.cik !== match.cik);
    const names = data.peers ?? allowed.slice(0,MAX_COMPETITORS).map(c=>c.name);
    if (names.some(n=>!allowed.some(c=>c.name===n))) throw new Error("Only filing-named competitors are allowed");
    const targets = [match, ...names.flatMap(n=>{const c=allowed.find(c=>c.name===n);return c?.match ? [c.match] : [];})];
    const unique = targets.filter((t,i)=>targets.findIndex(x=>x.cik===t.cik)===i);
    const { ensureCompany } = await import("./company.server");
    const rows = [];
    for (const target of unique) {
      try {
        await ensureCompany(target.cik,target.ticker,target.name);
        const {data:f,error} = await context.supabase.from("financial_facts").select("data").eq("cik",target.cik).maybeSingle();
        if (error) throw error;
        const fin = f?.data as unknown as Financials | null;
        const ttm = comparisonTTM(fin);
        const {data:filings} = await context.supabase.from("filings").select("accession,primary_document,report_date").eq("cik",target.cik).in("form",["10-Q","10-K"]).order("filing_date",{ascending:false}).limit(60);
        const source = filings?.find(f=>f.report_date === ttm.end) ?? filings?.[0];
        rows.push({...target,...ttm,available:!!fin,currency:fin?.currency ?? null,url:source ? secDocUrl(target.cik,source.accession,source.primary_document):null});
      } catch(e) { console.error("Peer financials failed",target.ticker,e); rows.push({...target,...comparisonTTM(null),available:false,currency:null,url:null}); }
    }
    return {ok:true as const,rows};
  } catch(e) { return failure(e); }
});

export const getSharedRisks = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  try {
    const {data:holdings,error} = await context.supabase.from("holdings").select("ticker,cik").order("created_at");
    if (error) throw error;
    const reviewed = [], unavailable:string[]=[];
    for (const holding of holdings ?? []) {
      try {
        const r = await annualResearch(holding.ticker,context.supabase);
        reviewed.push({ticker:holding.ticker,risks:r.research.risks,filingDate:r.filing.filing_date});
      } catch(e) { console.error("Risk review unavailable",holding.ticker,e); unavailable.push(holding.ticker); }
    }
    const groups = sharedRiskGroups(reviewed);
    const refs = await citations(context.supabase,groups.flatMap(g=>g.members.flatMap(m=>m.risk.passage_ids)));
    return {ok:true as const,reviewed:reviewed.map(r=>({ticker:r.ticker,filingDate:r.filingDate})),unavailable,total:holdings?.length ?? 0,groups:groups.map(g=>({...g,members:g.members.map(m=>({...m,citations:refs.filter(c=>m.risk.passage_ids.includes(c.id))}))}))};
  } catch(e) {return failure(e);}
});

export type NamedCompetitorsResult = Awaited<ReturnType<typeof getNamedCompetitors>>;
export type ComparisonResult = Awaited<ReturnType<typeof getComparison>>;
export type SharedRisksResult = Awaited<ReturnType<typeof getSharedRisks>>;