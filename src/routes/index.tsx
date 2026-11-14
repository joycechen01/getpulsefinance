import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
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
        <section className="editorial-masthead animate-rise pt-12">
          <div className="mb-4 text-xs text-teal">
            SEC-grounded research
          </div>
          <h1 className="landing-title font-display font-medium">
            Pulse Finance
          </h1>
          <p className="landing-tagline mt-3 text-foreground">Know what you own.</p>
          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Pulse Finance reads the SEC filings of every company you own and tells you what changed and
            why it matters, with the source passage behind every claim.
          </p>
          <div className="mt-8 max-w-lg">
            <div className="mb-2 text-xs text-muted-foreground">Look up any company, no account needed</div>
            <CompanySearch placeholder="Search a ticker or company, e.g. NVDA" />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to={signedIn ? "/home" : "/auth"}>
                {signedIn ? "Open your portfolio" : "Sign up to track a portfolio"} <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
        <section className="py-8">
          <h2>Company research</h2>
          <div className="mt-6 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {COMPANIES.map((c) => (
              <Link key={c.ticker} to="/company/$ticker" params={{ticker:c.ticker}} className="group flex items-center justify-between gap-4 border-t py-5">
                <span><span className="figure block text-xs text-muted-foreground">{c.ticker}</span><span className="mt-1 block font-display text-xl text-foreground">{c.name}</span></span>
                <ArrowRight className="size-4 shrink-0 text-primary" />
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
