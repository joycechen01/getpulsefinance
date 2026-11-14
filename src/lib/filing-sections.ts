// Pure: turn an SEC filing's HTML into the sections we analyse, split into paragraph passages.
// No I/O so it stays testable.

export type SectionId = "risk" | "mdna" | "competition" | "items";
export const SECTION_LABEL: Record<SectionId, string> = {
  risk: "Risk factors",
  mdna: "Management’s discussion (MD&A)",
  competition: "Competition (Item 1)",
  items: "8-K items",
};

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", bull: "•", hellip: "…", reg: "®", trade: "™", copy: "©",
};

function decode(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML → plain text with one paragraph per line. */
export function htmlToText(html: string): string {
  let s = html
    .replace(/<ix:header[\s\S]*?<\/ix:header>/gi, " ")
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, "");
  s = decode(s).replace(/\u00a0/g, " ");
  return s
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !/^(\d{1,3}|page \d+|table of contents)$/i.test(l))
    .join("\n");
}

type Bound = { start: RegExp; end: RegExp };

const TENK: Partial<Record<SectionId, Bound>> = {
  risk: { start: /^item\s*1a\b/i, end: /^item\s*(1b|1c|2)\b/i },
  mdna: { start: /^item\s*7\b(?!\s*a)(?![.\s]*a\b)/i, end: /^item\s*(7a|8)\b/i },
};
const TENQ: Partial<Record<SectionId, Bound>> = {
  mdna: { start: /^item\s*2\.?\s*[:.\-–—]?\s*management/i, end: /^item\s*(3|4)\b/i },
  risk: { start: /^item\s*1a\.?\s*[:.\-–—]?\s*risk/i, end: /^item\s*(2|3|4|5|6)\b/i },
};
const BUSINESS: Bound = { start: /^item\s*1\b(?![0-9a-z])/i, end: /^item\s*1a\b/i };

// Fallback for filings that use titled sections without "Item" numbers (e.g. Intel).
const TITLED: Partial<Record<SectionId, Bound>> = {
  risk: { start: /^risk factors$/i, end: /^(other key information|quantitative and qualitative|financial statements|unresolved staff|legal proceedings|unregistered sales)/i },
  mdna: {
    start: /^management.s discussion and analysis( of financial condition and results of operations)?( \(md&a\))?$/i,
    end: /^(quantitative and qualitative|risk factors|financial statements|controls and procedures)/i,
  },
};

const isHeadingLine = (l: string) => l.length < 160;

/** Longest block between a start heading and an end heading (skips the table of contents). */
function sliceSection(lines: string[], b: Bound): string[] {
  let best: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (!isHeadingLine(l) || !b.start.test(l)) continue;
    let j = i + 1;
    while (j < lines.length && !(isHeadingLine(lines[j]!) && b.end.test(lines[j]!))) j++;
    const block = lines
      .slice(i + 1, j)
      // drop running page headers such as "MD&A 31" or a repeated section title
      .filter((x) => !(x.length < 50 && (b.start.test(x) || /^[A-Za-z&'’ ]{2,40} \d{1,3}$/.test(x) || /^(md&a|risk factors)$/i.test(x))));
    if (block.join(" ").length > best.join(" ").length) best = block;
  }
  return best;
}

function competitionFrom(business: string[]): string[] {
  const i = business.findIndex((l) => l.length < 60 && /^competiti(on|ve)\b/i.test(l));
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < business.length && out.length < 15; j++) {
    const l = business[j]!;
    // next short title-like heading ends the subsection
    if (out.length > 0 && l.length < 60 && !/[.:;,]$/.test(l) && /^[A-Z]/.test(l)) break;
    out.push(l);
  }
  return out;
}

function eightKItems(lines: string[]): string[] {
  const i = lines.findIndex((l) => isHeadingLine(l) && /^item\s*\d\.\d{2}\b/i.test(l));
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i; j < lines.length; j++) {
    const l = lines[j]!;
    if (/^(signatures?|item\s*9\.01)\b/i.test(l)) break;
    out.push(l);
  }
  return out;
}

const MAX_PASSAGE = 1800;

/** Paragraph passages: short heading lines are prefixed onto the next paragraph; long ones split at sentences. */
export function toPassages(lines: string[]): string[] {
  const out: string[] = [];
  let carry = "";
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (l.length < 90 && !/[.;:]$/.test(l)) {
      carry = carry ? `${carry} — ${l}` : l;
      continue;
    }
    const text = carry ? `${carry}: ${l}` : l;
    carry = "";
    if (text.length <= MAX_PASSAGE) {
      out.push(text);
      continue;
    }
    let buf = "";
    for (const s of text.split(/(?<=[.!?])\s+(?=[A-Z“"(])/)) {
      if (buf && buf.length + s.length > MAX_PASSAGE) {
        out.push(buf);
        buf = s;
      } else buf = buf ? `${buf} ${s}` : s;
    }
    if (buf) out.push(buf);
  }
  return out.filter((p) => p.length >= 60);
}

export function extractSections(html: string, form: string): Partial<Record<SectionId, string[]>> {
  const lines = htmlToText(html).split("\n");
  const base = form.replace(/\/A$/, "");
  const res: Partial<Record<SectionId, string[]>> = {};
  if (base === "8-K") {
    const p = toPassages(eightKItems(lines));
    if (p.length) res.items = p;
    return res;
  }
  const bounds = base === "10-K" || base === "20-F" ? TENK : TENQ;
  for (const [id, b] of Object.entries(bounds) as [SectionId, Bound][]) {
    let p = toPassages(sliceSection(lines, b));
    if (!p.length && TITLED[id]) p = toPassages(sliceSection(lines, TITLED[id]!));
    if (p.length) res[id] = p;
  }
  if (base === "10-K") {
    const biz = sliceSection(lines, BUSINESS);
    const comp = toPassages(competitionFrom(biz.length ? biz : lines));
    if (comp.length) res.competition = comp;
  }
  return res;
}
