import { useState, useMemo } from "react";
import {
  Lightbulb,
  TrendingUp,
  BarChart3,
  Sparkles,
  Wand2,
  Loader2,
  Users,
  Heart,
  Eye,
  MessageCircle,
  Calendar,
  Clock,
  Trophy,
  Target,
  ArrowUpRight,
  FileText,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PLATFORMS } from "@/lib/platforms";
import type { Platform } from "@/types";

/** Empty-state informativo para um card de insight sem dados suficientes. */
function InsightEmpty({ hint }: { hint: string }) {
  return (
    <div className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/70" />
      <span>{hint}</span>
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>")
    .replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>")
    .replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^(.+)$/, "<p>$1</p>")
    .replace(/<p><\/p>/g, "")
    .replace(/<p>(<h[123]>)/g, "$1")
    .replace(/(<\/h[123]>)<\/p>/g, "$1")
    .replace(/<p>(<ul>)/g, "$1")
    .replace(/(<\/ul>)<\/p>/g, "$1");
}

interface AnalyticsSnapshot {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  followers: number | null;
  following: number | null;
  posts_count: number | null;
  engagement_rate: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  avg_views: number | null;
  recent_posts: any;
  fetched_at: string;
}

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function extractAllPosts(snapshots: AnalyticsSnapshot[]) {
  const posts: { platform: string; date?: Date; dayOfWeek?: number; hour?: number; likes: number; comments: number; views: number; shares: number; type?: string; caption?: string }[] = [];
  for (const s of snapshots) {
    if (!s.recent_posts || !Array.isArray(s.recent_posts)) continue;
    for (const p of s.recent_posts) {
      const date = p.timestamp || p.date || p.created_at || p.publishedAt;
      const d = date ? new Date(date) : undefined;
      posts.push({
        platform: s.platform,
        date: d,
        dayOfWeek: d ? d.getDay() : undefined,
        hour: d ? d.getHours() : undefined,
        likes: Number(p.likes || p.likesCount || 0),
        comments: Number(p.comments || p.commentsCount || 0),
        views: Number(p.views || p.viewsCount || p.playCount || 0),
        shares: Number(p.shares || p.sharesCount || 0),
        type: p.type || p.mediaType || p.postType || undefined,
        caption: p.caption || p.text || p.description || "",
      });
    }
  }
  return posts;
}

