import { useState } from "react";
import { Users, RefreshCw, Plus, Loader2, AlertCircle, Unlink, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectAccountDialog } from "@/components/ConnectAccountDialog";
import { useApp } from "@/contexts/AppContext";
import { usePfmAccounts } from "@/hooks/use-social";
import { ALL_PLATFORMS, PLATFORMS } from "@/lib/platforms";
import { pfmDisconnectAccount } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Accounts() {
  const { accounts } = useApp();
  const pfmAccountsQuery = usePfmAccounts();
  const [connectOpen, setConnectOpen] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDisconnect = async (pfmId: string, platformName: string) => {
    if (!confirm(`Desconectar conta do ${platformName}?`)) return;
    setDisconnectingId(pfmId);
    try {
      await pfmDisconnectAccount(pfmId);
      queryClient.invalidateQueries({ queryKey: ["pfm", "accounts"] });
      toast({ title: `${platformName} desconectado` });
    } catch (err) {
      toast({ title: "Erro ao desconectar", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-h2Sm md:text-h2">
            <Users className="h-7 w-7 text-primary" />
            Contas <span className="text-gradient-bilhon">Conectadas</span>
          </h1>
          <p className="mt-1 text-muted-foreground">Gerencie suas redes sociais conectadas via integração</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => pfmAccountsQuery.refetch()} disabled={pfmAccountsQuery.isFetching}>
            {pfmAccountsQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30"
            onClick={() => setConnectOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Conectar Rede
          </Button>
        </div>
      </div>

      {/* Connect Dialog */}
      <ConnectAccountDialog open={connectOpen} onOpenChange={setConnectOpen} />

      {/* Error */}
      {pfmAccountsQuery.isError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Erro ao carregar contas</p>
            <p className="mt-1 text-xs">{pfmAccountsQuery.error?.message}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {pfmAccountsQuery.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="card-premium">
              <CardContent className="flex items-center gap-4 p-5">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Connected Accounts via PFM — source of truth */}
      {(pfmAccountsQuery.data?.length ?? 0) > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-green-600">
            Conectadas via Post for Me ({pfmAccountsQuery.data!.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pfmAccountsQuery.data!.map((account) => {
              const cfg = PLATFORMS[account.platform as keyof typeof PLATFORMS];
              return (
                <Card key={account.id} className="card-premium border-green-500/30">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-white text-xl shadow-lg ${cfg?.bgColor ?? "bg-gray-500"}`}>
                      {cfg?.icon ?? <Globe className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{cfg?.name ?? account.platform}</h3>
                        <Badge className="bg-green-500/10 text-green-600 text-[10px]">ativo</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {account.username ? `@${account.username}` : account.name || "—"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      title="Desconectar"
                      disabled={disconnectingId === account.id}
                      onClick={() => handleDisconnect(account.id, cfg?.name ?? account.platform)}
                    >
                      {disconnectingId === account.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Unlink className="h-4 w-4" />
                      }
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Contas via Post for Me (seção acima) */}

      {/* All Platforms */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Todas as Redes Disponíveis</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_PLATFORMS.map((platform) => {
            const cfg = PLATFORMS[platform];
            const connected = accounts.find((a) => a.platform === platform);
            return (
              <Card key={platform} className={`card-premium ${connected ? "border-green-500/30" : "border-dashed"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white text-lg ${cfg.bgColor}`}>{cfg.icon}</div>
                    <div>
                      <CardTitle className="text-base">{cfg.name}</CardTitle>
                      <CardDescription>Máx: {cfg.maxChars.toLocaleString()} caracteres</CardDescription>
                    </div>
                    {connected && <Badge className="ml-auto bg-green-500/10 text-green-600">conectado</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {cfg.features.map((f) => (
                      <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                    ))}
                  </div>
                  {connected ? (
                    <p className="mt-3 text-sm text-green-600">@{connected.username || connected.fullname}</p>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full border-dashed"
                      onClick={() => setConnectOpen(true)}
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Conectar {cfg.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
