import { useEffect, useMemo, useState } from "react";
import { Heart, MessageCircle, Eye, Share2, Bookmark, Users, ExternalLink, BarChart3, Loader2, Info, ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePfmAccounts, usePfmAccountFeed } from "@/hooks/use-social";
import { normalizePfmFeed, type PfmFeedPost, type PfmFeedMetrics } from "@/lib/api";
import { PLATFORMS } from "@/lib/platforms";
import type { Platform } from "@/types";

function fmtNum(n?: number): string {
  if (n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const METRIC_DEFS: { key: keyof PfmFeedMetrics; label: string; icon: React.ReactNode }[] = [
  { key: "likes", label: "Curtidas", icon: <Heart className="h-3.5 w-3.5" /> },
  { key: "comments", label: "Comentários", icon: <MessageCircle className="h-3.5 w-3.5" /> },
  { key: "views", label: "Visualizações", icon: <Eye className="h-3.5 w-3.5" /> },
  { key: "shares", label: "Compart.", icon: <Share2 className="h-3.5 w-3.5" /> },
  { key: "saves", label: "Salvos", icon: <Bookmark className="h-3.5 w-3.5" /> },
  { key: "reach", label: "Alcance", icon: <Users className="h-3.5 w-3.5" /> },
];

function PostCard({ post }: { post: PfmFeedPost }) {
  const present = METRIC_DEFS.filter((m) => post.metrics[m.key] !== undefined);
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
          {post.thumbUrl ? (
            <img src={post.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{fmtDate(post.postedAt)}</span>
            {post.platformUrl && (
              <a href={post.platformUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title="Abrir na rede">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm">{post.caption || <span className="italic text-muted-foreground">Sem legenda</span>}</p>
          {present.length ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {present.map((m) => (
                <span key={m.key} className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={m.label}>
                  {m.icon}
                  <span className="font-medium text-foreground">{fmtNum(post.metrics[m.key])}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs italic text-muted-foreground">Métricas ainda não disponíveis para este post.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function PostPerformance() {
  const { data: accounts = [], isLoading: accountsLoading } = usePfmAccounts();
  const [accountId, setAccountId] = useState<string>("");

  useEffect(() => {
    if (!accountId && accounts.length) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const { data: feedRaw, isLoading: feedLoading, error } = usePfmAccountFeed(accountId || null);
  const { posts } = useMemo(() => normalizePfmFeed(feedRaw), [feedRaw]);
  const selectedAccount = accounts.find((a) => a.id === accountId);

  if (accountsLoading) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  if (!accounts.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nenhuma conta conectada</p>
          <p className="max-w-sm text-xs text-muted-foreground">Conecte uma rede social no onboarding ou em Configurações para ver o desempenho real dos seus posts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Desempenho por post — dados nativos da rede</h3>
          <p className="text-xs text-muted-foreground">Métricas oficiais via Post for Me (sem scraping).</p>
        </div>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Selecione a conta" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => {
              const cfg = PLATFORMS[a.platform as Platform];
              return (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex items-center gap-2">
                    {cfg?.icon}
                    <span className="truncate">{a.username || a.name || cfg?.name || a.platform}</span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {selectedAccount && (
        <Badge variant="secondary" className="gap-1">
          {PLATFORMS[selectedAccount.platform as Platform]?.icon}
          {PLATFORMS[selectedAccount.platform as Platform]?.name || selectedAccount.platform}
        </Badge>
      )}

      {feedLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Não foi possível carregar o feed desta conta. {error instanceof Error ? error.message : ""}
          </CardContent>
        </Card>
      ) : posts.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum post no feed ainda</p>
            <p className="max-w-sm text-xs text-muted-foreground">Publique por aqui (ou direto na rede) para ver as métricas aparecerem.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          A disponibilidade de métricas varia por rede: o Instagram pode levar até 48h; o LinkedIn só expõe métricas de páginas de empresa; o Bluesky não expõe visualizações. Requer conta conectada com permissão de feed.
        </p>
      </div>
    </div>
  );
}
