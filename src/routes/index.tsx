import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, FileText } from "lucide-react";
import { useEffect, useState } from "react";

import { CompanySearch } from "@/components/CompanySearch";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pulse Finance — Know what you own." },
      {
        name: "description",
        content:
          "Pulse Finance monitors the SEC filings of the companies you own, compares them with history, and explains what changed.",
      },
      { property: "og:title", content: "Pulse Finance — Know what you own." },
      {
        property: "og:description",
        content: "An AI research analyst that reads every SEC filing for your portfolio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const COMPANIES = [
  { ticker: "NVDA", name: "NVIDIA" },
  { ticker: "CRWD", name: "CrowdStrike" },
  { ticker: "INTC", name: "Intel" },
  { ticker: "TSLA", name: "Tesla" },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);
  return (
    <div className="landing-page min-h-screen">
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 md:px-6">
        <Logo />
        <Button asChild variant={signedIn ? "default" : "ghost"} size="sm">
          <Link to={signedIn ? "/home" : "/auth"}>{signedIn ? "Open portfolio" : "Sign in"}</Link>
        </Button>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 md:px-6">
        <section className="landing-intro animate-rise">
          <div className="mb-4 inline-flex items-center gap-2 text-xs text-primary">
            <FileText className="size-4" /> SEC-grounded research
          </div>
          <h1 className="landing-title font-display font-medium">
            Pulse Finance
          </h1>
          <p className="landing-tagline mt-3 text-primary">Know what you own.</p>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Behind every ticker is a company story. Follow the numbers, read what changed,
            and go straight to the source.
          </p>
          <div className="landing-search mx-auto mt-8 max-w-xl text-left">
            <div className="mb-2 text-xs text-muted-foreground">Look up any company, no account needed</div>
            <CompanySearch placeholder="Search a ticker or company, e.g. NVDA" />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="link">
              <Link to={signedIn ? "/home" : "/auth"}>
                {signedIn ? "Open your portfolio" : "Create your free portfolio"} <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
        <section className="landing-companies border-y py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2>Start with a company</h2>
            <span className="text-xs text-muted-foreground">Public filings. No account needed.</span>
          </div>
          <div className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {COMPANIES.map((c) => (
              <Link key={c.ticker} to="/company/$ticker" params={{ticker:c.ticker}} className="group flex items-center justify-between gap-4 border-t py-4">
                <span className="flex items-center gap-3"><span className="figure flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-accent text-xs text-primary">{c.ticker}</span><span className="font-display text-lg text-foreground">{c.name}</span></span>
                <ArrowUpRight className="size-4 shrink-0 text-primary" />
              </Link>
            ))}
          </div>
        </section>

      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Data from SEC EDGAR. Not investment advice.
      </footer>
    </div>
  );
}
