import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { aiObject } from "./ai.server";
import { ensureExtracted, passagesFor, type FilingRow } from "./analysis.server";
import { FilingResearchSchema, validateResearch, type FilingResearch } from "./research";

const pending = new Map<string, Promise<FilingResearch>>();
export async function ensureFilingResearch(filing: FilingRow): Promise<FilingResearch> {
  const existing = pending.get(filing.accession);
  if (existing) return existing;
  const work = run(filing);
  pending.set(filing.accession, work);
  try { return await work; } finally { pending.delete(filing.accession); }
}

async function run(f: FilingRow): Promise<FilingResearch> {
  const { data: have, error } = await supabaseAdmin.from("filing_research").select("data").eq("accession", f.accession).maybeSingle();
  if (error) throw error;
  if (have) return FilingResearchSchema.parse(have.data);
  if (!await ensureExtracted(f)) throw new Error("The filing sections could not be read.");
  const all = await passagesFor(f.accession);
  const passages = all.filter(p => p.section === "risk" || p.section === "competition");
  if (!passages.some(p => p.section === "risk")) throw new Error("The filing's risk factors could not be read.");
  // Keep the complete source body for validation; every excerpt retains a real passage id.
  const excerpt = passages.map(p => `[${p.id}] ${p.section}: ${p.body}`).join("\n\n");
  if (excerpt.length > 220000) throw new Error("This filing is too large for a complete research review.");
  const raw = await aiObject(FilingResearchSchema, `Read only the provided SEC passages. Return competitors and risk exposures.
Competitors: only entities explicitly named as competitors in Competition or Risk factors. name MUST be an exact substring from the cited passage. No outside lists, aliases or general knowledge. Include private firms and unnamed groups only if explicitly described as competitors. Cite real integer passage ids. note may describe disclosed diversification, only if supported by the same passages; otherwise null.
Risks: at most 12 concrete disclosed dependencies (supplier, customer type, geography or specific regulation) that might recur in another company. Keys must be stable lowercase identifiers: supplier:<literal name>, customer:<specific type>, geography:<country>, policy:<specific regulation>, or cyber:security-breach. Use policy:us-chip-export-controls for US semiconductor export restrictions; customer:cloud-service-providers for cloud providers; supplier:tsmc for Taiwan Semiconductor Manufacturing; geography:china for disclosed China dependency. Do not group different regulations as generic regulation or different suppliers as supply-chain. Omit generic competition, stock volatility and economic boilerplate. title is plain sentence case. description describes only what this company discloses. uncertain states what is not established by the excerpt. Each risk needs real integer ids from Risk factors.
Never fabricate figures, compute metrics, give investment advice or infer that disclosure proves an event occurred. Return zero entries when there is no evidence.`, excerpt);
  const result = validateResearch(raw, passages);
  const { error: saveError } = await supabaseAdmin.from("filing_research").upsert({ accession: f.accession, cik: f.cik, data: result as unknown as Json });
  if (saveError) throw saveError;
  return result;
}