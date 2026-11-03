/**
 * Helpers para tratar erros de autenticação do Post for Me de forma consistente
 * em toda a UI. O proxy devolve 401 com a string "Invalid or expired token"
 * quando a `x-pfm-api-key` salva no `user_configs` foi revogada/expirou.
 */

const PFM_AUTH_HINTS = [
  "invalid or expired token",
  "unauthorized",
  "401",
];

export function isPfmAuthError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return PFM_AUTH_HINTS.some((hint) => msg.includes(hint));
}

/** Rota canônica pra reconectar/atualizar a chave do Post for Me. */
export const PFM_RECONNECT_PATH = "/setup?manage=1";