import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { aiObject } from "./ai.server";
import { ensureExtracted, passagesFor, type FilingRow } from "./analysis.server";
import { FilingResearchSchema, ResearchError, researchExcerpt, StoredResearchSchema, validateResearch, type StoredResearch } from "./research";

const pending = new Map<string, Promise<StoredResearch>>();
export async function ensureFilingResearch(filing: FilingRow): Promise<StoredResearch> {
  const existing = pending.get(filing.accession);
  if (existing) return existing;
  const work = run(filing);
  pending.set(filing.accession, work);
  try { return await work; } finally { pending.delete(filing.accession); }
}

async function run(f: FilingRow): Promise<StoredResearch> {
  const { data: have, error } = await supabaseAdmin.from("filing_research").select("data").eq("accession", f.accession).maybeSingle();
  if (error) throw error;
  if (have) return StoredResearchSchema.parse(have.data);
  const unreadable = `The ${f.form} filed ${f.filing_date} couldn’t be read in a standard layout, so its competition and risk sections weren’t found.`;
  if (!await ensureExtracted(f)) throw new ResearchError(unreadable);
  const all = await passagesFor(f.accession);
  const passages = all.filter(p => p.section === "risk" || p.section === "competition");
  if (!passages.some(p => p.section === "risk")) throw new ResearchError(unreadable);
  // Long filings are reviewed in part rather than refused; only passages sent to the AI can be cited.
  const { text: excerpt, used, coverage } = researchExcerpt(passages);
  const raw = await aiObject(FilingResearchSchema, `Read only the provided SEC passages. Return competitors and risk exposures.
Competitors: only entities explicitly named as competitors in Competition or Risk factors. name MUST be an exact substring from the cited passage. No outside lists, aliases or general knowledge. Include private firms and unnamed groups only if explicitly described as competitors. Cite real integer passage ids. note may describe disclosed diversification, only if supported by the same passages; otherwise null.
Risks: at most 12 concrete disclosed dependencies (supplier, customer type, geography or specific regulation) that might recur in another company. Keys must be stable lowercase identifiers: supplier:<literal name>, customer:<specific type>, geography:<country>, policy:<specific regulation>, or cyber:security-breach. Use policy:us-chip-export-controls for US semiconductor export restrictions; customer:cloud-service-providers for cloud providers; supplier:tsmc for Taiwan Semiconductor Manufacturing; geography:china for disclosed China dependency. Do not group different regulations as generic regulation or different suppliers as supply-chain. Omit generic competition, stock volatility and economic boilerplate. title is plain sentence case. description describes only what this company discloses. uncertain states what is not established by the excerpt. Each risk needs real integer ids from Risk factors.
Never fabricate figures, compute metrics, give investment advice or infer that disclosure proves an event occurred. Return zero entries when there is no evidence.`, excerpt);
  const result = { ...validateResearch(raw, used), coverage };
  const { error: saveError } = await supabaseAdmin.from("filing_research").upsert({ accession: f.accession, cik: f.cik, data: result as unknown as Json });
  if (saveError) throw saveError;
  return result;
}