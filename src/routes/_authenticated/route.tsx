import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CompanySearch } from "@/components/CompanySearch";
import { PulseLogo } from "@/components/PulseLogo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppShell,
});

function AppShell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/home" aria-label="Pulse Finance home">
            <PulseLogo size={28} color="var(--color-primary)" />
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link
              to="/home"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
              activeProps={{ className: "rounded-md px-3 py-1.5 bg-secondary text-foreground" }}
            >
              Portfolio
            </Link>
          </nav>
          <div className="ml-auto hidden w-80 md:block">
            <CompanySearch placeholder="Research any company…" />
          </div>
          <Link
            to="/settings"
            aria-label="Settings"
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "rounded-md p-2 bg-secondary text-foreground" }}
          >
            <Settings className="size-4" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <CompanySearch placeholder="Research any company…" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
