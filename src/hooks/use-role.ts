import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "user";

/**
 * Lê os papéis (roles) do usuário atual via tabela `user_roles` (RLS limita ao próprio user).
 */
export function useRole() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) { setRoles([]); setLoading(false); return; }
    (async () => {
      const { data } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => Promise<{ data: { role: AppRole }[] | null }>;
          };
        };
      })
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!active) return;
      setRoles((data ?? []).map((r) => r.role));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user, authLoading]);

  return { roles, isAdmin: roles.includes("admin"), loading };
}
