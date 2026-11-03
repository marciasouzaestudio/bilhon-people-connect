/**
 * storage.ts — localStorage com escopo por usuário
 *
 * Todas as chaves são prefixadas com o userId do Supabase:
 *   app_u:<userId>:<key>
 *
 * Isso garante isolamento total entre usuários no mesmo browser.
 * Chaves sem escopo (tema, etc.) continuam usando localStorage diretamente.
 */

// Obtém o userId atual do Supabase a partir do token no localStorage.
// Evita circular dependency com AuthContext.
function getCurrentUserId(): string | null {
  try {
    // O Supabase persiste a sessão em sb-<ref>-auth-token
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const session = JSON.parse(raw);
      const userId = session?.user?.id;
      if (userId) return userId;
    }
  } catch { /* ignore */ }
  return null;
}

function scopedKey(key: string): string {
  const userId = getCurrentUserId();
  if (!userId) return `app_anon:${key}`;
  return `app_u:${userId}:${key}`;
}

export const userStorage = {
  get(key: string): string | null {
    // Try new prefix first, then legacy "mega_" prefix for backwards compat
    const val = localStorage.getItem(scopedKey(key));
    if (val !== null) return val;
    // Legacy fallback
    const userId = getCurrentUserId();
    const legacyKey = userId ? `mega_u:${userId}:${key}` : `mega_anon:${key}`;
    const legacyVal = localStorage.getItem(legacyKey);
    if (legacyVal !== null) {
      // Migrate to new prefix
      localStorage.setItem(scopedKey(key), legacyVal);
      localStorage.removeItem(legacyKey);
      return legacyVal;
    }
    return null;
  },

  set(key: string, value: string): void {
    localStorage.setItem(scopedKey(key), value);
  },

  remove(key: string): void {
    localStorage.removeItem(scopedKey(key));
  },

  /**
   * Remove TODAS as chaves deste usuário.
   * Usado no signOut para limpar dados do usuário que saiu.
   */
  clearUser(userId?: string): void {
    const uid = userId ?? getCurrentUserId();
    if (!uid) {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("app_anon:") || k.startsWith("mega_anon:"))
        .forEach((k) => localStorage.removeItem(k));
      return;
    }
    const prefix = `app_u:${uid}:`;
    const legacyPrefix = `mega_u:${uid}:`;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix) || k.startsWith(legacyPrefix))
      .forEach((k) => localStorage.removeItem(k));
  },
};
