import { queryOptions } from "@tanstack/react-query";

import { searchCompanies } from "./edgar.functions";
import { getCompany, getPortfolio, getQuotes } from "./portfolio.functions";

export const searchQuery = (q: string) =>
  queryOptions({
    queryKey: ["company-search", q],
    queryFn: () => searchCompanies({ data: { q } }),
    staleTime: 10 * 60 * 1000,
    enabled: q.trim().length > 0,
  });

export const portfolioQuery = () =>
  queryOptions({ queryKey: ["portfolio"], queryFn: () => getPortfolio(), staleTime: 60 * 1000 });

export const companyQuery = (ticker: string) =>
  queryOptions({
    queryKey: ["company", ticker.toUpperCase()],
    queryFn: () => getCompany({ data: { ticker } }),
    staleTime: 10 * 60 * 1000,
  });

export const quotesQuery = (tickers: string[]) =>
  queryOptions({
    queryKey: ["quotes", ...tickers],
    queryFn: () => getQuotes({ data: { tickers } }),
    staleTime: 5 * 60 * 1000,
    enabled: tickers.length > 0,
  });
