# Follow-up plan: competitor trends and app improvements

## 1. Competitor page (build first)

**Select all**
- Add a "Select all" / "Clear" control above the filing-named competitor list.
- Select all picks every matched competitor up to the 5-company limit (in filing order) and shows a note when more were named than can be compared.

**Trended comparison view**
- Replace the single-period bar chart with a line chart: one line per company over the last 8–12 quarters, using rolling four-quarter (TTM) values for the chosen metric (revenue growth, gross margin, operating margin, R&D share, free-cash-flow margin).
- The researched company is highlighted; peers use muted distinct colors and a legend you can click to hide/show a line.
- Hovering a point shows every company's value for that quarter, plus the period end date.
- Quarters a company did not report show a gap, never an estimate; the existing table stays below as the "latest" snapshot with SEC source links.
- Fiscal calendars differ, so points align by calendar quarter of period end, with a visible note explaining that.

## 2. Replace "Story timeline" with "News"
- Rename the company tab to **News** and replace the timeline with a list of recent headlines (last 30 days) for that company from the connected Finnhub service.
- Each item shows headline, publisher, date, short summary and a link to the original article, labeled as outside news (not SEC evidence).
- No AI rewriting, no sentiment or buy/sell language; empty or unavailable news shows a plain message.

## 3. Move "Ask" into Overview, and add Ask to the portfolio page
- Remove the separate Ask tab; place the Ask box on the Overview tab directly under the six key-metric cards.
- Add an Ask box on the portfolio page that answers across all your holdings, citing each company's SEC passages by name; if a question can't be answered from the filings, it says so.
- Same rules as today: cited answers only, no figures invented by AI, no buy/sell advice.

## 4. Suggested follow-ups (in priority order)
1. "Say versus numbers" cards — management statements next to the matching financial trend, both cited.
2. Show the competitor comparison and story timeline teaser to signed-out visitors on company pages.
3. Upcoming earnings dates and post-earnings price move using the connected Finnhub data.
4. Resume Phase 4 items when ready: automatic digests, audio, fuller comparisons, digest history.
5. Re-enable daily material-event checks when ready.

## Technical details
- Add a pure `comparisonTrend(fin, quarters)` helper in `src/lib/research.ts` that reuses the existing TTM/quarter derivation in `metrics.ts`; add unit tests (gap handling, quarter alignment, 5-company cap for select all).
- Extend the comparison server function to return per-company trend series alongside the current latest values; no AI involvement, no new data sources.
- Add an authenticated, cached (~15 min) server function calling Finnhub `company-news` through the existing connector gateway helper; remove the StoryTimeline tab usage.
- Reuse the existing Ask component on Overview; add a protected portfolio Ask function that gathers cached passages for the owner's holdings (capped per company) and requires citations tagged by ticker.
- Update `CompetitorComparison.tsx`: select-all control, Recharts `LineChart` behind `ClientOnly`, legend toggles; verify desktop and mobile with Playwright on NVDA and INTC.
