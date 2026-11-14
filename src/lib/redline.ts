// Pure: compare two versions of a filing section paragraph by paragraph and tag each change.

export type ChangeTag = "new" | "expanded" | "removed" | "reworded";
export type Change = {
  tag: ChangeTag;
  section: string;
  /** passage position in the current filing (absent for removed) */
  pos: number | null;
  /** passage position in the prior filing (absent for new) */
  priorPos: number | null;
  text: string | null;
  priorText: string | null;
  /** sentences in the current text not found in the prior one (for highlighting) */
  added: string[];
  similarity: number;
};

const STOP = new Set(
  "the a an and or of to in for on by with as at from that this these those is are was were be been be our we us it its which such may could would will can not no any all other".split(" "),
);

export function words(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9%$ ]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

export function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [s, l] = a.size < b.size ? [a, b] : [b, a];
  for (const w of s) if (l.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "");

export const SAME = 0.9;
export const MATCH = 0.45;

/** Tag changes between prior and current passages of one section. */
export function diffSection(section: string, prior: string[], current: string[]): Change[] {
  const pw = prior.map(words);
  const cw = current.map(words);
  const priorMatched = new Set<number>();
  const out: Change[] = [];

  cw.forEach((w, ci) => {
    let best = -1;
    let bestSim = 0;
    pw.forEach((p, pi) => {
      const s = similarity(w, p);
      if (s > bestSim) {
        bestSim = s;
        best = pi;
      }
    });
    const text = current[ci]!;
    if (best >= 0 && bestSim >= MATCH) priorMatched.add(best);
    if (best >= 0 && bestSim >= SAME) return;
    if (best < 0 || bestSim < MATCH) {
      out.push({ tag: "new", section, pos: ci, priorPos: null, text, priorText: null, added: [], similarity: bestSim });
      return;
    }
    const priorText = prior[best]!;
    const priorSet = new Set(sentences(priorText).map(norm));
    const added = sentences(text).filter((s) => !priorSet.has(norm(s)));
    const grew = text.length > priorText.length * 1.15 && added.some((s) => s.length > 40);
    out.push({
      tag: grew ? "expanded" : "reworded",
      section,
      pos: ci,
      priorPos: best,
      text,
      priorText,
      added,
      similarity: bestSim,
    });
  });

  prior.forEach((t, pi) => {
    if (priorMatched.has(pi)) return;
    // removed only if nothing in the current filing still resembles it
    const best = Math.max(0, ...cw.map((w) => similarity(w, pw[pi]!)));
    if (best >= MATCH) return;
    out.push({ tag: "removed", section, pos: null, priorPos: pi, text: null, priorText: t, added: [], similarity: best });
  });
  return out;
}
