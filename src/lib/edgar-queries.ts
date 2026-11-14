import { queryOptions } from "@tanstack/react-query";

import { getCompanyFinancials, searchCompanies } from "./edgar.functions";

export const financialsQuery = (ticker: string) =>
  queryOptions({
    queryKey: ["financials", ticker],
    queryFn: () => getCompanyFinancials({ data: { ticker } }),
    staleTime: 30 * 60 * 1000,
  });

export const searchQuery = (q: string) =>
  queryOptions({
    queryKey: ["company-search", q],
    queryFn: () => searchCompanies({ data: { q } }),
    staleTime: 10 * 60 * 1000,
    enabled: q.trim().length > 0,
  });