export default function Insights() {
  const { toast } = useToast();
  const [customQuestion, setCustomQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const snapshotsQuery = useQuery({
    queryKey: ["analytics_snapshots_latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_snapshots")
        .select("*")
        .order("fetched_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const seen = new Set<string>();
      const unique: AnalyticsSnapshot[] = [];
      for (const row of (data || [])) {
        const key = `${row.platform}:${row.username}`;
        if (!seen.has(key)) { seen.add(key); unique.push(row as AnalyticsSnapshot); }
      }
      return unique;
    },
    staleTime: 60_000,
  });

  const snapshots = snapshotsQuery.data || [];
  const hasData = snapshots.length > 0;
  const allPosts = useMemo(() => extractAllPosts(snapshots), [snapshots]);

  // ── DATA-DRIVEN INSIGHTS ──────────────────────────────────────

  // Best day of week (by avg engagement)
  const bestDayInsight = useMemo(() => {
    const postsWithDay = allPosts.filter((p) => p.dayOfWeek != null);
    if (postsWithDay.length < 3) return null;
    const dayStats: Record<number, { total: number; count: number }> = {};
    for (const p of postsWithDay) {
      const d = p.dayOfWeek!;
      if (!dayStats[d]) dayStats[d] = { total: 0, count: 0 };
      dayStats[d].total += p.likes + p.comments;
      dayStats[d].count += 1;
    }
    let bestDay = 0, bestAvg = 0;
    for (const [day, s] of Object.entries(dayStats)) {
      const avg = s.total / s.count;
      if (avg > bestAvg) { bestAvg = avg; bestDay = Number(day); }
    }
    return { day: DAY_NAMES[bestDay], avgEngagement: Math.round(bestAvg), sampleSize: postsWithDay.length };
  }, [allPosts]);

  // Best hour to post
  const bestHourInsight = useMemo(() => {
    const postsWithHour = allPosts.filter((p) => p.hour != null);
    if (postsWithHour.length < 3) return null;
    const hourStats: Record<number, { total: number; count: number }> = {};
    for (const p of postsWithHour) {
      const h = p.hour!;
      if (!hourStats[h]) hourStats[h] = { total: 0, count: 0 };
      hourStats[h].total += p.likes + p.comments;
      hourStats[h].count += 1;
    }
    let bestHour = 0, bestAvg = 0;
    for (const [hour, s] of Object.entries(hourStats)) {
      const avg = s.total / s.count;
      if (avg > bestAvg) { bestAvg = avg; bestHour = Number(hour); }
    }
    return { hour: bestHour, avgEngagement: Math.round(bestAvg) };
  }, [allPosts]);

  // Best content type
  const bestTypeInsight = useMemo(() => {
    const postsWithType = allPosts.filter((p) => p.type);
    if (postsWithType.length < 2) return null;
    const typeStats: Record<string, { total: number; count: number }> = {};
    for (const p of postsWithType) {
      const t = p.type!;
      if (!typeStats[t]) typeStats[t] = { total: 0, count: 0 };
      typeStats[t].total += p.likes + p.comments;
      typeStats[t].count += 1;
    }
    let bestType = "", bestAvg = 0;
    for (const [type, s] of Object.entries(typeStats)) {
      const avg = s.total / s.count;
      if (avg > bestAvg) { bestAvg = avg; bestType = type; }
    }
    const allTypes = Object.entries(typeStats).map(([type, s]) => ({ type, avg: Math.round(s.total / s.count), count: s.count })).sort((a, b) => b.avg - a.avg);
    return { bestType, avgEngagement: Math.round(bestAvg), allTypes };
  }, [allPosts]);

  // Best platform (by engagement rate)
  const bestPlatformInsight = useMemo(() => {
    if (snapshots.length < 1) return null;
    const sorted = [...snapshots].filter(s => s.engagement_rate != null).sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
    if (sorted.length === 0) return null;
    return { best: sorted[0], all: sorted };
  }, [snapshots]);

  // Top 3 posts overall
  const topPosts = useMemo(() => {
    return [...allPosts]
      .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
      .slice(0, 3);
  }, [allPosts]);

  // Day-of-week engagement distribution (for chart-like visualization)
  const dayDistribution = useMemo(() => {
    const postsWithDay = allPosts.filter((p) => p.dayOfWeek != null);
    if (postsWithDay.length < 3) return null;
    const dayStats: number[] = Array(7).fill(0);
    const dayCounts: number[] = Array(7).fill(0);
    for (const p of postsWithDay) {
      dayStats[p.dayOfWeek!] += p.likes + p.comments;
      dayCounts[p.dayOfWeek!] += 1;
    }
    const avgs = dayStats.map((total, i) => dayCounts[i] ? Math.round(total / dayCounts[i]) : 0);
    const max = Math.max(...avgs, 1);
    return DAY_NAMES.map((name, i) => ({ name: name.slice(0, 3), avg: avgs[i], pct: Math.round((avgs[i] / max) * 100) }));
  }, [allPosts]);

  // Build data summary for AI
  const dataSummary = useMemo(() => {
    if (!hasData) return "";
    return snapshots.map((s) => {
      const parts = [
        `Plataforma: ${s.platform}`, `Usuário: @${s.username}${s.display_name ? ` (${s.display_name})` : ""}`,
        s.followers != null ? `Seguidores: ${s.followers.toLocaleString()}` : null,
        s.engagement_rate != null ? `Taxa de engajamento: ${s.engagement_rate}%` : null,
        s.avg_likes != null ? `Média de likes: ${s.avg_likes}` : null,
        s.avg_comments != null ? `Média de comentários: ${s.avg_comments}` : null,
        s.avg_views != null ? `Média de views: ${s.avg_views}` : null,
        `Coletado em: ${new Date(s.fetched_at).toLocaleDateString("pt-BR")}`,
      ].filter(Boolean);
      if (s.recent_posts && Array.isArray(s.recent_posts)) {
        const postsInfo = s.recent_posts.slice(0, 5).map((p: any, i: number) => {
          const pp = [`  Post ${i + 1}:`];
          if (p.caption || p.text) pp.push(`    Texto: "${(p.caption || p.text || "").slice(0, 100)}"`);
          if (p.likes != null) pp.push(`    Likes: ${p.likes}`);
          if (p.comments != null) pp.push(`    Comentários: ${p.comments}`);
          if (p.views != null) pp.push(`    Views: ${p.views}`);
          if (p.type) pp.push(`    Tipo: ${p.type}`);
          if (p.timestamp || p.date) pp.push(`    Data: ${new Date(p.timestamp || p.date).toLocaleDateString("pt-BR")}`);
          return pp.join("\n");
        }).join("\n");
        parts.push(`Posts recentes:\n${postsInfo}`);
      }
      return parts.join("\n");
    }).join("\n\n---\n\n");
  }, [snapshots, hasData]);

  const handleAnalyze = async (question?: string) => {
    const q = question || customQuestion.trim();
    if (!q || !hasData) return;
    setAiResponse("");
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("social_generate-content", {
        body: {
          prompt: q,
          platforms: snapshots.map((s) => s.platform).filter((v, i, a) => a.indexOf(v) === i),
          language: "português brasileiro",
          sourceContent: `DADOS REAIS DAS MINHAS REDES SOCIAIS:\n\n${dataSummary}`,
          tone: "analítico e estratégico",
        },
      });
      if (error) throw error;
      if (data?.posts) {
        setAiResponse(Object.values(data.posts).join("\n\n"));
      } else if (typeof data === "string") {
        setAiResponse(data);
      } else {
        setAiResponse(JSON.stringify(data, null, 2));
      }
      toast({ title: "Análise concluída!" });
    } catch (err) {
      toast({ title: "Erro na análise", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const totalFollowers = snapshots.reduce((sum, s) => sum + (s.followers || 0), 0);
  const avgEngagement = snapshots.filter(s => s.engagement_rate).length > 0
    ? snapshots.reduce((sum, s) => sum + (s.engagement_rate || 0), 0) / snapshots.filter(s => s.engagement_rate).length : 0;
  const totalAvgLikes = snapshots.reduce((sum, s) => sum + (s.avg_likes || 0), 0);
  const totalAvgComments = snapshots.reduce((sum, s) => sum + (s.avg_comments || 0), 0);

  const suggestedQuestions = [
    "Analise meus dados e diga quais plataformas performam melhor e por quê",
    "Que tipo de conteúdo gera mais engajamento nos meus dados?",
    "Compare meu desempenho entre as plataformas e sugira onde focar",
    "Crie um plano de ação com 5 melhorias baseado nos meus dados reais",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-h2Sm md:text-h2">
          <Lightbulb className="h-6 w-6 text-yellow-500" />
          <span className="text-gradient-bilhon">Insights IA</span>
        </h1>
        <p className="mt-1 text-muted-foreground">
          Insights calculados a partir dos seus dados reais — {allPosts.length} posts analisados
        </p>
      </div>

      {/* No data state */}
      {!hasData && !snapshotsQuery.isLoading && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="font-semibold">Nenhum dado coletado</h3>
            <p className="text-sm text-muted-foreground">
              Vá até Analytics e colete dados das suas redes. Os insights serão gerados com base nos seus dados reais.
            </p>
            <Link to="/analytics"><Button className="mt-2"><BarChart3 className="mr-2 h-4 w-4" />Ir para Analytics</Button></Link>
          </CardContent>
        </Card>
      )}

      {snapshotsQuery.isLoading && (
        <Card><CardContent className="p-8 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </CardContent></Card>
      )}

      {/* Metrics Overview */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="card-premium"><CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary shrink-0" />
            <div><p className="text-[10px] text-muted-foreground">Seguidores totais</p><p className="text-lg font-bold nums-tabular">{totalFollowers.toLocaleString()}</p></div>
          </CardContent></Card>
          <Card className="card-premium"><CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-green-500 shrink-0" />
            <div><p className="text-[10px] text-muted-foreground">Engajamento médio</p><p className="text-lg font-bold nums-tabular">{avgEngagement ? `${avgEngagement.toFixed(2)}%` : "—"}</p></div>
          </CardContent></Card>
          <Card className="card-premium"><CardContent className="p-4 flex items-center gap-3">
            <Heart className="h-5 w-5 text-rose-500 shrink-0" />
            <div><p className="text-[10px] text-muted-foreground">Média de likes</p><p className="text-lg font-bold nums-tabular">{totalAvgLikes.toLocaleString()}</p></div>
          </CardContent></Card>
          <Card className="card-premium"><CardContent className="p-4 flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-blue-500 shrink-0" />
            <div><p className="text-[10px] text-muted-foreground">Média de comentários</p><p className="text-lg font-bold nums-tabular">{totalAvgComments.toLocaleString()}</p></div>
          </CardContent></Card>
        </div>
      )}

      {/* DATA-DRIVEN INSIGHTS */}
      {hasData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Best day */}
          <Card className="border-green-500/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-500" />
                <span className="text-sm font-semibold">Melhor dia para postar</span>
              </div>
              {bestDayInsight ? (
                <>
                  <p className="text-2xl font-bold text-green-600">{bestDayInsight.day}</p>
                  <p className="text-xs text-muted-foreground">
                    Média de {bestDayInsight.avgEngagement} interações por post · Baseado em {bestDayInsight.sampleSize} posts
                  </p>
                </>
              ) : (
                <InsightEmpty hint="Poucos posts com data coletada. Atualize os dados em Analytics (mín. 3 posts) para ver seu melhor dia." />
              )}
            </CardContent>
          </Card>

          {/* Best hour */}
          <Card className="border-blue-500/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold">Melhor horário</span>
              </div>
              {bestHourInsight ? (
                <>
                  <p className="text-2xl font-bold text-blue-600">{String(bestHourInsight.hour).padStart(2, "0")}:00</p>
                  <p className="text-xs text-muted-foreground">
                    Média de {bestHourInsight.avgEngagement} interações por post nesse horário
                  </p>
                </>
              ) : (
                <InsightEmpty hint="Poucos posts com horário coletado. Atualize os dados em Analytics (mín. 3 posts) para ver seu melhor horário." />
              )}
            </CardContent>
          </Card>

          {/* Best platform */}
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Plataforma mais engajada</span>
              </div>
              {bestPlatformInsight ? (
                <>
                  <div className="flex items-center gap-2">
                    {PLATFORMS[bestPlatformInsight.best.platform as Platform]?.icon}
                    <p className="text-2xl font-bold text-primary capitalize">{bestPlatformInsight.best.platform}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {bestPlatformInsight.best.engagement_rate}% de engajamento · {bestPlatformInsight.best.followers?.toLocaleString()} seguidores
                  </p>
                </>
              ) : (
                <InsightEmpty hint="Sem taxa de engajamento coletada. No Instagram, reconecte via Facebook para métricas completas — ou conecte outra rede para comparar." />
              )}
            </CardContent>
          </Card>

          {/* Best content type */}
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Melhor tipo de conteúdo</span>
              </div>
              {bestTypeInsight ? (
                <>
                  <p className="text-2xl font-bold text-primary capitalize">{bestTypeInsight.bestType}</p>
                  <div className="space-y-1 mt-1">
                    {bestTypeInsight.allTypes.map((t) => (
                      <div key={t.type} className="flex items-center gap-2 text-xs">
                        <span className="w-16 truncate capitalize">{t.type}</span>
                        <Progress value={Math.round((t.avg / bestTypeInsight.avgEngagement) * 100)} className="h-1.5 flex-1" />
                        <span className="text-muted-foreground w-8 text-right">{t.avg}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <InsightEmpty hint="Os posts coletados não têm o tipo (foto/vídeo/carrossel). Reconecte via Facebook para dados completos." />
              )}
            </CardContent>
          </Card>

          {/* Per-platform cards */}
          {snapshots.map((s) => {
            const cfg = PLATFORMS[s.platform as Platform];
            return (
              <Card key={s.id} className="card-premium">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    {cfg && <span>{cfg.icon}</span>}
                    <span className="text-sm font-semibold">{s.display_name || `@${s.username}`}</span>
                    <Badge variant="secondary" className="text-[9px] ml-auto">{s.platform}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {s.followers != null && <div><span className="text-muted-foreground">Seguidores:</span> <strong>{s.followers.toLocaleString()}</strong></div>}
                    {s.engagement_rate != null && <div><span className="text-muted-foreground">Engajamento:</span> <strong>{s.engagement_rate}%</strong></div>}
                    {s.avg_likes != null && <div><span className="text-muted-foreground">Avg likes:</span> <strong>{s.avg_likes}</strong></div>}
                    {s.avg_comments != null && <div><span className="text-muted-foreground">Avg comments:</span> <strong>{s.avg_comments}</strong></div>}
                    {s.avg_views != null && <div><span className="text-muted-foreground">Avg views:</span> <strong>{s.avg_views}</strong></div>}
                    {s.posts_count != null && <div><span className="text-muted-foreground">Posts:</span> <strong>{s.posts_count}</strong></div>}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Atualizado em {new Date(s.fetched_at).toLocaleDateString("pt-BR")}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Day-of-week distribution */}
      {dayDistribution && (
        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-green-500" />
              Engajamento por dia da semana
            </CardTitle>
            <CardDescription>Baseado nos seus {allPosts.length} posts coletados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {dayDistribution.map((d) => (
                <div key={d.name} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">{d.avg}</span>
                  <div className="w-full rounded-t-sm bg-primary/20 relative" style={{ height: `${Math.max(d.pct, 4)}%` }}>
                    <div className="absolute inset-0 rounded-t-sm bg-gradient-to-t from-primary to-primary/60" style={{ opacity: d.pct / 100 }} />
                  </div>
                  <span className="text-[10px] font-medium">{d.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top posts */}
      {topPosts.length > 0 && (
        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Seus posts com melhor desempenho
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPosts.map((p, i) => {
              const cfg = PLATFORMS[p.platform as Platform];
              return (
                <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                  <span className="text-lg font-bold text-muted-foreground/50 mt-0.5">#{i + 1}</span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {cfg && <span className="text-sm">{cfg.icon}</span>}
                      <span className="text-xs text-muted-foreground capitalize">{p.platform}</span>
                      {p.type && <Badge variant="outline" className="text-[9px]">{p.type}</Badge>}
                      {p.date && <span className="text-[10px] text-muted-foreground ml-auto">{p.date.toLocaleDateString("pt-BR")}</span>}
                    </div>
                    {p.caption && <p className="text-xs line-clamp-2">{p.caption}</p>}
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{p.likes.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p.comments.toLocaleString()}</span>
                      {p.views > 0 && <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{p.views.toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* AI Deep Analysis */}
      {hasData && (
        <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-orange-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Análise profunda com IA
            </CardTitle>
            <CardDescription>
              Faça perguntas e a IA analisa seus {allPosts.length} posts reais de {snapshots.length} perfil(is)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Ex: O que meus dados dizem sobre os melhores formatos de conteúdo?"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              className="min-h-[80px]"
            />
            <Button
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-medium"
              disabled={!customQuestion.trim() || isAnalyzing}
              onClick={() => handleAnalyze()}
            >
              {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {isAnalyzing ? "Analisando seus dados..." : "Analisar com IA"}
            </Button>

            <div className="space-y-1.5">
              <p className="eyebrow">Perguntas baseadas nos seus dados</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedQuestions.map((q) => (
                  <Badge
                    key={q}
                    variant="outline"
                    className="cursor-pointer hover:bg-yellow-500/10 hover:border-yellow-500/50 transition-colors text-[10px]"
                    onClick={() => { setCustomQuestion(q); handleAnalyze(q); }}
                  >
                    {q.length > 55 ? q.slice(0, 55) + "…" : q}
                  </Badge>
                ))}
              </div>
            </div>

            {isAnalyzing && (
              <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-yellow-500 shrink-0" />
                <p className="text-sm text-muted-foreground">Analisando seus dados reais com IA...</p>
              </div>
            )}
            {aiResponse && (
              <div
                className="rounded-lg border bg-card p-4 prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-li:my-0.5 prose-headings:my-2"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(aiResponse) }}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
