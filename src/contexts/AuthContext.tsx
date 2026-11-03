import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { userStorage } from "@/lib/storage";
import { invalidateOrgCache } from "@/lib/org";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthEnabled: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      // Supabase not configured — skip auth, allow access
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      currentUserIdRef.current = s?.user?.id ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      const nextUserId = s?.user?.id ?? null;
      if (currentUserIdRef.current !== nextUserId) {
        // Identidade REALMENTE mudou (login, logout, troca de conta): invalida
        // cache e troca a referência do objeto `user`.
        invalidateOrgCache();
        currentUserIdRef.current = nextUserId;
        setUser(s?.user ?? null);
      }
      // Em TOKEN_REFRESHED / foco de aba o Supabase reemite o evento com o MESMO
      // usuário porém um objeto novo. Manter a referência de `user` estável evita
      // o re-render/refetch em cascata que fazia os menus recarregarem e apagava
      // o que estava sendo digitado. A sessão (token novo) é sempre atualizada.
      setSession(s);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name?: string) => {
    if (!supabaseConfigured) return { error: "Autenticação não configurada" };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name || "" } },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    if (!supabaseConfigured) return { error: "Autenticação não configurada" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    // Limpa todos os dados do usuário atual antes de deslogar
    userStorage.clearUser();
    invalidateOrgCache();
    if (supabaseConfigured) {
      await supabase.auth.signOut();
    }
    // Zera o estado EXPLICITAMENTE. A guarda de dedup do refresh (que compara
    // currentUserIdRef com o próximo id) ignoraria o SIGNED_OUT se o ref já
    // estivesse nulo — era isso que fazia o botão "Sair" não deslogar.
    currentUserIdRef.current = null;
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    if (!supabaseConfigured) return { error: "Autenticação não configurada" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    if (!supabaseConfigured) return { error: "Autenticação não configurada" };
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isAuthEnabled: supabaseConfigured,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
