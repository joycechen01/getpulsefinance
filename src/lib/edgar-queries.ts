import { queryOptions } from "@tanstack/react-query";

import { askCompany, getChanges, getCompanySignals, getPortfolioSignals } from "./analysis.functions";
import { searchCompanies } from "./edgar.functions";
import { getCompany, getCompanyPublic, getPortfolio, getQuotes } from "./portfolio.functions";

export const searchQuery = (q: string) =>
  queryOptions({
    queryKey: ["company-search", q],
    queryFn: () => searchCompanies({ data: { q } }),
    staleTime: 10 * 60 * 1000,
    enabled: q.trim().length > 0,
  });

export const portfolioQuery = () =>
  queryOptions({ queryKey: ["portfolio"], queryFn: () => getPortfolio(), staleTime: 60 * 1000 });

export const companyQuery = (ticker: string, signedIn = true) =>
  queryOptions({
    queryKey: ["company", ticker.toUpperCase(), signedIn ? "user" : "guest"],
    queryFn: () => (signedIn ? getCompany({ data: { ticker } }) : getCompanyPublic({ data: { ticker } })),
    staleTime: 10 * 60 * 1000,
  });

export const quotesQuery = (tickers: string[]) =>
  queryOptions({
    queryKey: ["quotes", ...tickers],
    queryFn: () => getQuotes({ data: { tickers } }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: tickers.length > 0,
  });

export const changesQuery = (ticker: string) =>
  queryOptions({
    queryKey: ["changes", ticker.toUpperCase()],
    queryFn: () => getChanges({ data: { ticker } }),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

export const signalsQuery = (ticker: string) =>
  queryOptions({
    queryKey: ["signals", ticker.toUpperCase()],
    queryFn: () => getCompanySignals({ data: { ticker } }),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

export const portfolioSignalsQuery = () =>
  queryOptions({ queryKey: ["portfolio-signals"], queryFn: () => getPortfolioSignals(), staleTime: 60 * 1000 });

