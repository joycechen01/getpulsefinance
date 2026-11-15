/** SEC supplies a filing date, not an intraday publication timestamp. */
export const MAX_DIGESTS_PER_RUN = 5;
export function eligibleEarnings(filing: { form: string; filing_date: string }, since: string | null) {
  return !!since && (filing.form === "10-Q" || filing.form === "10-K") && filing.filing_date >= since.slice(0, 10);
}
export function pendingDigest(previous: { status: string } | null) {
  // Every existing claim is terminal for automation, regardless of its status.
  return previous === null;
}