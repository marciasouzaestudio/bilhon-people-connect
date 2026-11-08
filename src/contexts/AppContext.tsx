import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { AppConfig, SocialAccount, ScheduledPost } from "@/types";
import { userStorage } from "@/lib/storage";
import { supabase } from "@/lib/app-db-client";
import { getPfmUserKey, setPfmUserKey } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { requireOrgId } from "@/lib/org";

interface AppState {
  config: AppConfig;
  accounts: SocialAccount[];
  schedules: ScheduledPost[];
  isConfigured: boolean;
  onboardingCompleted: boolean;
  configLoading: boolean;
}

interface AppContextType extends AppState {
  setConfig: (config: AppConfig) => void;
  setAccounts: (accounts: SocialAccount[]) => void;
  setSchedules: (schedules: ScheduledPost[]) => void;
  resetConfig: () => void;
  completeOnboarding: (finalConfig?: AppConfig) => void;
  saveConfigToDb: (config: AppConfig) => Promise<AppConfig>;
}

const DEFAULT_CONFIG: AppConfig = {
  postformeApiKey: "",
  brandName: "Arkom Social",
  pexelsApiKey: "",
  apifyApiToken: "",
  firecrawlApiKey: "",
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<AppConfig>(() => {
    const saved = userStorage.get("config");
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [schedules, setSchedules] = useState<ScheduledPost[]>([]);
  const [configLoadingState, setConfigLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  // Post for Me é a integração core (publicação).
  const isConfigured = !!config.postformeApiKey;
  const onboardingCompleted = !!config.onboardingCompleted;

  // Recarrega config do DB sempre que o usuário autenticado mudar
  // (login, troca de conta, signOut). Sem isso, o config só é lido uma vez
  // antes da sessão hidratar e o app força /setup mesmo em contas já configuradas.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoadedUserId(null);
      setConfigLoading(false);
      return;
    }
    setConfigLoading(true);
    loadConfigFromDb().finally(() => setLoadedUserId(user.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  // configLoading "real": enquanto o config carregado NÃO for o do usuário atual,
  // considera-se carregando. Fecha a corrida em que, logo após o login, um render
  // intermediário tinha configLoading=false + onboarding=false e mandava um usuário
  // JÁ configurado para /setup em vez de cair no dashboard.
  const configLoading =
    configLoadingState || (!!user && !authLoading && loadedUserId !== user.id);

  async function loadConfigFromDb() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setConfigLoading(false); return; }

      const { data } = await supabase
        .from("user_configs")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        const loaded: AppConfig = {
          postformeApiKey: data.postforme_api_key || "",
          pexelsApiKey: data.pexels_api_key || "",
          apifyApiToken: data.apify_api_token || "",
          firecrawlApiKey: data.firecrawl_api_key || "",
          brandName: data.brand_name || "Arkom Social",
          brandLogo: data.brand_logo_url || undefined,
          // Considera onboarding completo se a flag estiver marcada OU se a chave
          // essencial (Post for Me) já existir — evita repedir credenciais a quem
          // já configurou em sessão anterior.
          onboardingCompleted: !!(data.onboarding_completed || data.postforme_api_key),
        };
        setConfigState(loaded);
        userStorage.set("config", JSON.stringify(loaded));
        setPfmUserKey(loaded.postformeApiKey);
      } else {
        // Sem linha no DB: usuário novo OU primeiro login neste browser.
        // Limpa qualquer config residual de outro usuário no mesmo navegador.
        setConfigState(DEFAULT_CONFIG);
        userStorage.set("config", JSON.stringify(DEFAULT_CONFIG));
        setPfmUserKey("");
      }
    } catch (err) {
      console.error("Failed to load config from DB:", err);
    } finally {
      setConfigLoading(false);
    }
  }

  async function saveConfigToDb(cfg: AppConfig) {
    const hasPostformeApiKey = Object.prototype.hasOwnProperty.call(cfg, "postformeApiKey");
    const cfgAlias = cfg as AppConfig & { pfmApiKey?: string };
    const hasLegacyPfmApiKey = Object.prototype.hasOwnProperty.call(cfgAlias, "pfmApiKey");
    const nextPostformeApiKey = hasPostformeApiKey
      ? (cfg.postformeApiKey ?? "")
      : hasLegacyPfmApiKey
        ? (cfgAlias.pfmApiKey ?? "")
        : (config.postformeApiKey || getPfmUserKey() || "");

    const nextConfig: AppConfig = {
      ...cfg,
      postformeApiKey: nextPostformeApiKey,
      onboardingCompleted: cfg.onboardingCompleted || config.onboardingCompleted || false,
    };

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Usuário não autenticado.");

      const row = {
        user_id: user.id,
        postforme_api_key: nextConfig.postformeApiKey || null,
        pexels_api_key: nextConfig.pexelsApiKey || null,
        apify_api_token: nextConfig.apifyApiToken || null,
        firecrawl_api_key: nextConfig.firecrawlApiKey || null,
        brand_name: nextConfig.brandName || "Arkom Social",
        brand_logo_url: nextConfig.brandLogo || null,
        onboarding_completed: nextConfig.onboardingCompleted || false,
      };

      // Upsert — try update first, insert if not exists
      const { data: existing, error: lookupError } = await supabase
        .from("user_configs")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existing) {
        const { error } = await supabase
          .from("user_configs")
          .update(row)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        // Insere com a org REAL do usuário (resolvida/reivindicada em org.ts via
        // claim_instance/claim_by_email — modelo "1 deploy = 1 org"). A RLS de
        // user_configs exige core.is_org_member(org_id), então org_id NÃO pode ser user.id.
        const org_id = await requireOrgId();
        const { error } = await supabase
          .from("user_configs")
          .insert({ ...row, org_id });
        if (error) throw error;
      }

      setConfigState(nextConfig);
      userStorage.set("config", JSON.stringify(nextConfig));
      setPfmUserKey(nextConfig.postformeApiKey);
      return nextConfig;
    } catch (err) {
      console.error("Failed to save config to DB:", err);
      throw err;
    }
  }

  const setConfig = (newConfig: AppConfig) => {
    setConfigState(newConfig);
    userStorage.set("config", JSON.stringify(newConfig));
    setPfmUserKey(newConfig.postformeApiKey);
  };

  const completeOnboarding = (finalConfig?: AppConfig) => {
    const updated = { ...(finalConfig ?? config), onboardingCompleted: true };
    setConfigState(updated);
    userStorage.set("config", JSON.stringify(updated));
    setPfmUserKey(updated.postformeApiKey);
  };

  const resetConfig = () => {
    setConfigState(DEFAULT_CONFIG);
    userStorage.remove("config");
    setAccounts([]);
    setSchedules([]);
  };

  return (
    <AppContext.Provider
      value={{
        config,
        accounts,
        schedules,
        isConfigured,
        onboardingCompleted,
        configLoading,
        setConfig,
        setAccounts,
        setSchedules,
        resetConfig,
        completeOnboarding,
        saveConfigToDb,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
