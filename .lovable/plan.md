# Pulse Finance: Phase 1 plan

## Is the brief doable?
Yes. The current Ledgerline app already covers part of step 3: it reads SEC data for any company and charts it. A few parts of the brief need changes or have limits:

- **Stock prices:** Finnhub needs a free account and API key. Until you add one, prices show "Price unavailable" rather than made-up numbers.
- **Email (Phase 4):** sending needs a domain you own. You don't have one yet, so emails wait. Everything else can be built first.
- **Audio (Phase 4):** ElevenLabs needs an account, or the app's built-in text-to-speech can do it with no extra account. I suggest the built-in option.
- **Market context:** I suggest the built-in AI instead of a Perplexity account, but it can't search the news. Price moves can come from Finnhub instead.
- **SEC limits:**
  - Section extraction (Phase 2) relies on reading the filing pages, and some companies lay them out unusually, so extraction will be best-effort.
  - Segment and KPI figures aren't available as structured data, which the brief already notes.
  - Competitors named only in general terms can't be compared, and the brief already handles that.
- **Unsubscribe:** the brief asks for an unsubscribe link that turns off digests in Settings. Lovable's email service already adds an unsubscribe link to every email. The in-app Settings switch stays as well.

## Phase 1: what gets built
1. **New brand and design:** rename to Pulse Finance with a new look, a premium "research terminal" style that is calm and high-contrast with a clear hierarchy. The current charts carry over in the new style.
2. **Accounts:**
   - Email/password sign-up and Google sign-in.
   - A public landing page and sign-in page; everything else requires sign-in.
   - Each user's data is private.
3. **Onboarding:** add tickers, or "Load demo portfolio" (NVDA, CRWD, INTC, TSLA), then land on the portfolio home.
4. **Portfolio:**
   - Add or remove tickers, with optional position size and average purchase price. Tickers are checked against the SEC company list.
   - A holdings table on the home screen.
5. **SEC data saved in the database:** filing history and financial facts are stored once and reused, with a polite request rate to the SEC.
6. **Company page:**
   - Description.
   - Six headline cards with year-on-year change and a small trend line.
   - Metric groups for Growth, Cash and Balance sheet.
   - A filing list (10-K, 10-Q, 8-K) linking to the SEC.
   - Fiscal labels as each company reports them.
   - "Not reported" when a figure is missing.
   - "Calculated metric" badges on computed figures.
7. **Info icons:** every metric gets a tooltip that opens on hover, tap or keyboard focus. The wording comes from your glossary and is stored in one file.
8. **Prices:** price and day change on the holdings table from Finnhub, cached a few minutes and labeled with source and time. This works once you add the key.
9. **Settings page:**
   - Delivery email.
   - Digest email on/off and audio on/off. These switches are stored now and take effect in Phase 4.
10. **Testing:** check the whole flow with the four demo companies.

The Profitability, Quality of earnings and Per share metric groups follow right after Phase 1, as the brief orders.

## Technical details
- Enable Lovable Cloud.
- **Tables:**
  - `profiles`, `portfolios` and `holdings` are owner-only.
  - `companies`, `filings` and `financial_facts` are readable by signed-in users and written only by server code.
- Reuse `edgar-parse.ts` and extend it with a per-metric tag fallback list, year-to-date cash-flow-to-quarter conversion, gross profit fallback and trailing-twelve-month helpers. Each rule gets a unit test.
- SEC fetches stay in server functions with a contact User-Agent. Data is refreshed when older than a day.
- Store the Finnhub key as a secret; the quote server function caches results for 5 minutes.
- **Routes:**
  - `/` landing, `/auth` sign-in.
  - Signed-in pages: `/home`, `/onboarding`, `/company/$ticker`, `/settings`.
  - The current chart view becomes part of the company page.
