import { z } from "zod";
import { EMAIL_IMAGES } from "./email-images";
import { CALCULATED, valueOf, type Financials } from "./metrics";
import type { SignalView } from "./analysis.functions";
import { HEADLINE, fmtValue } from "./metric-config";
import { formatDate } from "./format";
import type {CallReview} from "./phase5";

export const digestInput = z.object({ ticker: z.string().trim().min(1).max(12).transform(t=>t.toUpperCase()) });
export type DigestFiling = { accession:string;form:string;filing_date:string;report_date:string|null;url:string };
export type EarningsDigest = {ticker:string;name:string;filing:DigestFiling;period:string;metrics:{label:string;value:string;kind:"fact"|"calc"}[];developments:SignalView[];reviewComplete:boolean;call?:CallReview};
export function latestEarnings<T extends {form:string;filing_date:string}>(filings:T[]):T|null {
  return filings.filter(f=>f.form==="10-Q"||f.form==="10-K").sort((a,b)=>b.filing_date.localeCompare(a.filing_date))[0]??null;
}
export function digestMetrics(fin:Financials|null,filing:DigestFiling) {
  const rows=fin?(filing.form==="10-K"?fin.annual:fin.quarterly):[];
  const row=rows.find(r=>r.end===filing.report_date);
  return {period:row?.label??(filing.report_date?`Period ended ${formatDate(filing.report_date)}`:"Period not reported"),metrics:HEADLINE.map(m=>({label:m.label,value:row?fmtValue(valueOf(rows,row,m.id),m.fmt,fin?.currency??"USD",1):"Not reported",kind:CALCULATED.has(m.id)||row?.derived.some(id=>id===m.id)||row?.calculated.some(id=>id===m.id)?"calc" as const:"fact" as const}))};
}
export function mailboxOwner(userEmail:string|undefined,mailbox:string) {return !!userEmail&&userEmail.trim().toLowerCase()===mailbox.trim().toLowerCase();}
export function digestMessageId(ticker:string,period:string) {return `pulse-earnings-${ticker.toLowerCase()}-${period.replace(/[^a-z0-9]/gi,"-").toLowerCase()}@pulsefinance.local`;}
const APP_URL = "https://getpulsefinance.lovable.app";
const DISCLAIMER = "AI-generated summary of SEC filings. Not investment advice.";
const LIMITATIONS = "SEC disclosures may be incomplete or restated. This digest does not predict future results.";
function reviewStatus(d:EarningsDigest) {
  return d.reviewComplete ? "No material developments detected in the reviewed filing evidence." : "Filing analysis is unavailable; developments have not been assessed.";
}
function callSources(d:EarningsDigest, refs:string[]) {
  return refs.flatMap(ref=>{
    const transcript=d.call?.passages.find(p=>p.id===ref);
    if(transcript)return [{label:`[Earnings call] ${transcript.speaker}, ${transcript.role} · ${d.call?.quarter} · ${ref}`,url:"https://www.alphavantage.co/documentation/#earnings-call-transcript"}];
    const filing=d.call?.filingPassages.find(p=>p.id===ref);
    return filing?[{label:`[Disclosed fact] SEC passage ${ref}`,url:filing.url}]:[];
  });
}
function callText(d:EarningsDigest) {
  if(!d.call)return [];
  return ["On the earnings call · "+d.call.quarter,...[
    {title:"Management outlook",items:d.call.summary.outlook},
    {title:"Discussion topics",items:d.call.summary.topics},
    {title:"Call versus filing",items:d.call.summary.differences},
  ].filter(g=>g.items.length).flatMap(g=>[g.title,...g.items.flatMap(p=>[
    `[AI interpretation] ${p.text}`,...callSources(d,p.refs).map(s=>`${s.label} — ${s.url}`),"",
  ])]),"What remains uncertain: "+d.call.summary.uncertain,""];
}
export function digestText(d:EarningsDigest) {
  return ["Pulse Finance — Know what you own.","Earnings briefing",`${d.name} (${d.ticker}) · ${d.period}`,
    `${d.filing.form} filed ${formatDate(d.filing.filing_date)}`,
    ...(d.filing.report_date?[`Reporting period ended ${formatDate(d.filing.report_date)}`]:[]),
    `SEC filing: ${d.filing.url}`,"","Financial snapshot",
    ...d.metrics.map(m=>`[${m.kind==="calc"?"Calculated metric":"Disclosed fact"}] ${m.label}: ${m.value}\nSource: ${d.filing.url}`),
    "","Developments to watch",...d.developments.flatMap((s,i)=>[
      `${i+1}. [AI interpretation] ${s.title}`,s.what_happened,
      ...(s.whats_new?[`What changed: ${s.whats_new}`]:[]),
      ...(s.why_it_matters?[`Why it matters: ${s.why_it_matters}`]:[]),
      ...s.citations.map(c=>`[Disclosed fact] ${c.form} filed ${formatDate(c.filing_date)} · Passage ${c.id}\nSource: ${c.url??d.filing.url}`),
      `What remains uncertain: ${s.uncertain}`,"",
    ]),...(!d.developments.length?[reviewStatus(d),""]:[]),...callText(d),
    "Research limitations",LIMITATIONS,"",`Open full analysis: ${APP_URL}/company/${encodeURIComponent(d.ticker)}`,
    "",DISCLAIMER,`Manage email preferences: ${APP_URL}/settings (turn off Earnings digest newsletter for automatic emails; Earnings digest emails for manual delivery).`,
  ].join("\n");
}
export const EMAIL_THEME={paper:"#f8f4ec",ink:"#221811",surface:"#fdfbf7",rule:"#d8d0c3",teal:"#1a5439",secondary:"#6c6156",factBg:"#ede7db",calcBg:"#ece0cc",aiBg:"#eee5f0",aiInk:"#5a3a5e",displayFont:"Fraunces, Georgia, serif",bodyFont:"\'IBM Plex Sans\', Arial, sans-serif",figureFont:"\'IBM Plex Mono\', monospace"};
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]??c));
export function digestHtml(d:EarningsDigest, inlineImages = false){
  const t=EMAIL_THEME;
  const link=(url:string,label:string)=>`<a href="${escapeHtml(url)}" style="color:${t.teal};text-decoration:underline;overflow-wrap:anywhere">${escapeHtml(label)}</a>`;
  const image=(key:keyof typeof EMAIL_IMAGES)=>inlineImages?`cid:pulse-${key}`:`data:image/png;base64,${EMAIL_IMAGES[key]}`;
  const badge=(label:string)=>{
    const kind=label==="Calculated metric"?"calc":label==="AI interpretation"?"ai":"fact";
    const bg=kind==="calc"?t.calcBg:kind==="ai"?t.aiBg:t.factBg;
    const color=kind==="calc"?t.teal:kind==="ai"?t.aiInk:t.ink;
    return `<span style="display:inline-block;padding:4px 8px;border-radius:4px;background:${bg};color:${color};font-family:${t.bodyFont};font-size:12px;line-height:18px;white-space:nowrap"><img src="${image(kind)}" width="12" height="12" alt="" style="display:inline-block;vertical-align:-1px;margin-right:4px;border:0">${escapeHtml(label)}</span>`;
  };
  const heading=(text:string)=>`<h2 style="margin:0 0 16px;font-family:${t.displayFont};font-size:24px;line-height:1.3;font-weight:500;color:${t.ink}">${escapeHtml(text)}</h2>`;
  const section=(content:string)=>`<tr><td class="content" style="padding:24px 32px;border-top:1px solid ${t.rule}">${content}</td></tr>`;
  const paragraph=(text:string)=>`<p style="margin:0 0 12px">${escapeHtml(text)}</p>`;
  const metrics=d.metrics.map(m=>`<tr>
    <th scope="row" style="padding:12px 0;border-bottom:1px solid ${t.rule};text-align:left;vertical-align:top;font-weight:400;width:58%">${escapeHtml(m.label)}<br>${badge(m.kind==="calc"?"Calculated metric":"Disclosed fact")}</th>
    <td style="padding:12px 0 12px 12px;border-bottom:1px solid ${t.rule};text-align:right;vertical-align:top;font-family:${t.figureFont};font-size:18px;font-variant-numeric:tabular-nums">${escapeHtml(m.value)}<br><span style="font-size:12px">${link(d.filing.url,"SEC source")}</span></td></tr>`).join("");
  const developments=d.developments.map((s,i)=>`<div style="${i?`border-top:1px solid ${t.rule};padding-top:20px;`:""}margin-bottom:20px">
    ${badge("AI interpretation")}<h3 style="margin:4px 0 12px;font-size:16px;line-height:1.4;font-weight:500">${i+1}. ${escapeHtml(s.title)}</h3>
    ${paragraph(s.what_happened)}
    ${s.whats_new?paragraph(`What changed: ${s.whats_new}`):""}
    ${s.why_it_matters?paragraph(`Why it matters: ${s.why_it_matters}`):""}
    <p style="margin:0 0 12px;font-size:12px">${badge("Disclosed fact")}<br>${s.citations.map(c=>link(c.url??d.filing.url,`${c.form} filed ${formatDate(c.filing_date)} · Passage ${c.id}`)).join("<br>")}</p>
    <p style="margin:0;font-size:13px;color:${t.secondary}">What remains uncertain: ${escapeHtml(s.uncertain)}</p></div>`).join("");
  const call=d.call?section(heading("On the earnings call")+paragraph(d.call.quarter)+[
    {title:"Management outlook",items:d.call.summary.outlook},
    {title:"Discussion topics",items:d.call.summary.topics},
    {title:"Call versus filing",items:d.call.summary.differences},
  ].filter(g=>g.items.length).map(g=>`<h3 style="font-size:15px;font-weight:500;margin:20px 0 12px">${g.title}</h3>`+g.items.map(p=>`${badge("AI interpretation")}${paragraph(p.text)}<p style="font-size:12px;margin:0 0 16px">${callSources(d,p.refs).map(s=>`${badge(s.label.startsWith("[Disclosed fact]")?"Disclosed fact":"Earnings call")} ${link(s.url,s.label.replace(/^\[[^\]]+\]\s*/,""))}`).join("<br>")}</p>`).join("")).join("")+`<p style="font-size:13px;color:${t.secondary};margin:0">What remains uncertain: ${escapeHtml(d.call.summary.uncertain)}</p>`):"";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(d.ticker)} earnings briefing · Pulse Finance</title><style>@media only screen and (max-width:620px){.outer{padding:12px 8px!important}.content{padding:20px 16px!important}.email-title{font-size:32px!important}}</style></head>
  <body style="margin:0;padding:0;background:${t.paper};color:${t.ink};font-family:${t.bodyFont};font-size:15px;line-height:1.6;letter-spacing:0">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(d.name)} · ${escapeHtml(d.period)}. Key financials, cited developments and research limitations.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.paper}"><tr><td class="outer" align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${t.surface};border:1px solid ${t.rule};border-collapse:collapse;text-align:left">
  <tr><td class="content" style="padding:24px 32px 20px;border-bottom:2px solid ${t.ink}"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle"><img src="${image("logo")}" width="28" height="28" alt="Pulse Finance mark" style="display:block;border:0"></td><td style="padding-left:8px;vertical-align:middle;font-family:${t.bodyFont};font-size:18px;font-weight:500;line-height:1">Pulse Finance</td></tr></table><p style="margin:4px 0 0;font-size:12px;color:${t.secondary}">Know what you own.</p></td></tr>
  <tr><td class="content" style="padding:24px 32px"><p style="margin:0 0 8px;font-size:12px;color:${t.secondary}">Earnings briefing · ${escapeHtml(d.ticker)}</p>
  <h1 class="email-title" style="margin:0 0 8px;font-family:${t.displayFont};font-size:40px;line-height:1.15;font-weight:500;overflow-wrap:anywhere">${escapeHtml(d.name)}</h1>
  <p style="margin:0 0 16px;font-size:18px">${escapeHtml(d.period)}</p><p style="margin:0;font-size:12px;color:${t.secondary}">${escapeHtml(d.filing.form)} filed ${formatDate(d.filing.filing_date)}${d.filing.report_date?`<br>Reporting period ended ${formatDate(d.filing.report_date)}`:""}<br>${link(d.filing.url,"Read the SEC filing")}</p></td></tr>
  ${section(heading("Financial snapshot")+`<table aria-label="Financial snapshot" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed">${metrics}</table>`)}
  ${section(heading("Developments to watch")+(developments||paragraph(reviewStatus(d))))}
  ${call}
  ${section(heading("Research limitations")+`<p style="margin:0 0 24px;font-size:13px;color:${t.secondary}">${LIMITATIONS}</p><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${t.ink};border-radius:6px;text-align:center"><a href="${APP_URL}/company/${encodeURIComponent(d.ticker)}" style="display:inline-block;padding:12px 20px;color:${t.paper};text-decoration:none;font-size:14px">Open full analysis</a></td></tr></table>`)}
  ${section(`<p style="margin:0 0 12px;font-size:12px;color:${t.secondary}">${DISCLAIMER}</p><p style="margin:0;font-size:12px;color:${t.secondary}">${link(`${APP_URL}/settings`,"Unsubscribe / manage email preferences")}<br>Turn off Earnings digest newsletter to stop automatic emails.</p>`)}
  </table></td></tr></table></body></html>`;
}
const b64=(s:string)=>btoa(Array.from(new TextEncoder().encode(s),b=>String.fromCharCode(b)).join(""));
export function rawDigestEmail(d:EarningsDigest,to:string,messageId:string) {
  const address=z.string().email().parse(to);
  const subject=`Pulse Finance — ${d.ticker} ${d.period} earnings digest`;
  const boundary="pulse_"+messageId.replace(/[^a-z0-9]/gi,"_");
  const relatedBoundary=boundary+"_related";
  const attachments=Object.entries(EMAIL_IMAGES).flatMap(([key,data])=>[
    `--${relatedBoundary}`,"Content-Type: image/png","Content-Transfer-Encoding: base64",`Content-ID: <pulse-${key}>`,`Content-Disposition: inline; filename="pulse-${key}.png"`,"",data.match(/.{1,76}/g)?.join("\r\n")??data,
  ]);
  const message=[`To: ${address}`,`Subject: =?UTF-8?B?${b64(subject)}?=`,`Message-ID: <${messageId}>`,"MIME-Version: 1.0",`Content-Type: multipart/alternative; boundary="${boundary}"`,"",`--${boundary}`,"Content-Type: text/plain; charset=UTF-8","",digestText(d),`--${boundary}`,`Content-Type: multipart/related; boundary="${relatedBoundary}"`,"",`--${relatedBoundary}`,"Content-Type: text/html; charset=UTF-8","",digestHtml(d,true),...attachments,`--${relatedBoundary}--`,`--${boundary}--`].join("\r\n");
  return b64(message).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}