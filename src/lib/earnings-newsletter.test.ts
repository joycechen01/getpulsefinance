import { expect, it } from "vitest";
import { eligibleEarnings, MAX_DIGESTS_PER_RUN, pendingDigest } from "./earnings-newsletter";
it("automatic digests are limited to five per run", () => expect(MAX_DIGESTS_PER_RUN).toBe(5));
it("never backfills a filing before subscription", () => expect(eligibleEarnings({form:"10-Q",filing_date:"2026-08-26"},"2026-11-15T00:28:00Z")).toBe(false));
it("accepts a 10-Q filed on the subscription date", () => expect(eligibleEarnings({form:"10-Q",filing_date:"2026-11-15"},"2026-11-15T00:28:00Z")).toBe(true));
it("accepts a new 10-K", () => expect(eligibleEarnings({form:"10-K",filing_date:"2026-11-16"},"2026-11-15T00:28:00Z")).toBe(true));
it("never sends an 8-K as an earnings digest", () => expect(eligibleEarnings({form:"8-K",filing_date:"2026-11-16"},"2026-11-15T00:28:00Z")).toBe(false));
it.each(["sent","sending","uncertain","failed"])("never retries an existing %s claim", status => expect(pendingDigest({status})).toBe(false));
it("requires an opt-in start date", () => expect(eligibleEarnings({form:"10-Q",filing_date:"2026-11-16"},null)).toBe(false));