import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileSearch, GitCompare, ShieldCheck } from "lucide-react";
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

const FEATURES = [
  {
    icon: FileSearch,
    title: "Reads every filing",
    text: "10-Ks, 10-Qs and 8-Ks for each holding, straight from SEC EDGAR.",
  },
  {
    icon: GitCompare,
    title: "Remembers the history",
    text: "Each new report is compared with what the company said and reported before.",
  },
  {
    icon: ShieldCheck,
    title: "Shows its evidence",
    text: "Every statement is labeled as disclosed fact, calculated metric or AI interpretation.",
  },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);
  return (
    <div className="min-h-screen hero-glow">
      <header className="flex items-center justify-between border-b bg-surface px-4 py-4 md:px-6">
        <Logo />
        <Button asChild variant={signedIn ? "default" : "ghost"} size="sm">
          <Link to={signedIn ? "/home" : "/auth"}>{signedIn ? "Open portfolio" : "Sign in"}</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 md:px-6">
        <section className="animate-rise pt-12 pb-12">
          <div className="eyebrow flex items-center gap-2">
            SEC-grounded research
          </div>
          <h1 className="mt-5 max-w-3xl text-5xl leading-[1.05] sm:text-7xl">
            Pulse Finance
          </h1>
          <p className="mt-4 font-display text-xl text-foreground">Know what you own.</p>
          <p className="mt-4 max-w-xl text-[15px] text-muted-foreground">
            Pulse Finance reads the SEC filings of every company you own and tells you what changed and
            why it matters, with the source passage behind every claim.
          </p>
          <div className="mt-9 max-w-xl">
            <div className="eyebrow mb-2">Look up any company, no account needed</div>
            <CompanySearch placeholder="Search a ticker or company, e.g. NVDA" />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to={signedIn ? "/home" : "/auth"}>
                {signedIn ? "Open your portfolio" : "Sign up to track a portfolio"} <ArrowRight />
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">Research grounded in evidence.</span>
          </div>
        </section>
        <section className="grid gap-4 pb-12 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel p-4">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-2xl">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Data from SEC EDGAR. Not investment advice.
      </footer>
    </div>
  );
}
