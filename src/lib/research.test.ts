import { describe, expect, it } from "vitest";
import { comparisonInput, comparisonTTM, matchRegistrant, sharedRiskGroups, validateResearch } from "./research";
import type { Financials, FinRow } from "./metrics";

const rows: FinRow[] = Array.from({length:8},(_,i) => ({key:String(i),label:String(i),fiscalYear:2024+Math.floor(i/4),quarter:i%4+1,end:`${2024+Math.floor(i/4)}-${String((i%4+1)*3).padStart(2,"0")}-28`,v:{revenue:i<4?100:150,grossProfit:60,operatingIncome:30,rnd:15,operatingCashFlow:40,capex:10},derived:[],calculated:[]}));
const fin: Financials = {currency:"USD",fyEndMonth:12,quarterly:rows,annual:[],tags:{}};
describe("Phase 3 research rules",()=>{
  it("uses four quarters for every comparison metric, including prior TTM revenue growth",()=>{
    expect(comparisonTTM(fin).values).toEqual({revenueYoY:0.5,grossMargin:0.4,operatingMargin:0.2,rndPct:0.1,fcfMargin:0.2});
  });
  it("never invents values for incomplete TTM periods",()=>{
    expect(comparisonTTM({...fin,quarterly:rows.filter((_,i)=>i!==6)}).values.operatingMargin).toBeNull();
  });
  it("missing R&D remains missing instead of zero",()=>{
    expect(comparisonTTM({...fin,quarterly:rows.map(r=>{const v={...r.v};delete v.rnd;return {...r,v};})}).values.rndPct).toBeNull();
  });
  it("permits five competitors and rejects six",()=>{
    expect(comparisonInput.safeParse({ticker:"NVDA",peers:Array(5).fill("AMD")}).success).toBe(true);
    expect(comparisonInput.safeParse({ticker:"NVDA",peers:Array(6).fill("AMD")}).success).toBe(false);
  });
  it("only keeps a competitor literally named in its cited SEC passage",()=>{
    const input={competitors:[{name:"Intel",passage_ids:[1],note:null},{name:"Tesla",passage_ids:[1],note:null}],risks:[]};
    expect(validateResearch(input,[{id:1,section:"competition",body:"Our competitors include Intel."}]).competitors.map(c=>c.name)).toEqual(["Intel"]);
  });
  it("uses SEC registrants and refuses ambiguous name matches",()=>{
    expect(matchRegistrant("Intel",[{name:"INTEL CORP",ticker:"INTC",cik:1}])?.ticker).toBe("INTC");
    expect(matchRegistrant("Intel",[{name:"Intel Corp",ticker:"A",cik:1},{name:"Intel Inc",ticker:"B",cik:2}])).toBeNull();
  });
  it("shared exposure needs at least two distinct holdings, not two passages from one",()=>{
    const risk={key:"policy:us-chip-export-controls",title:"Chip export controls",description:"Disclosed",uncertain:"Impact unknown",passage_ids:[1]};
    expect(sharedRiskGroups([{ticker:"NVDA",risks:[risk,risk]}])).toEqual([]);
    expect(sharedRiskGroups([{ticker:"NVDA",risks:[risk]},{ticker:"INTC",risks:[risk]}])[0]?.members.map(m=>m.ticker)).toEqual(["NVDA","INTC"]);
  });
  it("does not use a non-risk passage as exposure evidence",()=>{
    expect(validateResearch({competitors:[],risks:[{key:"x",title:"x",description:"x",uncertain:"x",passage_ids:[1]}]},[{id:1,section:"mdna",body:"x"}]).risks).toEqual([]);
  });
});