// Re-export the Lovable-managed Supabase client
// Lovable injects VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY automatically
export { supabase } from "@/integrations/supabase/client";

// Fallback embutido: as creds do projeto são públicas (anon key, protegida por RLS)
// e devem funcionar mesmo se o build publicado não injetar as envs por algum motivo.
// Sem isso o app exibe "Autenticação não configurada" no domínio publicado.
const FALLBACK_URL = "https://auytmefqnuzbktyzcled.supabase.co";
const FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1eXRtZWZxbnV6Ymt0eXpjbGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTc4MjYsImV4cCI6MjA5ODIzMzgyNn0.zIRr-xM3Z_nM3xkOKWp6J3uCRVi_fWeiGvxZlOh7Rok";

const url = (import.meta as any).env?.VITE_SUPABASE_URL || FALLBACK_URL;
const key = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_KEY;

// Allow E2E tests to bypass auth by setting VITE_E2E_BYPASS_AUTH=true
const e2eBypassAuth = (import.meta as any).env?.VITE_E2E_BYPASS_AUTH === "true";

// Considera configurado se temos URL+key válidos (não placeholders) — env real ou fallback.
const isPlaceholder = url.includes("placeholder") || key.includes("placeholder");
export const supabaseConfigured = !e2eBypassAuth && !!(url && key) && !isPlaceholder;
