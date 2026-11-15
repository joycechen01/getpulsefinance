<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- SEC EDGAR is fetched only from server code in `src/lib/edgar.server.ts` (exposed via `src/lib/edgar.functions.ts`); the SEC requires a contact User-Agent (overridable with `SEC_USER_AGENT`) and ~10 req/s, so responses are cached in memory.
- XBRL-to-period logic lives in the pure module `src/lib/edgar-parse.ts` with unit tests beside it; keep it free of I/O so it stays testable.
- Metric extraction (tag fallbacks, YTD->quarter, Q4 derivation, gross-profit fallback, TTM) lives in pure `src/lib/metrics.ts` with tests; ratios are computed in code, never by AI.
- SEC data is cached in shared tables (`companies`, `filings`, `financial_facts`) written only by server code via the admin client in `company.server.ts`; user tables (`profiles`, `holdings`) are owner-only via RLS.
- Metric tooltip text comes only from `src/lib/glossary.ts`; never generated at runtime.
- `/company/$ticker` is a public route (guest data via unauthenticated `getCompanyPublic`, shared SEC tables only); portfolio features and full metric groups require sign-in.
- Filing text: section extraction (`filing-sections.ts`) and change tagging (`redline.ts`) are pure, tested modules; passages, redlines and signals are cached once per filing in shared tables by `analysis.server.ts`, so AI runs at most once per filing.
- All AI calls go through `src/lib/ai.server.ts` (streamed, strict schema); AI only cites passage ids it was given, never computes figures.

- Keep shared visual roles in the light-only semantic theme and shared Logo component, with editorial layout classes in global CSS; this keeps publication-style brand updates separate from financial logic.
- Phase 3 filing research is cached per annual accession in server-only `filing_research` with no anon/authenticated grants or read policies; authenticated research functions expose scoped results, and pure `research.ts` validates literal competitor evidence, conservative SEC registrant matches, specific shared-risk keys and four-quarter TTM comparisons so AI never calculates figures or supplies outside competitors.
- Gmail digests use authenticated on-demand server functions, require the signed-in email to match the connected mailbox, derive recipients from owner-only profiles, and atomically claim unique account/company/period delivery rows before calling Gmail; unconfirmed sends never retry automatically.
- Automatic earnings checks use a distinct managed hourly route, owner-verified Gmail, a database lease and subscription-date guard, and at most five holdings per run; durable pause status prevents blocked reviews from repeating and existing delivery claims are never replayed.
- Phase 5 uses pure SEC item/CEO-CFO and fiscal-quarter validation; server-only event and transcript caches feed protected functions, event emails have separate opt-in and unique owner/accession claims, and transcript comparisons must cite both speaker passages and SEC passages.

- Landing research uses the existing public company query and pure metric helpers; this keeps interactive previews SEC-backed without exposing portfolio data or introducing another calculation path.
- Holdings quotes use an authenticated owner-scoped function and server-only Finnhub connector gateway helper; credentials stay in request headers, validated provider values preserve day changes and timestamps, and browser queries refresh every five minutes without durable worker state.
- Company News uses an authenticated function and server-only Finnhub company-news helper with a short in-memory cache; headlines are labeled outside news, never SEC evidence or AI-rewritten.
- Typography uses one type scale in the "Type scale" block of `src/styles.css` (unlayered h1/h2/h3 rules override size utilities); add new sizes there instead of per-page overrides so headings stay consistent.
- Portfolio CSV import parses in pure, tested `portfolio-csv.ts` (header detection, strict amounts, merged duplicate tickers) and saves rows one at a time through `addHolding`; missing position fields are omitted so an existing holding keeps its saved position.

- Earnings email HTML and plain text share the pure digest formatter, website-matched email-theme tokens and cited content; table-based 600px layouts and CID-attached PNG logo/evidence icons preserve mailbox compatibility without changing delivery or calculation logic.
