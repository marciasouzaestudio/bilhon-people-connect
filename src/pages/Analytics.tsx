import { useState, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Heart,
  Eye,
  MessageCircle,
  Sparkles,
  RefreshCw,
  Loader2,
  Trophy,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Share2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Star,
  TrendingDown,
  Lightbulb,
  Globe,
  Palette,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/contexts/AppContext";
import { usePfmAccounts } from "@/hooks/use-social";
import { PostPerformance } from "@/components/analytics/PostPerformance";
import { supabase } from "@/integrations/supabase/client";
import * as api from "@/lib/api";
import type { ProfileAnalytics } from "@/lib/api";
import { PLATFORMS } from "@/lib/platforms";
import { userStorage } from "@/lib/storage";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";


// ─── Helpers ─────────────────────────────────────────────────────

function formatNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function platformIcon(platform: string): React.ReactNode {
  const p = PLATFORMS[platform as keyof typeof PLATFORMS];
  return p?.icon ?? <Globe className="inline h-[1em] w-[1em]" />;
}

function platformName(platform: string): string {
  return PLATFORMS[platform as keyof typeof PLATFORMS]?.name ?? platform;
}

// Resolve o token de accent bos p/ cor concreta — var(--bl-*) não resolve em atributo SVG (AP-055)
let _bosAccentCache: string | null = null;
function bosAccent(): string {
  if (_bosAccentCache) return _bosAccentCache;
  if (typeof window !== "undefined") {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--bl-accent").trim();
    if (v) { _bosAccentCache = v; return v; }
  }
  return "#e85600";
}

function platformColor(platform: string): string {
  const colors: Record<string, string> = {
    instagram: "#E1306C",
    twitter: "#1DA1F2",
    facebook: "#1877F2",
    linkedin: "#0A66C2",
    tiktok: "#010101",
    youtube: "#FF0000",
    threads: "#000000",
    pinterest: "#E60023",
    bluesky: "#0085ff",
  };
  return colors[platform] ?? bosAccent();
}

function engagementLevel(rate: number | null): { label: string; color: string; emoji: string } {
  if (rate == null) return { label: "Iniciar", color: "text-muted-foreground", emoji: "🎯" };
  if (rate >= 6) return { label: "Excelente", color: "text-green-500", emoji: "🔥" };
  if (rate >= 3) return { label: "Bom", color: "text-blue-500", emoji: "⚡" };
  if (rate >= 1) return { label: "Médio", color: "text-yellow-500", emoji: "📈" };
  return { label: "Baixo", color: "text-red-500", emoji: "💪" };
}

// ─── Gamification System ──────────────────────────────────────────

interface AchievementBadge {
  id: string;
  label: string;
  emoji: string;
  description: string;
  unlocked: boolean;
  color: string;
}

interface PlatformGoal {
  label: string;
  current: number;
  target: number;
  emoji: string;
}

function computeSocialScore(analytics: ProfileAnalytics[]): number {
  if (!analytics.length) return 0;
  let score = 0;
  const maxScore = 100;

  // Presence: +3 points per active platform (max 27)
  const activePlatforms = analytics.filter((a) => a.followers > 0 || a.posts > 0);
  score += Math.min(27, activePlatforms.length * 3);

  // Followers: up to 25 points (logarithmic scale)
  const totalFollowers = analytics.reduce((s, a) => s + (a.followers ?? 0), 0);
  if (totalFollowers > 0) score += Math.min(25, Math.round(Math.log10(totalFollowers) * 6));

  // Engagement: up to 25 points
  const withEng = analytics.filter((a) => a.engagementRate != null);
  if (withEng.length > 0) {
    const avgEng = withEng.reduce((s, a) => s + (a.engagementRate ?? 0), 0) / withEng.length;
    score += Math.min(25, Math.round(avgEng * 4));
  }

  // Content consistency: up to 15 points (platforms with posts)
  const withPosts = analytics.filter((a) => (a.posts ?? 0) > 0);
  score += Math.min(15, withPosts.length * 3);

  // Enrichment bonus: +8 points if enrichment data exists
  const withEnrichment = analytics.filter((a) => a.enrichment);
  if (withEnrichment.length > 0) score += 8;

  return Math.min(maxScore, score);
}

function computeBadges(analytics: ProfileAnalytics[]): AchievementBadge[] {
  const totalFollowers = analytics.reduce((s, a) => s + (a.followers ?? 0), 0);
  const activePlatforms = analytics.filter((a) => a.followers > 0).length;
  const withEng = analytics.filter((a) => a.engagementRate != null);
  const avgEng = withEng.length > 0 ? withEng.reduce((s, a) => s + (a.engagementRate ?? 0), 0) / withEng.length : 0;
  const hasEnrichment = analytics.some((a) => a.enrichment);
  const totalPosts = analytics.reduce((s, a) => s + (a.posts ?? 0), 0);

  return [
    { id: "first_steps", label: "Primeiros Passos", emoji: "👣", description: "Conectou a primeira rede", unlocked: activePlatforms >= 1, color: "from-green-500/20 to-green-600/10" },
    { id: "multi_platform", label: "Multi-Plataforma", emoji: "🌐", description: "3+ redes com seguidores", unlocked: activePlatforms >= 3, color: "from-blue-500/20 to-blue-600/10" },
    { id: "social_empire", label: "Império Social", emoji: "👑", description: "5+ redes ativas", unlocked: activePlatforms >= 5, color: "from-yellow-500/20 to-yellow-600/10" },
    { id: "century", label: "Centenário", emoji: "💯", description: "100+ seguidores total", unlocked: totalFollowers >= 100, color: "from-purple-500/20 to-purple-600/10" },
    { id: "thousand", label: "Mil Forte", emoji: "🚀", description: "1.000+ seguidores total", unlocked: totalFollowers >= 1000, color: "from-pink-500/20 to-pink-600/10" },
    { id: "engagement_pro", label: "Engagement Pro", emoji: "🔥", description: "Engajamento médio > 3%", unlocked: avgEng >= 3, color: "from-orange-500/20 to-orange-600/10" },
    { id: "viral", label: "Viral", emoji: "⚡", description: "Engajamento > 10%", unlocked: avgEng >= 10, color: "from-red-500/20 to-red-600/10" },
    { id: "content_creator", label: "Criador de Conteúdo", emoji: "✍️", description: "50+ posts publicados", unlocked: totalPosts >= 50, color: "from-teal-500/20 to-teal-600/10" },
    { id: "deep_analyst", label: "Analista Profundo", emoji: "🔬", description: "Usou dados enriquecidos", unlocked: hasEnrichment, color: "from-indigo-500/20 to-indigo-600/10" },
  ];
}

function computePlatformGoals(profile: ProfileAnalytics): PlatformGoal[] {
  const goals: PlatformGoal[] = [];
  const f = profile.followers ?? 0;

  // Follower milestones
  const followerTargets = [100, 500, 1000, 5000, 10000, 50000, 100000];
  const nextFollowerTarget = followerTargets.find((t) => t > f) || followerTargets[followerTargets.length - 1];
  goals.push({ label: "Seguidores", current: f, target: nextFollowerTarget, emoji: "👥" });

  // Engagement goal
  const eng = profile.engagementRate ?? 0;
  const engTargets = [1, 3, 5, 10, 15];
  const nextEngTarget = engTargets.find((t) => t > eng) || 15;
  goals.push({ label: "Engajamento", current: Math.round(eng * 10) / 10, target: nextEngTarget, emoji: "💎" });

  // Posts goal
  const p = profile.posts ?? 0;
  const postTargets = [10, 50, 100, 500, 1000];
  const nextPostTarget = postTargets.find((t) => t > p) || 1000;
  goals.push({ label: "Posts", current: p, target: nextPostTarget, emoji: "📝" });

  return goals;
}

/** Parse an action plan item into CreatePost navigation state */
function buildActionNavState(acao: { acao: string; plataforma: string; prazo: string }) {
  type PlatformName = "instagram" | "twitter" | "facebook" | "linkedin" | "tiktok" | "pinterest" | "threads" | "bluesky" | "youtube";
  const platform = acao.plataforma?.toLowerCase().replace(/\s/g, "") as PlatformName | undefined;
  const validPlatforms: PlatformName[] = ["instagram", "twitter", "facebook", "linkedin", "tiktok", "pinterest", "threads", "bluesky", "youtube"];
  const platforms: PlatformName[] = platform && validPlatforms.includes(platform) ? [platform] : [];

  // Try to extract time hints from the action text (e.g. "Quinta-feira às 22:30")
  const dayMap: Record<string, number> = {
    "domingo": 0, "segunda": 1, "terça": 2, "quarta": 3,
    "quinta": 4, "sexta": 5, "sábado": 6,
  };
  let scheduleAt: string | undefined;
  const dayMatch = acao.acao.match(/(domingo|segunda|terça|quarta|quinta|sexta|sábado)/i);
  const timeMatch = acao.acao.match(/(\d{1,2}):(\d{2})/);
  if (dayMatch && timeMatch) {
    const targetDay = dayMap[dayMatch[1].toLowerCase()];
    if (targetDay !== undefined) {
      const now = new Date();
      const currentDay = now.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const target = new Date(now);
      target.setDate(target.getDate() + daysUntil);
      target.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
      scheduleAt = target.toISOString();
    }
  }

  // Detect Instagram placement from action text
  let placement: "timeline" | "reels" | "stories" | undefined;
  const acaoLower = acao.acao.toLowerCase();
  if (acaoLower.includes("reel")) placement = "reels";
  else if (acaoLower.includes("storie") || acaoLower.includes("story")) placement = "stories";
  else if (acaoLower.includes("carrossel") || acaoLower.includes("carousel") || acaoLower.includes("foto")) placement = "timeline";

  return {
    platforms,
    prompt: acao.acao,
    scheduleAt,
    placement,
    actionLabel: acao.acao,
  };
}

const PLATFORM_TIPS: Record<string, string> = {
  instagram: "Poste Reels consistentemente — o algoritmo prioriza vídeo curto.",
  twitter: "Responda e interaja diariamente. Threads performam 3x mais que tweets solo.",
  facebook: "Use Reels e Stories. O alcance orgânico voltou a crescer com vídeo.",
  linkedin: "Publique 2-3x por semana. Posts pessoais têm 5x mais alcance que compartilhamentos.",
  tiktok: "Poste diariamente nos primeiros meses. O algoritmo recompensa consistência.",
  youtube: "Foque em Shorts para crescer rápido. Optimize títulos e thumbnails.",
  pinterest: "Pinte diariamente. Pins com texto overlay têm 60% mais saves.",
  threads: "Esteja presente nas conversas. A plataforma está em crescimento rápido.",
  bluesky: "Participe de feeds customizados. A comunidade valoriza autenticidade.",
};

interface TrendIndicatorProps {
  value: number | null;
}
function TrendIndicator({ value }: TrendIndicatorProps) {
  if (value == null || value === 0) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (value > 0) return <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />;
  return <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />;
}

// ─── Tipos de Insights Estruturados ─────────────────────────────

interface GeneralInsights {
  resumoExecutivo: string;
  scoreGeral: number;
  melhorPlataforma: { nome: string; motivo: string };
  piorPlataforma: { nome: string; motivo: string };
  melhorDiaParaPostar: { dia: string; motivo: string };
  melhorHorario: { horario: string; motivo: string };
  analiseEngajamento: { status: string; detalhes: string; comparacaoSetor: string };
  topInsights: Array<{ titulo: string; descricao: string; prioridade: string; categoria: string }>;
  planoAcao: Array<{ acao: string; plataforma: string; impactoEsperado: string; prazo: string }>;
  oportunidades: string[];
  riscos: string[];
}

interface PlatformInsight {
  score: number;
  status: string;
  resumo: string;
  pontoForte: string;
  pontoFraco: string;
  acoes: string[];
  frequenciaIdeal: string;
  tipoConteudoRecomendado: string;
  benchmarkSetor: string;
}

interface ComputedData {
  bestDays: Array<{ day: string; avgEng: number; posts: number }>;
  bestHours: Array<{ hour: string; avgEng: number; posts: number }>;
  totalFollowers: number;
  avgEngagement: string;
  totalPosts: number;
}

interface StructuredInsights {
  general: GeneralInsights | null;
  platforms: Record<string, PlatformInsight> | null;
  computed: ComputedData | null;
}

// ─── Tooltip customizado ─────────────────────────────────────────

const ChartTooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
};

