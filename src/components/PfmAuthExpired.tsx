import { Link } from "react-router-dom";
import { KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PFM_RECONNECT_PATH } from "@/lib/pfm-errors";

/**
 * Estado vazio acionável quando o Post for Me devolve 401.
 * Substitui o banner cru "Invalid or expired token" por um CTA pra reconectar.
 */
export function PfmAuthExpired({
  title = "Sua chave do Post for Me expirou",
  description = "A chave salva nas configurações foi revogada ou venceu. Gere uma nova em app.postforme.dev/settings e atualize aqui pra voltar a publicar e ver a agenda.",
  compact = false,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-center"
          : "rounded-lg border border-amber-500/40 bg-amber-500/5 p-6 text-center"
      }
    >
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
        <KeyRound className="h-4 w-4 text-amber-500" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {!compact && (
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
      )}
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link to={PFM_RECONNECT_PATH}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Reconectar Post for Me
        </Link>
      </Button>
    </div>
  );
}