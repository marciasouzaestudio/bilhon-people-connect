/**
 * Carregamento centralizado dos perfis de marca (brand_profiles).
 * Fonte única para o Studio e demais telas — a marca é a raiz da criação.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeBrand, type BrandProfile } from "@/lib/brand";

export function useBrands() {
  const { user } = useAuth();
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setBrands([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    if (!error) {
      setBrands((data || []).map((d) => normalizeBrand(d as Record<string, unknown>)));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const defaultBrand = brands.find((b) => b.is_default) || brands[0] || null;

  return { brands, defaultBrand, loading, reload };
}