// ─── Componente Principal ─────────────────────────────────────────

export default function Analytics() {
  const { config } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const pfmAccountsQuery = usePfmAccounts();

  // Analytics data (persisted)
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

  const [isFetching, setIsFetching] = useState(false);
  const [enrichEnabled, setEnrichEnabled] = useState(() => {
    try { return userStorage.get("enrich_analytics") === "true"; }
    catch { return false; }
  });
  const [structuredInsights, setStructuredInsights] = useState<StructuredInsights>(() => {
    try {
      const saved = userStorage.get("structured_insights");
      return saved ? JSON.parse(saved) : { general: null, platforms: null, computed: null };
    } catch { return { general: null, platforms: null, computed: null }; }
  });
  const [isFetchingInsights, setIsFetchingInsights] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(true);
  const [insightsTab, setInsightsTab] = useState("geral");
  const [activeTab, setActiveTab] = useState("overview");

  // ── Fetch analytics ──────────────────────────────────────────

  const handleFetchAnalytics = async () => {
    const pfmAccounts = pfmAccountsQuery.data;
    if (!pfmAccounts?.length) {
      toast({ title: "Nenhuma conta conectada", description: "Conecte redes sociais primeiro.", variant: "destructive" });
      return;
    }

    setIsFetching(true);
    try {
      const savedProfileUrls: Record<string, string> = (() => {
        try { return JSON.parse(userStorage.get("profile_urls") || "{}"); }
        catch { return {}; }
      })();

      const accountsList = api.buildAnalyticsAccounts(pfmAccounts, savedProfileUrls);

      if (!accountsList.length) {
        toast({ title: "Sem usuários para buscar", description: "Configure URLs de perfil nas Contas.", variant: "destructive" });
        setIsFetching(false);
        return;
      }

      const result = await api.fetchAnalytics(accountsList, enrichEnabled);
      setAnalytics(result.results);

      if (result.errors?.length > 0) {
        toast({ title: `${result.results.length} perfil(is) carregados, ${result.errors.length} com erro` });
      } else {
        toast({ title: "Analytics atualizados!", description: `${result.results.length} plataforma(s)` });
      }
    } catch (err) {
      toast({ title: "Erro ao buscar analytics", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  };

  // ── Fetch AI Strategic Insights (structured) ────────────────

  const handleFetchInsights = async () => {
    if (!analytics.length) {
      toast({ title: "Sem dados", description: "Carregue analytics primeiro.", variant: "destructive" });
      return;
    }
    setIsFetchingInsights(true);
    try {
      // Fetch general + per-platform insights in parallel
      const analyticsPayload = analytics.map((a) => ({
        platform: a.platform,
        username: a.username,
        followers: a.followers,
        following: a.following,
        posts: a.posts,
        engagementRate: a.engagementRate,
        avgLikes: a.avgLikes,
        avgComments: a.avgComments,
        avgViews: a.avgViews,
        recentPosts: (a.recentPosts ?? []).slice(0, 10),
        ...(a.enrichment ? {
          enrichment: {
            ...(a.enrichment.comments ? { topComments: a.enrichment.comments.slice(0, 5) } : {}),
            ...(a.enrichment.mentions ? { mentions: a.enrichment.mentions.slice(0, 5) } : {}),
            ...(a.enrichment.companyPosts ? { companyPosts: a.enrichment.companyPosts.slice(0, 3) } : {}),
            ...(a.enrichment.reels ? { reels: a.enrichment.reels.slice(0, 3) } : {}),
            ...(a.enrichment.brandMentions ? { brandMentions: a.enrichment.brandMentions.slice(0, 3) } : {}),
          },
        } : {}),
      }));

      const [generalRes, platformRes] = await Promise.all([
        supabase.functions.invoke("social_analytics-insights", {
          body: { analytics: analyticsPayload, mode: "general" },
        }),
        supabase.functions.invoke("social_analytics-insights", {
          body: { analytics: analyticsPayload, mode: "per-platform" },
        }),
      ]);

      const newInsights: StructuredInsights = {
        general: generalRes.data?.ai || null,
        platforms: platformRes.data?.ai?.platforms || null,
        computed: generalRes.data?.computed || null,
      };

      setStructuredInsights(newInsights);
      userStorage.set("structured_insights", JSON.stringify(newInsights));
      toast({ title: "Insights estratégicos gerados!" });
    } catch (err: any) {
      toast({ title: "Erro ao gerar insights", description: err?.message || "Erro", variant: "destructive" });
    } finally {
      setIsFetchingInsights(false);
    }
  };

  // ── Computed values ──────────────────────────────────────────

  const totalFollowers = useMemo(
    () => analytics.reduce((s, a) => s + (a.followers ?? 0), 0),
    [analytics]
  );
  const totalPosts = useMemo(
    () => analytics.reduce((s, a) => s + (a.posts ?? 0), 0),
    [analytics]
  );
  const avgEngagement = useMemo(() => {
    const withRate = analytics.filter((a) => a.engagementRate != null);
    if (!withRate.length) return null;
    return withRate.reduce((s, a) => s + (a.engagementRate ?? 0), 0) / withRate.length;
  }, [analytics]);
  const totalAvgLikes = useMemo(
    () => analytics.reduce((s, a) => s + (a.avgLikes ?? 0), 0),
    [analytics]
  );

  // Gamification computed values
  const socialScore = useMemo(() => computeSocialScore(analytics), [analytics]);
  const badges = useMemo(() => computeBadges(analytics), [analytics]);
  const unlockedBadges = useMemo(() => badges.filter((b) => b.unlocked), [badges]);
  const lockedBadges = useMemo(() => badges.filter((b) => !b.unlocked), [badges]);

  const bestPlatform = useMemo(
    () => analytics.length > 0
      ? analytics.reduce((best, cur) => (cur.engagementRate ?? 0) > (best.engagementRate ?? 0) ? cur : best)
      : null,
    [analytics]
  );

  const allRecentPosts = useMemo(
    () => analytics
      .flatMap((a) => (a.recentPosts ?? []).map((p) => ({ ...p, platform: a.platform, profileName: a.displayName || a.username })))
      .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
      .slice(0, 15),
    [analytics]
  );

  // Chart data
  const followersChartData = useMemo(
    () => analytics
      .filter((a) => (a.followers ?? 0) > 0)
      .map((a) => ({ name: platformName(a.platform), value: a.followers ?? 0, fill: platformColor(a.platform) }))
      .sort((a, b) => b.value - a.value),
    [analytics]
  );

  const engagementChartData = useMemo(
    () => analytics
      .filter((a) => a.engagementRate != null)
      .map((a) => ({ name: platformName(a.platform), engajamento: a.engagementRate ?? 0, fill: platformColor(a.platform) }))
      .sort((a, b) => b.engajamento - a.engajamento),
    [analytics]
  );

  const radarData = useMemo(
    () => analytics
      .filter((a) => a.followers > 0 || a.engagementRate != null)
      .map((a) => ({
        platform: platformName(a.platform),
        Seguidores: Math.min(100, ((a.followers ?? 0) / (totalFollowers || 1)) * 100),
        Engajamento: Math.min(100, (a.engagementRate ?? 0) * 10),
        Conteúdo: Math.min(100, ((a.posts ?? 0) / (totalPosts || 1)) * 100),
        Likes: Math.min(100, ((a.avgLikes ?? 0) / (totalAvgLikes || 1)) * 100),
      })),
    [analytics, totalFollowers, totalPosts, totalAvgLikes]
  );

  const topPostsChart = useMemo(
    () => allRecentPosts.slice(0, 8).map((p, i) => ({
      name: `Post ${i + 1}`,
      likes: p.likes ?? 0,
      comentários: p.comments ?? 0,
      visualizações: p.views ?? 0,
      platform: p.platform,
    })),
    [allRecentPosts]
  );

  const hasInsights = !!(structuredInsights.general || structuredInsights.platforms);

  const engLevel = engagementLevel(avgEngagement);

  // ── Render ───────────────────────────────────────────────────

  const hasData = analytics.length > 0;

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-h2Sm md:text-h2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Analytics & <span className="text-gradient-bilhon">Inteligência</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dados reais de performance + insights estratégicos com IA
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={enrichEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => {
              const next = !enrichEnabled;
              setEnrichEnabled(next);
              userStorage.set("enrich_analytics", String(next));
            }}
            className={enrichEnabled ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white" : ""}
          >
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
            {enrichEnabled ? "Enriquecido" : "Enriquecer"}
          </Button>
          <Button
            variant="outline"
            onClick={handleFetchAnalytics}
            disabled={isFetching}
            size="sm"
          >
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar Dados
          </Button>
          <Button
            onClick={handleFetchInsights}
            disabled={isFetchingInsights || !hasData}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
          >
            {isFetchingInsights ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Análise Estratégica IA
          </Button>
        </div>
      </div>

      {/* ── Insights IA Estruturados ──────────────────────────── */}
      {(hasInsights || isFetchingInsights) && (
        <Card className="border-primary/30 bg-card overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-primary" />
                Inteligência Estratégica
                {hasInsights && structuredInsights.general?.scoreGeral != null && (
                  <Badge className="ml-2 bg-primary/10 text-primary border-primary/20">
                    Score: {structuredInsights.general.scoreGeral}/100
                  </Badge>
                )}
              </CardTitle>
              {hasInsights && (
                <Button variant="ghost" size="sm" onClick={() => setInsightsExpanded((v) => !v)}>
                  {insightsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </CardHeader>
          {isFetchingInsights ? (
            <CardContent className="space-y-4 pb-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Analisando seus dados com IA... (análise geral + por plataforma)
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl border p-4 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            </CardContent>
          ) : insightsExpanded && hasInsights && (
            <CardContent className="pb-6">
              <Tabs value={insightsTab} onValueChange={setInsightsTab}>
                <TabsList className="w-full sm:w-auto mb-4">
                  <TabsTrigger value="geral">
                    <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Visão Geral
                  </TabsTrigger>
                  <TabsTrigger value="plataformas">
                    <Target className="mr-1.5 h-3.5 w-3.5" /> Por Rede
                  </TabsTrigger>
                  <TabsTrigger value="acoes">
                    <Zap className="mr-1.5 h-3.5 w-3.5" /> Plano de Ação
                  </TabsTrigger>
                  <TabsTrigger value="timing">
                    <Clock className="mr-1.5 h-3.5 w-3.5" /> Melhor Horário
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Visão Geral */}
                <TabsContent value="geral" className="space-y-4 mt-0">
                  {structuredInsights.general && (
                    <>
                      {/* Resumo executivo */}
                      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold">Resumo Executivo</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {structuredInsights.general.resumoExecutivo}
                        </p>
                      </div>

                      {/* Best/Worst platform */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Trophy className="h-4 w-4 text-green-500" />
                            <h3 className="text-sm font-semibold">Melhor Plataforma</h3>
                          </div>
                          <p className="font-semibold text-sm flex items-center gap-1.5">
                            {platformIcon(structuredInsights.general.melhorPlataforma?.nome || "")}
                            {platformName(structuredInsights.general.melhorPlataforma?.nome || "")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {structuredInsights.general.melhorPlataforma?.motivo}
                          </p>
                        </div>
                        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <h3 className="text-sm font-semibold">Precisa de Atenção</h3>
                          </div>
                          <p className="font-semibold text-sm flex items-center gap-1.5">
                            {platformIcon(structuredInsights.general.piorPlataforma?.nome || "")}
                            {platformName(structuredInsights.general.piorPlataforma?.nome || "")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {structuredInsights.general.piorPlataforma?.motivo}
                          </p>
                        </div>
                      </div>

                      {/* Engagement analysis */}
                      <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Heart className="h-4 w-4 text-pink-500" />
                          <h3 className="text-sm font-semibold">Análise de Engajamento</h3>
                          <Badge variant="outline" className="text-[10px]">
                            {structuredInsights.general.analiseEngajamento?.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{structuredInsights.general.analiseEngajamento?.detalhes}</p>
                        {structuredInsights.general.analiseEngajamento?.comparacaoSetor && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            <BarChart3 className="inline h-3 w-3 mr-1 align-text-bottom" /> {structuredInsights.general.analiseEngajamento.comparacaoSetor}
                          </p>
                        )}
                      </div>

                      {/* Top insights */}
                      {structuredInsights.general.topInsights?.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-yellow-500" /> Principais Insights
                          </h3>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {structuredInsights.general.topInsights.map((insight, i) => (
                              <div key={i} className="rounded-lg border p-3 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={insight.prioridade === "alta" ? "destructive" : "secondary"} className="text-[9px]">
                                    {insight.prioridade}
                                  </Badge>
                                  <Badge variant="outline" className="text-[9px]">{insight.categoria}</Badge>
                                </div>
                                <p className="text-sm font-medium">{insight.titulo}</p>
                                <p className="text-xs text-muted-foreground">{insight.descricao}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Opportunities & Risks */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {structuredInsights.general.oportunidades?.length > 0 && (
                          <div className="rounded-xl border border-green-500/20 p-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                              <TrendingUp className="h-4 w-4 text-green-500" /> Oportunidades
                            </h3>
                            <ul className="space-y-1.5">
                              {structuredInsights.general.oportunidades.map((o, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                                  {o}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {structuredInsights.general.riscos?.length > 0 && (
                          <div className="rounded-xl border border-orange-500/20 p-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                              <AlertTriangle className="h-4 w-4 text-orange-500" /> Riscos
                            </h3>
                            <ul className="space-y-1.5">
                              {structuredInsights.general.riscos.map((r, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <AlertTriangle className="h-3 w-3 text-orange-500 mt-0.5 shrink-0" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Tab: Por Plataforma */}
                <TabsContent value="plataformas" className="space-y-4 mt-0">
                  {structuredInsights.platforms && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {Object.entries(structuredInsights.platforms).map(([platform, insight]) => (
                        <div key={platform} className="rounded-xl border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{platformIcon(platform)}</span>
                              <div>
                                <h3 className="text-sm font-semibold">{platformName(platform)}</h3>
                                <Badge variant="outline" className="text-[9px] mt-0.5">{insight.status}</Badge>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-bold" style={{ color: platformColor(platform) }}>
                                {insight.score}
                              </span>
                              <span className="text-[10px] text-muted-foreground">/100</span>
                            </div>
                          </div>

                          <Progress value={insight.score} className="h-1.5" />

                          <p className="text-xs text-muted-foreground">{insight.resumo}</p>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-2">
                              <p className="font-medium text-green-600 mb-0.5 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ponto Forte</p>
                              <p className="text-muted-foreground">{insight.pontoForte}</p>
                            </div>
                            <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-2">
                              <p className="font-medium text-red-600 mb-0.5 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> A Melhorar</p>
                              <p className="text-muted-foreground">{insight.pontoFraco}</p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações recomendadas</p>
                            {insight.acoes?.map((acao, i) => (
                              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <Zap className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                {acao}
                              </p>
                            ))}
                          </div>

                          <div className="flex gap-2 flex-wrap text-[10px]">
                            <Badge variant="secondary"><Calendar className="h-2.5 w-2.5 mr-1" /> {insight.frequenciaIdeal}</Badge>
                            <Badge variant="secondary"><Palette className="h-2.5 w-2.5 mr-1" /> {insight.tipoConteudoRecomendado}</Badge>
                          </div>

                          {insight.benchmarkSetor && (
                            <p className="text-[10px] text-muted-foreground italic border-t pt-2">
                              <BarChart3 className="inline h-3 w-3 mr-1 align-text-bottom" /> {insight.benchmarkSetor}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Plano de Ação */}
                <TabsContent value="acoes" className="space-y-4 mt-0">
                  {structuredInsights.general?.planoAcao?.length > 0 && (
                    <div className="space-y-3">
                      {structuredInsights.general.planoAcao.map((acao, i) => {
                        const navState = buildActionNavState(acao);
                        const isCreatable = navState.platforms.length > 0;
                        return (
                          <div
                            key={i}
                            className={`rounded-xl border p-4 flex items-start gap-3 transition-all ${
                              isCreatable ? "hover:border-primary/40 hover:bg-primary/5 cursor-pointer group" : ""
                            }`}
                            onClick={isCreatable ? () => navigate("/studio", { state: navState }) : undefined}
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                              {i + 1}
                            </div>
                            <div className="flex-1 space-y-1.5">
                              <p className="text-sm font-semibold">{acao.acao}</p>
                              <div className="flex gap-2 flex-wrap items-center">
                                <Badge variant="outline" className="text-[9px]">
                                  {platformIcon(acao.plataforma)} {platformName(acao.plataforma)}
                                </Badge>
                                <Badge variant="secondary" className="text-[9px]"><Clock className="h-2.5 w-2.5 mr-0.5" /> {acao.prazo}</Badge>
                                {navState.scheduleAt && (
                                  <Badge className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                                    {new Date(navState.scheduleAt).toLocaleDateString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground flex items-start gap-1">
                                <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" /> Impacto esperado: {acao.impactoEsperado}
                              </p>
                            </div>
                            {isCreatable && (
                              <Button
                                size="sm"
                                className="shrink-0 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/20 opacity-70 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate("/studio", { state: navState });
                                }}
                              >
                                <Zap className="h-3.5 w-3.5 mr-1" />
                                Criar
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Timing */}
                <TabsContent value="timing" className="space-y-4 mt-0">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Best day */}
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <h3 className="text-sm font-semibold">Melhor Dia para Postar</h3>
                      </div>
                      {structuredInsights.general?.melhorDiaParaPostar && (
                        <div className="mb-3">
                          <p className="text-2xl font-bold text-blue-600">{structuredInsights.general.melhorDiaParaPostar.dia}</p>
                          <p className="text-xs text-muted-foreground mt-1">{structuredInsights.general.melhorDiaParaPostar.motivo}</p>
                        </div>
                      )}
                      {structuredInsights.computed?.bestDays?.length > 0 && (
                        <div className="space-y-2 border-t pt-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ranking por engajamento médio</p>
                          {structuredInsights.computed.bestDays.slice(0, 5).map((d, i) => (
                            <div key={d.day} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5">
                                <span className={`font-bold ${i === 0 ? "text-blue-600" : "text-muted-foreground"}`}>
                                  #{i + 1}
                                </span>
                                {d.day}
                              </span>
                              <span className="text-muted-foreground">
                                {Math.round(d.avgEng)} eng · {d.posts} posts
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Best hour */}
                    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <h3 className="text-sm font-semibold">Melhor Horário</h3>
                      </div>
                      {structuredInsights.general?.melhorHorario && (
                        <div className="mb-3">
                          <p className="text-2xl font-bold text-orange-600">{structuredInsights.general.melhorHorario.horario}</p>
                          <p className="text-xs text-muted-foreground mt-1">{structuredInsights.general.melhorHorario.motivo}</p>
                        </div>
                      )}
                      {structuredInsights.computed?.bestHours?.length > 0 && (
                        <div className="space-y-2 border-t pt-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Horários com mais engajamento</p>
                          {structuredInsights.computed.bestHours.slice(0, 6).map((h, i) => (
                            <div key={h.hour} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5">
                                <span className={`font-bold ${i === 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                                  #{i + 1}
                                </span>
                                {h.hour}
                              </span>
                              <span className="text-muted-foreground">
                                {Math.round(h.avgEng)} eng · {h.posts} posts
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CTA: Create post at best time */}
                  {structuredInsights.general?.melhorDiaParaPostar && structuredInsights.general?.melhorHorario && (
                    <Button
                      className="w-full bg-gradient-to-r from-blue-600 to-orange-500 hover:from-blue-700 hover:to-orange-600 text-white shadow-lg"
                      onClick={() => {
                        const dayMap: Record<string, number> = {
                          "domingo": 0, "segunda": 1, "terça": 2, "quarta": 3,
                          "quinta": 4, "sexta": 5, "sábado": 6,
                        };
                        const dayStr = structuredInsights.general?.melhorDiaParaPostar?.dia?.toLowerCase() || "";
                        const timeStr = structuredInsights.general?.melhorHorario?.horario || "";
                        const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?/);
                        const targetDay = Object.entries(dayMap).find(([k]) => dayStr.includes(k))?.[1];

                        let scheduleAt: string | undefined;
                        if (targetDay !== undefined && timeMatch) {
                          const now = new Date();
                          let daysUntil = targetDay - now.getDay();
                          if (daysUntil <= 0) daysUntil += 7;
                          const target = new Date(now);
                          target.setDate(target.getDate() + daysUntil);
                          target.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2] || "0", 10), 0, 0);
                          scheduleAt = target.toISOString();
                        }

                        navigate("/studio", {
                          state: {
                            prompt: `Criar post para ${dayStr} às ${timeStr}`,
                            scheduleAt,
                            actionLabel: `Agendado: ${dayStr} às ${timeStr}`,
                          },
                        });
                      }}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Criar post no melhor horário
                    </Button>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!hasData && !isFetching && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-14 w-14 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">Sem dados de analytics</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Clique em <span className="font-medium text-primary">Atualizar Dados</span> para buscar métricas reais das suas redes sociais.
              Certifique-se de ter contas conectadas em{" "}
              <Link to="/accounts" className="text-primary underline">Contas</Link>.
            </p>
            <Button onClick={handleFetchAnalytics} disabled={isFetching} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Buscar Analytics Agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Loading skeleton ───────────────────────────────────── */}
      {isFetching && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── DADOS DISPONÍVEIS ──────────────────────────────────── */}
      {hasData && (
        <>
          {/* ── KPIs Macro ───────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-primary/30 bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Seguidores</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-stat-number nums-tabular font-semibold text-foreground">{formatNum(totalFollowers)}</div>
                <p className="mt-1 text-xs text-muted-foreground">Em {analytics.length} plataforma(s)</p>
              </CardContent>
            </Card>

            <Card className="border-pink-500/30 bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Engajamento Médio</CardTitle>
                <Heart className="h-4 w-4 text-pink-500" />
              </CardHeader>
              <CardContent>
                <div className="text-stat-number nums-tabular font-semibold text-pink-600">
                  {avgEngagement != null ? `${avgEngagement.toFixed(2)}%` : "—"}
                </div>
                <p className={`mt-1 text-xs font-medium ${engLevel.color}`}>{engLevel.label}</p>
              </CardContent>
            </Card>

            <Card className="border-orange-500/30 bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Posts</CardTitle>
                <BookOpen className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-stat-number nums-tabular font-semibold text-orange-600">{formatNum(totalPosts)}</div>
                <p className="mt-1 text-xs text-muted-foreground">Publicações acumuladas</p>
              </CardContent>
            </Card>

            <Card className="border-yellow-500/30 bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Melhor Plataforma</CardTitle>
                <Trophy className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                {bestPlatform ? (
                  <>
                    <div className="flex items-center gap-2 text-2xl font-bold text-foreground">
                      <span>{platformIcon(bestPlatform.platform)}</span>
                      <span>{platformName(bestPlatform.platform)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(bestPlatform.engagementRate ?? 0).toFixed(2)}% de engajamento
                    </p>
                  </>
                ) : <div className="text-2xl font-bold text-muted-foreground">—</div>}
              </CardContent>
            </Card>
          </div>

          {/* ── Social Score + Badges ──────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Social Score Ring */}
            <Card className="border-primary/30 bg-card overflow-hidden">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="relative w-32 h-32 mb-3">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                    <circle
                      cx="60" cy="60" r="52" fill="none"
                      strokeWidth="8"
                      strokeLinecap="round"
                      stroke="url(#scoreGradient)"
                      strokeDasharray={`${(socialScore / 100) * 327} 327`}
                      style={{ transition: "stroke-dasharray 1s ease-out" }}
                    />
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={bosAccent()} />
                        <stop offset="100%" stopColor={bosAccent()} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-gradient-bilhon">
                      {socialScore}
                    </span>
                    <span className="text-[10px] text-muted-foreground">/ 100</span>
                  </div>
                </div>
                <p className="font-semibold text-sm">Social Score</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {socialScore >= 80 ? "Presença excepcional!" :
                   socialScore >= 60 ? "Muito bom! Continue crescendo." :
                   socialScore >= 40 ? "Progresso sólido. Expanda mais." :
                   socialScore >= 20 ? "Bom começo! Ative mais redes." :
                   "Comece conectando suas redes!"}
                </p>
              </CardContent>
            </Card>

            {/* Badges Grid */}
            <Card className="sm:col-span-2 border-yellow-500/20 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Conquistas
                  <Badge className="ml-auto bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px]">
                    {unlockedBadges.length}/{badges.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`rounded-xl p-2.5 text-center transition-all ${
                        badge.unlocked
                          ? `bg-gradient-to-br ${badge.color} border border-white/10 shadow-sm`
                          : "bg-muted/30 opacity-40 grayscale"
                      }`}
                      title={badge.description}
                    >
                      <div className="text-2xl mb-1">{badge.emoji}</div>
                      <p className="text-[9px] font-medium leading-tight">{badge.label}</p>
                    </div>
                  ))}
                </div>
                {lockedBadges.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" />
                    Próxima: <span className="font-medium">{lockedBadges[0].label}</span> — {lockedBadges[0].description}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Tabs de análise ──────────────────────────────────── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="platforms">Por Plataforma</TabsTrigger>
              <TabsTrigger value="posts">Top Posts</TabsTrigger>
              <TabsTrigger value="charts">Gráficos</TabsTrigger>
            </TabsList>

            {/* ── Tab: Visão Geral (Gamified) ─────────────────── */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Ranking de plataformas — gamificado */}
              <Card className="card-premium overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    Ranking de Performance
                  </CardTitle>
                  <CardDescription>Plataformas ordenadas por engajamento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...analytics]
                    .sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))
                    .map((profile, idx) => {
                      const maxEng = Math.max(...analytics.map((a) => a.engagementRate ?? 0)) || 1;
                      const pct = ((profile.engagementRate ?? 0) / maxEng) * 100;
                      const level = engagementLevel(profile.engagementRate);
                      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                      const isTop = idx < 3;
                      return (
                        <div
                          key={profile.platform}
                          className={`rounded-xl p-3 space-y-2 transition-all ${
                            isTop
                              ? "bg-gradient-to-r from-muted/80 to-transparent border border-white/5"
                              : "bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className={`text-lg ${isTop ? "" : "text-muted-foreground"}`}>{medal}</span>
                              <span className="text-lg">{platformIcon(profile.platform)}</span>
                              <div>
                                <span className="font-semibold text-sm">{platformName(profile.platform)}</span>
                                <span className="text-xs text-muted-foreground ml-1.5">@{profile.username}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{level.emoji}</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                level.color === "text-green-500" ? "bg-green-500/15 text-green-400" :
                                level.color === "text-blue-500" ? "bg-blue-500/15 text-blue-400" :
                                level.color === "text-yellow-500" ? "bg-yellow-500/15 text-yellow-400" :
                                level.color === "text-red-500" ? "bg-red-500/15 text-red-400" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {profile.engagementRate != null ? `${profile.engagementRate.toFixed(1)}%` : level.label}
                              </span>
                            </div>
                          </div>
                          <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                              style={{
                                width: `${Math.max(pct, 3)}%`,
                                background: `linear-gradient(90deg, ${platformColor(profile.platform)}88, ${platformColor(profile.platform)})`,
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> {formatNum(profile.followers)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" /> {formatNum(profile.avgLikes)}/post
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" /> {formatNum(profile.avgComments)}/post
                            </span>
                            {(profile.avgViews ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" /> {formatNum(profile.avgViews)}/post
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>

              {/* Platform cards com goals e dicas */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {analytics.map((profile) => {
                  const goals = computePlatformGoals(profile);
                  const level = engagementLevel(profile.engagementRate);
                  const tip = PLATFORM_TIPS[profile.platform] || "";
                  const hasData = (profile.followers ?? 0) > 0 || (profile.posts ?? 0) > 0;
                  return (
                    <Card key={profile.platform} className="card-premium overflow-hidden group">
                      <div
                        className="h-1.5 w-full"
                        style={{ background: `linear-gradient(90deg, ${platformColor(profile.platform)}66, ${platformColor(profile.platform)})` }}
                      />
                      <CardContent className="p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {profile.profileImageUrl ? (
                              <img src={profile.profileImageUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-border" />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `${platformColor(profile.platform)}22` }}>
                                {platformIcon(profile.platform)}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-sm">{platformName(profile.platform)}</p>
                              <p className="text-[10px] text-muted-foreground">@{profile.username}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg">{level.emoji}</span>
                          </div>
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="rounded-lg bg-muted/40 p-1.5">
                            <p className="text-[9px] text-muted-foreground">Seguidores</p>
                            <p className="font-bold text-xs">{formatNum(profile.followers)}</p>
                          </div>
                          <div className="rounded-lg bg-muted/40 p-1.5">
                            <p className="text-[9px] text-muted-foreground">Engajamento</p>
                            <p className={`font-bold text-xs ${level.color}`}>
                              {profile.engagementRate != null ? `${profile.engagementRate.toFixed(1)}%` : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/40 p-1.5">
                            <p className="text-[9px] text-muted-foreground">Likes/post</p>
                            <p className="font-bold text-xs">{formatNum(profile.avgLikes)}</p>
                          </div>
                        </div>

                        {/* Progress goals */}
                        <div className="space-y-2">
                          {goals.map((goal) => {
                            const pct = Math.min(100, (goal.current / goal.target) * 100);
                            return (
                              <div key={goal.label} className="space-y-0.5">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-muted-foreground">{goal.emoji} {goal.label}</span>
                                  <span className="font-medium tabular-nums">{formatNum(goal.current)} / {formatNum(goal.target)}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                      width: `${Math.max(pct, 2)}%`,
                                      background: pct >= 100
                                        ? "linear-gradient(90deg, #22c55e, #10b981)"
                                        : `linear-gradient(90deg, ${platformColor(profile.platform)}88, ${platformColor(profile.platform)})`,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Motivational tip */}
                        {!hasData ? (
                          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2.5 text-center">
                            <p className="text-[10px] text-primary font-medium">Hora de começar!</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{tip}</p>
                          </div>
                        ) : tip ? (
                          <div className="rounded-lg bg-muted/30 p-2 flex items-start gap-1.5">
                            <Lightbulb className="h-3 w-3 text-yellow-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{tip}</p>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── Tab: Por Plataforma ──────────────────────────── */}
            <TabsContent value="platforms" className="space-y-6 mt-6">
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {analytics.map((profile) => {
                  const chartData = (profile.recentPosts ?? [])
                    .slice(0, 7)
                    .map((p, i) => ({ name: `P${i + 1}`, likes: p.likes ?? 0, comentários: p.comments ?? 0 }));
                  const level = engagementLevel(profile.engagementRate);
                  return (
                    <Card key={`${profile.platform}-${profile.username}`} className="card-premium overflow-hidden">
                      <div className="h-1.5 w-full" style={{ background: platformColor(profile.platform) }} />
                      <CardContent className="p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-center gap-3">
                          {profile.profileImageUrl ? (
                            <img src={profile.profileImageUrl} alt={profile.displayName} className="h-12 w-12 rounded-full object-cover ring-2 ring-border" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-2xl">
                              {platformIcon(profile.platform)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{profile.displayName || profile.username}</p>
                            <p className="text-xs text-muted-foreground">@{profile.username} · {platformName(profile.platform)}</p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${level.color} border-current`}>
                            {level.label}
                          </Badge>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          {[
                            { label: "Seguidores", value: formatNum(profile.followers) },
                            { label: "Seguindo", value: formatNum(profile.following) },
                            { label: "Posts", value: formatNum(profile.posts) },
                            { label: "Eng.", value: profile.engagementRate != null ? `${profile.engagementRate.toFixed(1)}%` : "—" },
                            { label: "Avg Likes", value: formatNum(profile.avgLikes) },
                            { label: "Avg Com.", value: formatNum(profile.avgComments) },
                          ].map((stat) => (
                            <div key={stat.label} className="rounded-lg bg-muted/50 p-2">
                              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                              <p className="font-semibold mt-0.5">{stat.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Chart */}
                        {chartData.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Posts recentes — likes × comentários</p>
                            <ResponsiveContainer width="100%" height={80}>
                              <BarChart data={chartData} barGap={2}>
                                <XAxis dataKey="name" hide />
                                <YAxis hide />
                                <Tooltip contentStyle={ChartTooltipStyle} />
                                <Bar dataKey="likes" fill={platformColor(profile.platform)} radius={[3, 3, 0, 0]} />
                                <Bar dataKey="comentários" fill={`${platformColor(profile.platform)}66`} radius={[3, 3, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {/* Enrichment data */}
                        {profile.enrichment && (
                          <div className="space-y-2">
                            {/* Comments (YouTube / TikTok) */}
                            {profile.enrichment.comments && profile.enrichment.comments.length > 0 && (
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                                  <MessageCircle className="h-3 w-3" /> Top Comentários
                                </p>
                                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                  {profile.enrichment.comments.slice(0, 5).map((c, i) => (
                                    <div key={i} className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px]">
                                      <span className="font-medium">{c.author}</span>
                                      <span className="text-muted-foreground ml-1.5">{c.text.slice(0, 120)}{c.text.length > 120 ? "…" : ""}</span>
                                      {c.likes > 0 && <span className="ml-1.5 text-muted-foreground">♥ {c.likes}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Mentions (Instagram) */}
                            {profile.enrichment.mentions && profile.enrichment.mentions.length > 0 && (
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                                  <Users className="h-3 w-3" /> Menções Recentes
                                </p>
                                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                  {profile.enrichment.mentions.slice(0, 5).map((m, i) => (
                                    <div key={i} className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px]">
                                      <span className="font-medium">@{m.username}</span>
                                      <span className="text-muted-foreground ml-1.5">{m.text.slice(0, 100)}{m.text.length > 100 ? "…" : ""}</span>
                                      <span className="ml-1.5 text-muted-foreground">♥ {m.likes}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Company Posts (LinkedIn) */}
                            {profile.enrichment.companyPosts && profile.enrichment.companyPosts.length > 0 && (
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" /> Posts da Empresa
                                </p>
                                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                  {profile.enrichment.companyPosts.slice(0, 3).map((p, i) => (
                                    <div key={i} className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px]">
                                      <p className="text-muted-foreground truncate">{p.text.slice(0, 120)}{p.text.length > 120 ? "…" : ""}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">♥ {p.likes} · 💬 {p.comments} · ↗ {p.shares}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Reels (Facebook) */}
                            {profile.enrichment.reels && profile.enrichment.reels.length > 0 && (
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                                  <Eye className="h-3 w-3" /> Reels
                                </p>
                                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                  {profile.enrichment.reels.slice(0, 3).map((r, i) => (
                                    <div key={i} className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px]">
                                      <p className="text-muted-foreground truncate">{r.text.slice(0, 120)}{r.text.length > 120 ? "…" : ""}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">♥ {r.likes} · 💬 {r.comments} · 👁 {formatNum(r.views)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Transcripts (YouTube) */}
                            {profile.enrichment.transcripts && profile.enrichment.transcripts.length > 0 && (
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" /> Transcrição
                                </p>
                                <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px] max-h-20 overflow-y-auto">
                                  <p className="font-medium mb-0.5">{profile.enrichment.transcripts[0].title}</p>
                                  <p className="text-muted-foreground">{profile.enrichment.transcripts[0].text.slice(0, 300)}{profile.enrichment.transcripts[0].text.length > 300 ? "…" : ""}</p>
                                </div>
                              </div>
                            )}

                            {/* Brand Mentions (LinkedIn) */}
                            {profile.enrichment.brandMentions && profile.enrichment.brandMentions.length > 0 && (
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" /> Menções da Marca
                                </p>
                                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                  {profile.enrichment.brandMentions.slice(0, 3).map((bm, i) => (
                                    <div key={i} className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px]">
                                      <p className="text-muted-foreground truncate">{bm.text.slice(0, 120)}{bm.text.length > 120 ? "…" : ""}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">♥ {bm.likes} · 💬 {bm.comments} · ↗ {bm.shares}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* No posts state */}
                        {profile.posts === 0 && !profile.enrichment && (
                          <div className="rounded-lg border border-dashed p-3 text-center">
                            <p className="text-xs text-muted-foreground">Sem posts para analisar</p>
                            <Link to="/studio">
                              <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1">
                                Criar primeiro post →
                              </Button>
                            </Link>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── Tab: Top Posts ───────────────────────────────── */}
            <TabsContent value="posts" className="mt-6">
              {allRecentPosts.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center py-12 text-center">
                    <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum post encontrado nos dados de analytics.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      Top Posts por Performance
                    </CardTitle>
                    <CardDescription>Ordenados por likes · {allRecentPosts.length} posts</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="px-4 py-3 font-medium w-6">#</th>
                          <th className="px-4 py-3 font-medium w-8">Rede</th>
                          <th className="px-4 py-3 font-medium">Conteúdo</th>
                          <th className="px-4 py-3 font-medium text-right">
                            <Heart className="inline h-3 w-3 mr-1" />Likes
                          </th>
                          <th className="px-4 py-3 font-medium text-right">
                            <MessageCircle className="inline h-3 w-3 mr-1" />Coment.
                          </th>
                          <th className="px-4 py-3 font-medium text-right">
                            <Eye className="inline h-3 w-3 mr-1" />Views
                          </th>
                          <th className="px-4 py-3 font-medium text-right">
                            <Share2 className="inline h-3 w-3 mr-1" />Eng.
                          </th>
                          <th className="px-4 py-3 font-medium text-right">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allRecentPosts.map((post, idx) => {
                          const totalFollowersForPlatform = analytics.find((a) => a.platform === post.platform)?.followers ?? 1;
                          const engRate = totalFollowersForPlatform > 0
                            ? (((post.likes ?? 0) + (post.comments ?? 0)) / totalFollowersForPlatform * 100).toFixed(2)
                            : "—";
                          return (
                            <tr key={idx} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                              <td className="px-4 py-3">
                                <span className={`text-xs font-bold ${idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-lg">{platformIcon(post.platform)}</span>
                              </td>
                              <td className="px-4 py-3 max-w-[240px]">
                                {post.mediaUrl ? (
                                  <div className="flex items-center gap-2">
                                    <img src={post.mediaUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                                    <span className="text-xs text-foreground line-clamp-2">{post.text?.slice(0, 60) || "(sem texto)"}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-foreground line-clamp-2">{post.text?.slice(0, 80) || "(sem texto)"}</span>
                                )}
                                {post.url && (
                                  <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5">
                                    Ver post <ArrowUpRight className="h-3 w-3" />
                                  </a>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatNum(post.likes)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{formatNum(post.comments)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{post.views ? formatNum(post.views) : "—"}</td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-xs font-medium">{engRate !== "—" ? `${engRate}%` : "—"}</span>
                              </td>
                              <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                                {post.date ? new Date(post.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* ── Tab: Gráficos ────────────────────────────────── */}
            <TabsContent value="charts" className="space-y-6 mt-6">

              {/* Seguidores por plataforma */}
              {followersChartData.length > 0 && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="card-premium">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Seguidores por Plataforma
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={followersChartData} layout="vertical" barSize={20}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                          <Tooltip
                            contentStyle={ChartTooltipStyle}
                            formatter={(v: number) => [formatNum(v), "Seguidores"]}
                          />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                            {followersChartData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Engajamento por plataforma */}
                  <Card className="card-premium">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Heart className="h-4 w-4 text-pink-500" />
                        Taxa de Engajamento (%)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {engagementChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={engagementChartData} layout="vertical" barSize={20}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                            <Tooltip
                              contentStyle={ChartTooltipStyle}
                              formatter={(v: number) => [`${v.toFixed(2)}%`, "Engajamento"]}
                            />
                            <Bar dataKey="engajamento" radius={[0, 6, 6, 0]}>
                              {engagementChartData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">Sem dados de engajamento disponíveis.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Radar de performance */}
              {radarData.length > 0 && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="card-premium">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-500" />
                        Radar de Performance (% relativo)
                      </CardTitle>
                      <CardDescription>Comparação entre plataformas em múltiplas dimensões</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <RadarChart data={radarData[0] ? [
                          { metric: "Seguidores", ...Object.fromEntries(radarData.map((d) => [d.platform, d.Seguidores])) },
                          { metric: "Engajamento", ...Object.fromEntries(radarData.map((d) => [d.platform, d.Engajamento])) },
                          { metric: "Conteúdo", ...Object.fromEntries(radarData.map((d) => [d.platform, d.Conteúdo])) },
                          { metric: "Likes", ...Object.fromEntries(radarData.map((d) => [d.platform, d.Likes])) },
                        ] : []}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                          {radarData.map((d, i) => (
                            <Radar
                              key={d.platform}
                              name={d.platform}
                              dataKey={d.platform}
                              stroke={Object.values([bosAccent(), "#ec4899", "#f97316", "#06b6d4", "#84cc16"])[i % 5]}
                              fill={Object.values([bosAccent(), "#ec4899", "#f97316", "#06b6d4", "#84cc16"])[i % 5]}
                              fillOpacity={0.15}
                            />
                          ))}
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Tooltip contentStyle={ChartTooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Distribuição de seguidores (pie) */}
                  <Card className="card-premium">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-green-500" />
                        Distribuição de Seguidores
                      </CardTitle>
                      <CardDescription>Proporção do seu público por plataforma</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={followersChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={55}
                            paddingAngle={3}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                          >
                            {followersChartData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={ChartTooltipStyle}
                            formatter={(v: number) => [formatNum(v), "Seguidores"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Performance dos últimos posts */}
              {topPostsChart.length > 0 && (
                <Card className="card-premium">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      Performance dos Posts Recentes
                    </CardTitle>
                    <CardDescription>Likes e comentários por post (top 8)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={topPostsChart} barGap={4}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={ChartTooltipStyle}
                          formatter={(v: number) => [formatNum(v)]}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="likes" fill={bosAccent()} radius={[3, 3, 0, 0]} name="Likes" />
                        <Bar dataKey="comentários" fill="#ec4899" radius={[3, 3, 0, 0]} name="Comentários" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ── Desempenho nativo por post (Post for Me) ─────────── */}
      {/* Independente do Apify: usa métricas oficiais da rede via PFM feed. */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            Desempenho dos seus posts
          </CardTitle>
          <CardDescription>Métricas oficiais da rede (Post for Me) — por conta conectada.</CardDescription>
        </CardHeader>
        <CardContent>
          <PostPerformance />
        </CardContent>
      </Card>

      {/* ── CTA quando tem dados mas não tem insights ────────── */}
      {hasData && !hasInsights && !isFetchingInsights && (
        <Card className="border-primary/20 bg-card">
          <CardContent className="flex flex-col sm:flex-row items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-semibold">Pronto para insights estratégicos?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Clique em <strong>Análise Estratégica IA</strong> para que a IA analise seus dados e sugira ações concretas de crescimento.
              </p>
            </div>
            <Button
              onClick={handleFetchInsights}
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Analisar agora
            </Button>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
