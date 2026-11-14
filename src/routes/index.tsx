import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileSearch, FileText, LineChart } from "lucide-react";
import { useEffect, useState } from "react";

import { CompanySearch } from "@/components/CompanySearch";
import { LandingResearch } from "@/components/LandingResearch";
import { PulseLogo } from "@/components/PulseLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useReveal } from "@/lib/use-reveal";

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
    icon: LineChart,
    title: "Follow the numbers",
    text: "Key metrics from each company's filings, explained in plain language.",
  },
  {
    icon: FileSearch,
    title: "Read what changed",
    text: "See which risks are new, expanded, or gone since the last report.",
  },
  {
    icon: FileText,
    title: "Go to the source",
    text: "Every statement links to the exact passage in the SEC filing.",
  },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  const featuresReveal = useReveal();
  const closingReveal = useReveal();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);
  return (
    <div className="landing-page landing-dynamic min-h-screen">
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 md:px-6">
          <PulseLogo size={28} color="var(--color-primary)" />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to={signedIn ? "/home" : "/auth"}>{signedIn ? "Open portfolio" : "Sign in"}</Link>
            </Button>
            {!signedIn && (
              <Button asChild size="sm" className="landing-cta">
                <Link to="/auth">Create your free portfolio</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 md:px-6">
        <section className="landing-intro animate-rise">
          <div className="mb-4 inline-flex items-center gap-2 text-xs text-primary">
            <FileText className="size-4" /> Built on official SEC filings
          </div>
          <h1 className="landing-title font-display font-medium">Know what you own.</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Behind every ticker is a company story. Follow the numbers, read what changed, and go straight to the
            source.
          </p>
          <div className="landing-search mx-auto mt-8 max-w-xl text-left">
            <CompanySearch placeholder="Search a ticker or company, e.g. NVDA" actionLabel="Look up" />
            <div className="mt-2 text-center text-xs text-muted-foreground">No account needed</div>
          </div>
        </section>
        <LandingResearch />
        <section ref={featuresReveal.ref} className="landing-features" aria-label="What Pulse Finance does">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="landing-feature reveal" style={{ transitionDelay: `${i * 100}ms` }}>
              <f.icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 text-base font-medium">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
        <section ref={closingReveal.ref} className="landing-closing reveal" aria-label="Get started">
          <h2 className="font-display font-medium">Know what you own.</h2>
          <Button asChild className="mt-6">
            <Link to={signedIn ? "/home" : "/auth"}>
              {signedIn ? "Open your portfolio" : "Create your free portfolio"} <ArrowRight />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <div className="mb-3 flex justify-center text-foreground">
          <PulseLogo size={28} color="var(--color-primary)" />
        </div>
        Data from SEC EDGAR. Not investment advice.
      </footer>
    </div>
  );
}
