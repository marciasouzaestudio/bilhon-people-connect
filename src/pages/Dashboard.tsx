import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  CalendarDays,
  Users,
  Zap,
  PenSquare,
  Image,
  ArrowRight,
  Loader2,
  RefreshCw,
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  Trophy,
  Sparkles,
  AlertTriangle,
  Settings,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/contexts/AppContext";
import { usePfmAccounts, usePfmPosts } from "@/hooks/use-social";
import { ALL_PLATFORMS, PLATFORMS } from "@/lib/platforms";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/lib/api";
import { userStorage } from "@/lib/storage";
import type { ProfileAnalytics } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function truncate(text: string, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function platformIcon(platform: string): React.ReactNode {
  const p = PLATFORMS[platform as keyof typeof PLATFORMS];
  return p?.icon ?? "🌐";
}

// ─── Component ──────────────────────────────────────────────────

export default function Dashboard() {
  const { accounts, config } = useApp();
  const scheduledPostsQuery = usePfmPosts({ status: "scheduled", limit: 50 });
  const pfmAccountsQuery = usePfmAccounts();
  const { toast } = useToast();

  // Banner de configurações pendentes (mostrado uma vez após onboarding com itens pulados)
  const [pendingDismissed, setPendingDismissed] = useState(false);
  const pendingRaw = userStorage.get("onboarding_pending");
  const pendingConfig = pendingRaw ? JSON.parse(pendingRaw) : null;
  const hasPending = !!pendingConfig && !pendingDismissed;

  const pendingItems = pendingConfig
    ? [
        !pendingConfig.pfm     && "Post for Me (publicação multi-plataforma)",
        !pendingConfig.apify   && "Apify (analytics reais)",
      ].filter(Boolean)
    : [];

  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(false);
  const [aiInsights, setAiInsights] = useState<string>("");
  const [isFetchingInsights, setIsFetchingInsights] = useState(false);

  // Persist analytics in localStorage so data survives page reload
  const [analytics, setAnalyticsState] = useState<ProfileAnalytics[]>(() => {
    try {
      const saved = userStorage.get("analytics");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const setAnalytics = (data: ProfileAnalytics[]) => {
    setAnalyticsState(data);
    userStorage.set("analytics", JSON.stringify(data));
  };

  const connectedCount = pfmAccountsQuery.data?.length ?? 0;
  const totalPlatforms = ALL_PLATFORMS.length;
  const scheduledCount = scheduledPostsQuery.data?.data?.length ?? 0;
  const isLoading = pfmAccountsQuery.isLoading;

  // Cor de chart resolvida do token --bl-accent: atributo SVG fill/stroke não
  // resolve var() de CSS (vira preto), então lemos o valor concreto em JS.
  const [chartColor, setChartColor] = useState<string>("#e85600");
  useEffect(() => {
    const read = () => {
      const node = document.querySelector(".bos-scope") ?? document.documentElement;
      const raw = getComputedStyle(node as Element).getPropertyValue("--bl-accent").trim();
      if (raw) setChartColor(raw);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => obs.disconnect();
  }, []);

  // ── Fetch analytics handler ─────────────────────────────────

  const handleFetchAnalytics = async () => {
    const pfmAccounts = pfmAccountsQuery.data;

    if (!pfmAccounts || pfmAccounts.length === 0) {
      toast({
        title: "Nenhuma conta conectada",
        description: "Conecte pelo menos uma rede social antes de buscar analytics.",
        variant: "destructive",
      });
      return;
    }

    setIsFetchingAnalytics(true);

    try {
      // Use Apify for REAL analytics (followers, likes, engagement)
      const savedProfileUrls: Record<string, string> = (() => {
        try { return JSON.parse(userStorage.get("profile_urls") || "{}"); }
        catch { return {}; }
      })();

      const accountsList = api.buildAnalyticsAccounts(pfmAccounts, savedProfileUrls);

      if (accountsList.length === 0) {
        toast({ title: "Nenhuma conta com username para buscar analytics", variant: "destructive" });
        setIsFetchingAnalytics(false);
        return;
      }

      const result = await api.fetchAnalytics(accountsList);

      setAnalytics(result.results);

      if (result.errors?.length > 0 && result.results.length > 0) {
        toast({
          title: "Alguns perfis com erro",
          description: result.errors.map((e) => `${e.platform}: ${e.error}`).join("; ").slice(0, 150),
        });
      } else if (result.errors?.length > 0 && result.results.length === 0) {
        toast({
          title: "Erro ao buscar analytics",
          description: result.errors.map((e) => `${e.platform}: ${e.error}`).join("; ").slice(0, 150),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Analytics atualizados!",
          description: `Dados de ${result.results.length} perfil(is) carregados.`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro ao buscar analytics",
        description: err?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsFetchingAnalytics(false);
    }
  };

  // ── Fetch AI insights ──────────────────────────────────────
  const handleFetchInsights = async () => {
    if (analytics.length === 0) {
      toast({ title: "Sem dados", description: "Carregue analytics primeiro.", variant: "destructive" });
      return;
    }
    setIsFetchingInsights(true);
    try {
      const summaryData = {
        analytics: analytics.slice(0, 3).map((a) => ({
          platform: a.platform,
          username: a.username,
          followers: a.followers,
          engagementRate: a.engagementRate,
          posts: a.posts,
          avgLikes: a.avgLikes,
          avgComments: a.avgComments,
        })),
        topPosts: analytics
          .flatMap((a) => (a.recentPosts ?? []).map((p) => ({ ...p, platform: a.platform })))
          .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
          .slice(0, 5),
      };
      const result = await api.generateContent({
        prompt: "Analise minha performance nas redes sociais e dê insights acionáveis em português. Seja direto e prático.",
        platforms: analytics.map((a) => a.platform),
        sourceContent: JSON.stringify(summaryData),
      });
      const text = Object.values(result.posts || {})[0] || "";
      setAiInsights(text);
    } catch (err) {
      toast({ title: "Erro ao gerar insights", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setIsFetchingInsights(false);
    }
  };

  // ── Computed KPIs ───────────────────────────────────────────

  const totalFollowers = analytics.reduce((s, a) => s + (a.followers ?? 0), 0);
  const avgEngagement =
    analytics.length > 0
      ? analytics.reduce((s, a) => s + (a.engagementRate ?? 0), 0) / analytics.length
      : 0;
  const totalPosts = analytics.reduce((s, a) => s + (a.posts ?? 0), 0);

  const bestPlatform = analytics.length > 0
    ? analytics.reduce((best, cur) =>
        (cur.engagementRate ?? 0) > (best.engagementRate ?? 0) ? cur : best
      )
    : null;

  // ── All recent posts sorted by likes ────────────────────────

  const allRecentPosts = analytics
    .flatMap((a) =>
      (a.recentPosts ?? []).map((p) => ({
        ...p,
        platform: a.platform,
        profileName: a.displayName || a.username,
      }))
    )
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    .slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Hero estático — sem MaquinaCli/shimmer */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-4 py-10 md:px-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-[280px] w-[520px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            ARKOM · SOCIAL
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            Sua marca,{" "}
            <span className="text-primary">no automático</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Conteúdo, criação e publicação em todas as redes — orquestrados pela IA Arkom.
          </p>
        </div>
      </section>

      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-h2Sm md:text-h2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <span className="text-gradient-bilhon">Dashboard</span>
        </h1>
        <p className="mt-1 text-muted-foreground">
          Visão geral da sua automação de redes sociais
        </p>
      </div>

      {/* Banner: configurações pendentes do onboarding */}
      {hasPending && pendingItems.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
          <Settings className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Configurações pendentes do setup
            </p>
            <p className="text-xs text-muted-foreground">
              Você pulou alguns itens durante o onboarding. Configure para habilitar todas as funcionalidades:
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5 mt-1">
              {pendingItems.map((item) => (
                <li key={String(item)}>{item}</li>
              ))}
            </ul>
            <Link to="/setup" className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline font-medium mt-1">
              Completar configuração <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <button
            onClick={() => {
              setPendingDismissed(true);
              userStorage.remove("onboarding_pending");
            }}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contas Conectadas</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-stat-number nums-tabular">{connectedCount}</div>
                {(() => {
                  // Progress bar based on total followers across all platforms
                  const nextMilestone = totalFollowers <= 0 ? 100
                    : totalFollowers < 1000 ? 1000
                    : totalFollowers < 5000 ? 5000
                    : totalFollowers < 10000 ? 10000
                    : totalFollowers < 50000 ? 50000
                    : totalFollowers < 100000 ? 100000
                    : totalFollowers < 500000 ? 500000
                    : 1000000;
                  const pct = totalFollowers > 0 ? Math.min((totalFollowers / nextMilestone) * 100, 100) : 0;
                  return (
                    <>
                      <div className="mt-2">
                        <Progress value={pct} className="h-1.5" />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatNumber(totalFollowers)} seguidores · meta {formatNumber(nextMilestone)}
                      </p>
                    </>
                  );
                })()}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Posts Agendados</CardTitle>
            <CalendarDays className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {scheduledPostsQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-stat-number nums-tabular">{scheduledCount}</div>
                <p className="mt-3 text-xs text-muted-foreground">Próximos 30 dias</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Templates Visuais</CardTitle>
            <Image className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-stat-number nums-tabular">25+</div>
            <p className="mt-3 text-xs text-muted-foreground">Vídeos, carroséis, infográficos</p>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Motor IA</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-stat-number flex items-center gap-2">
              Ativo
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">IA + Integração</p>
          </CardContent>
        </Card>
      </div>

      {/* ════════════════════════════════════════════════════════════
          ANALYTICS — acesso rápido ao painel dedicado
         ════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <Link to="/analytics">
          <Card className="group cursor-pointer border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 transition-all">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-white shadow-lg">
                <BarChart3 className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">Painel Analytics & IA</h3>
                  <Badge className="bg-primary/10 text-primary text-[10px]">Novo</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Seguidores, engajamento, gráficos completos, top posts + análise estratégica com IA
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        {/* Preview mini: KPIs se já tiver dados */}
        {analytics.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="card-premium">
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Seguidores</p>
                  <p className="font-bold">{formatNumber(totalFollowers)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-premium">
              <CardContent className="p-4 flex items-center gap-3">
                <Heart className="h-5 w-5 text-orange-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Engajamento Médio</p>
                  <p className="font-bold">{avgEngagement > 0 ? `${avgEngagement.toFixed(2)}%` : "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-premium">
              <CardContent className="p-4 flex items-center gap-3">
                <Trophy className="h-5 w-5 text-yellow-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Melhor Rede</p>
                  <p className="font-bold">{bestPlatform ? platformIcon(bestPlatform.platform) : "—"} {bestPlatform ? PLATFORMS[bestPlatform.platform as keyof typeof PLATFORMS]?.name : ""}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="space-y-6 hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5 text-primary" />
              Analytics das Redes Sociais
            </h2>
            <p className="text-sm text-muted-foreground">
              Dados reais de desempenho dos seus perfis
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleFetchAnalytics}
              disabled={isFetchingAnalytics}
              className="bg-gradient-to-r from-primary to-primary/70 hover:from-primary hover:to-primary/90 text-white shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
              size="lg"
            >
              {isFetchingAnalytics ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar Analytics
                </>
              )}
            </Button>
            <Button
              onClick={handleFetchInsights}
              disabled={isFetchingInsights || analytics.length === 0}
              variant="outline"
              size="lg"
            >
              {isFetchingInsights ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analisando...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />Insights IA</>
              )}
            </Button>
          </div>
        </div>

        {/* AI Insights card */}
        {aiInsights && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Insights IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
                {aiInsights}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton */}
        {isFetchingAnalytics && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-[80px] w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isFetchingAnalytics && analytics.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">
                Clique em <span className="font-semibold text-primary">'Atualizar Analytics'</span> para carregar dados das suas redes sociais
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Summary KPI cards ──────────────────────────────── */}
        {analytics.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Seguidores</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{formatNumber(totalFollowers)}</div>
                <p className="mt-1 text-xs text-muted-foreground">Em todas as plataformas</p>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Engajamento Médio</CardTitle>
                <Heart className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {avgEngagement > 0 ? `${avgEngagement.toFixed(2)}%` : "—"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Taxa média de engajamento</p>
              </CardContent>
            </Card>

            <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Posts</CardTitle>
                <PenSquare className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{formatNumber(totalPosts)}</div>
                <p className="mt-1 text-xs text-muted-foreground">Publicações em todas as redes</p>
              </CardContent>
            </Card>

            <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Melhor Plataforma</CardTitle>
                <Trophy className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                {bestPlatform ? (
                  <>
                    <div className="text-3xl font-bold text-yellow-600 flex items-center gap-2">
                      <span>{platformIcon(bestPlatform.platform)}</span>
                      <span className="text-xl">
                        {PLATFORMS[bestPlatform.platform as keyof typeof PLATFORMS]?.name ?? bestPlatform.platform}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(bestPlatform.engagementRate ?? 0).toFixed(2)}% de engajamento
                    </p>
                  </>
                ) : (
                  <div className="text-xl font-bold text-muted-foreground">—</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── No data banner ─────────────────────────────────── */}
        {analytics.length > 0 && totalFollowers === 0 && totalPosts === 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Dados ainda nao foram coletados</p>
                <p className="text-xs text-muted-foreground">Clique em "Atualizar Analytics" para carregar os dados mais recentes dos seus perfis.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Per-account analytics cards ────────────────────── */}
        {analytics.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {analytics.map((profile) => {
              const chartData = (profile.recentPosts ?? [])
                .slice(0, 6)
                .map((p, i) => ({
                  index: i + 1,
                  likes: p.likes ?? 0,
                }));

              return (
                <Card key={`${profile.platform}-${profile.username}`} className="overflow-hidden">
                  <CardContent className="p-5 space-y-4">
                    {/* Profile header */}
                    <div className="flex items-center gap-3">
                      {profile.profileImageUrl ? (
                        <img
                          src={profile.profileImageUrl}
                          alt={profile.displayName || profile.username}
                          className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/20"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-xl">
                          {platformIcon(profile.platform)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold truncate">
                            {profile.displayName || profile.username}
                          </span>
                          <span className="text-base">{platformIcon(profile.platform)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
                      </div>
                    </div>

                    {/* Instagram analytics limited badge */}
                    {profile.platform === "instagram" && profile.engagementRate == null && profile.followers > 0 && (
                      <Link to="/accounts">
                        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2 cursor-pointer hover:bg-yellow-500/10 transition-colors">
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
                          <span className="text-[10px] text-yellow-700">Analytics parcial — reconecte via Facebook</span>
                        </div>
                      </Link>
                    )}

                    {/* Big follower number */}
                    <div>
                      <div className="text-3xl font-bold tracking-tight">
                        {formatNumber(profile.followers)}
                      </div>
                      <p className="text-xs text-muted-foreground">seguidores</p>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted/50 p-2">
                        <div className="text-sm font-semibold">{formatNumber(profile.following)}</div>
                        <div className="text-[10px] text-muted-foreground">seguindo</div>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <div className="text-sm font-semibold">{formatNumber(profile.posts)}</div>
                        <div className="text-[10px] text-muted-foreground">posts</div>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <div className="text-sm font-semibold">
                          {profile.engagementRate != null ? `${profile.engagementRate.toFixed(1)}%` : "—"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">engajamento</div>
                      </div>
                    </div>

                    {/* Avg metrics row */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3 text-red-400" />
                        {formatNumber(profile.avgLikes)} méd.
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3 text-blue-400" />
                        {formatNumber(profile.avgComments)} méd.
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3 text-green-400" />
                        {formatNumber(profile.avgViews)} méd.
                      </span>
                    </div>

                    {/* Empty state when no posts */}
                    {profile.posts === 0 && profile.followers === 0 && (
                      <div className="rounded-lg border border-dashed p-3 text-center">
                        <p className="text-xs text-muted-foreground">
                          Nenhum dado encontrado. Publique conteúdo nesta rede para ver analytics.
                        </p>
                        <Link to="/studio">
                          <Button variant="link" size="sm" className="text-xs text-primary mt-1 h-auto p-0">
                            Criar post →
                          </Button>
                        </Link>
                      </div>
                    )}

                    {/* Mini bar chart - recent posts performance */}
                    {chartData.length > 0 && (
                      <div className="pt-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Likes por post recente</p>
                        <ResponsiveContainer width="100%" height={80}>
                          <BarChart data={chartData}>
                            <XAxis dataKey="index" hide />
                            <YAxis hide />
                            <Tooltip
                              formatter={(value: number) => [`${formatNumber(value)} likes`, ""]}
                              labelFormatter={() => ""}
                              contentStyle={{
                                fontSize: 12,
                                borderRadius: 8,
                                border: "1px solid hsl(var(--border))",
                                background: "hsl(var(--popover))",
                                color: "hsl(var(--popover-foreground))",
                              }}
                            />
                            <Bar dataKey="likes" fill={chartColor} radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Recent posts table ─────────────────────────────── */}
        {allRecentPosts.length > 0 && (
          <div>
            <h3 className="mb-3 text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Posts com Melhor Desempenho
            </h3>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Rede</th>
                      <th className="px-4 py-3 font-medium">Conteúdo</th>
                      <th className="px-4 py-3 font-medium text-right">
                        <Heart className="inline h-3 w-3 mr-0.5" />
                        Likes
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        <MessageCircle className="inline h-3 w-3 mr-0.5" />
                        Comentários
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        <Eye className="inline h-3 w-3 mr-0.5" />
                        Views
                      </th>
                      <th className="px-4 py-3 font-medium text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRecentPosts.map((post, idx) => (
                      <tr
                        key={idx}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="text-base">{platformIcon(post.platform)}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[280px]">
                          <span className="text-xs text-foreground">
                            {truncate(post.text, 60)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatNumber(post.likes)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatNumber(post.comments)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatNumber(post.views)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {formatDate(post.date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Ações Rápidas</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/studio">
            <Card className="group cursor-pointer border-dashed transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-white shadow-lg">
                  <PenSquare className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">Criar Post com IA</h3>
                  <p className="text-sm text-muted-foreground">Gere conteúdo otimizado para todas as redes</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
          <Link to="/studio">
            <Card className="group cursor-pointer border-dashed transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-white shadow-lg">
                  <Image className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">Criar Visual com IA</h3>
                  <p className="text-sm text-muted-foreground">Vídeos, carroséis e infográficos</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
          <Link to="/analytics">
            <Card className="group cursor-pointer border-dashed transition-all hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 text-white shadow-lg">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold group-hover:text-yellow-600 transition-colors">Análise com IA</h3>
                  <p className="text-sm text-muted-foreground">Métricas, tendências e plano de ação</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-yellow-600 transition-all group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Platforms Overview */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Redes Disponíveis</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {ALL_PLATFORMS.map((platform) => {
            const cfg = PLATFORMS[platform];
            const isConnected = (pfmAccountsQuery.data ?? []).some((a) => a.platform === platform);
            return (
              <Card
                key={platform}
                className={`relative text-center transition-all ${
                  isConnected ? "border-green-500/50 shadow-sm shadow-green-500/10" : "border-dashed opacity-60"
                }`}
              >
                <CardContent className="flex flex-col items-center gap-1 p-3">
                  <span className="text-2xl">{cfg.icon}</span>
                  <span className="text-[10px] font-medium leading-tight">{cfg.name}</span>
                  {isConnected && (
                    <Badge variant="secondary" className="mt-1 bg-green-500/10 text-green-600 text-[8px] px-1 py-0">
                      conectado
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        {pfmAccountsQuery.isError && (
          <p className="mt-2 text-sm text-destructive">
            Erro ao carregar contas: {pfmAccountsQuery.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
