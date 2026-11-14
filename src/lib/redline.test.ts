import { describe, expect, it } from "vitest";

import { diffSection } from "./redline";
import { extractSections, htmlToText, toPassages } from "./filing-sections";

const P1 = "We depend on a limited number of third-party foundries to manufacture our semiconductor wafers and products.";
const P2 = "Our business could be harmed by changes in export control regulations affecting sales to customers in China.";
const P3 = "We face intense competition from large technology companies with significantly greater resources than ours.";

describe("diffSection", () => {
  it("ignores unchanged paragraphs", () => {
    expect(diffSection("risk", [P1, P2], [P1, P2])).toEqual([]);
  });
  it("tags a brand new paragraph as new", () => {
    const c = diffSection("risk", [P1], [P1, P3]);
    expect(c.map((x) => x.tag)).toEqual(["new"]);
  });
  it("tags a dropped paragraph as removed", () => {
    const c = diffSection("risk", [P1, P2], [P1]);
    expect(c).toHaveLength(1);
    expect(c[0]!.tag).toBe("removed");
  });
  it("tags a paragraph with added sentences as expanded", () => {
    const more = `${P2} In the current quarter new license requirements were imposed on our data center products shipped to the region.`;
    const c = diffSection("risk", [P2], [more]);
    expect(c[0]!.tag).toBe("expanded");
    expect(c[0]!.added[0]).toMatch(/license requirements/);
  });
  it("tags a small wording change as reworded", () => {
    const tweak = P2.replace("could be harmed", "may be adversely affected");
    expect(diffSection("risk", [P2], [tweak])[0]!.tag).toBe("reworded");
  });
});

describe("filing sections", () => {
  it("converts html to paragraph lines", () => {
    expect(htmlToText("<p>Hello&#160;<b>world</b></p><p>12</p><div>Next&amp;more</div>")).toBe("Hello world\nNext&more");
  });
  it("picks the real section, not the table of contents", () => {
    const body = "<p>Item 1A. Risk Factors</p><p>Item 1B. Unresolved</p>" +
      "<p>Item 1A. Risk Factors</p><p>" + P1 + "</p><p>" + P2 + "</p><p>Item 1B. Unresolved Staff Comments</p><p>None.</p>";
    const s = extractSections(body, "10-K");
    expect(s.risk).toEqual([P1, P2]);
  });
  it("attaches short headings to the following paragraph", () => {
    expect(toPassages(["Supply chain", P1])).toEqual([`Supply chain: ${P1}`]);
  });
});
