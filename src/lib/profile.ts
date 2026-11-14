import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const profileQuery = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (error) throw error;
      if (data) return { ...data, email: u.user.email ?? "" };
      // Profile row is created on signup; fall back to creating it if missing.
      const { data: created, error: e2 } = await supabase
        .from("profiles")
        .insert({ id: u.user.id, delivery_email: u.user.email ?? null })
        .select()
        .single();
      if (e2) throw e2;
      return { ...created, email: u.user.email ?? "" };
    },
  });
