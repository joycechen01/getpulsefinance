// Fixed tooltip text from the product brief (section 14). Never generated at runtime.
export type GlossaryEntry = { what: string; why: string; how: string };

export const GLOSSARY = {
  revenue: {
    what: "The total money the company brought in from sales.",
    why: "It shows how big the business is and whether it is growing.",
    how: "Reported directly by the company.",
  },
  revenueGrowth: {
    what: "How much revenue changed compared with an earlier period.",
    why: "Shows whether the business is speeding up or slowing down.",
    how: "(This period minus the earlier period) divided by the earlier period.",
  },
  grossMargin: {
    what: "The share of each sales dollar left after the direct cost of making the product or service.",
    why: "Higher margins mean more room to pay for everything else.",
    how: "(Revenue minus cost of revenue) divided by revenue.",
  },
  operatingMargin: {
    what: "The share of each sales dollar left after all running costs, before interest and taxes.",
    why: "Shows how profitable the core business is.",
    how: "Operating income divided by revenue.",
  },
  netIncome: {
    what: "The profit left after every cost, including interest and taxes.",
    why: "The bottom line, though one-time items can distort it.",
    how: "Reported directly by the company.",
  },
  epsDiluted: {
    what: "Profit per share, counting shares that could be created from stock awards and similar.",
    why: "Lets you compare profit to the share price.",
    how: "Net income divided by diluted shares.",
  },
  operatingCashFlow: {
    what: "The cash the day-to-day business actually generated.",
    why: "Cash is harder to flatter than profit.",
    how: "Reported directly by the company.",
  },
  capex: {
    what: "Money spent on long-lived things like factories, equipment, and data centers.",
    why: "Shows how much the business must invest to keep going and grow.",
    how: "Reported directly by the company.",
  },
  freeCashFlow: {
    what: "Cash left after the company pays for its investments.",
    why: "This is what can fund buybacks, dividends, debt repayment, or savings.",
    how: "Operating cash flow minus capital expenditure.",
  },
  fcfMargin: {
    what: "Free cash flow as a share of revenue.",
    why: "Shows how much of each sales dollar becomes spare cash.",
    how: "Free cash flow divided by revenue.",
  },
  rndPct: {
    what: "How much of sales goes into research and development.",
    why: "Shows how heavily the company invests in future products.",
    how: "R&D expense divided by revenue.",
  },
  sgaPct: {
    what: "How much of sales goes to selling, marketing, and administration.",
    why: "Rising share can mean growth is getting more expensive.",
    how: "SG&A expense divided by revenue.",
  },
  sbcPct: {
    what: "How much employees are paid in stock, relative to sales.",
    why: "It is a real cost that does not use cash but adds shares.",
    how: "Stock-based compensation divided by revenue.",
  },
  netIncomeVsOcf: {
    what: "A comparison of reported profit with cash actually generated.",
    why: "A wide, lasting gap is worth understanding.",
    how: "Both figures shown side by side.",
  },
  cash: {
    what: "Cash and investments the company can use quickly.",
    why: "The cushion for hard times and the fuel for investment.",
    how: "Cash, cash equivalents, and short-term investments.",
  },
  totalDebt: {
    what: "The money the company has borrowed.",
    why: "Debt must be repaid with interest whatever happens to the business.",
    how: "Short-term plus long-term borrowings.",
  },
  netCash: {
    what: "Cash minus debt.",
    why: "Shows whether the company could pay off its borrowings today.",
    how: "Cash minus total debt; a negative number means net debt.",
  },
  inventory: {
    what: "Products made or bought but not yet sold.",
    why: "Inventory growing faster than sales can signal weaker demand.",
    how: "Reported directly by the company.",
  },
  receivables: {
    what: "Money customers owe for sales already made.",
    why: "Receivables growing faster than sales can mean customers are paying more slowly.",
    how: "Reported directly by the company.",
  },
  deferredRevenue: {
    what: "Money customers have paid in advance for products or services not yet delivered.",
    why: "For subscription businesses it hints at future revenue.",
    how: "Reported directly by the company.",
  },
  dilutedShares: {
    what: "The number of shares, including those that could be created from stock awards.",
    why: "A rising count means each share owns a smaller piece; a falling count means buybacks.",
    how: "Reported directly by the company.",
  },
  price: {
    what: "The latest share price and its move today.",
    why: "Context only; price is not the same as business performance.",
    how: "From the market-data provider, with a timestamp.",
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

export const BADGES = {
  fact: { label: "Disclosed fact", text: "Taken directly from a company's SEC filing." },
  calc: { label: "Calculated metric", text: "Computed by Pulse Finance from numbers in SEC filings." },
  ai: { label: "AI interpretation", text: "An AI-written explanation of what the facts may mean. It can be wrong." },
  market: { label: "Market context", text: "From a non-SEC source such as price data or news." },
} as const;

export const CONFIDENCE_TEXT = "How directly the cited evidence supports the statement.";

/** Redline change tags (computed in code by comparing paragraphs). */
export const CHANGE_TAGS = {
  new: { label: "New", text: "A paragraph with no close match in the prior comparable filing." },
  expanded: { label: "Expanded", text: "A paragraph that matches one in the prior filing but adds substantial new sentences." },
  removed: { label: "Removed", text: "A paragraph from the prior filing with no close match in the latest one." },
  reworded: { label: "Reworded", text: "A routine wording change to a paragraph that is otherwise the same." },
} as const;
