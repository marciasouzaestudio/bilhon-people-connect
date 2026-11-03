import { useState } from "react";
import {
  CalendarDays,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  AlertCircle,
  Copy,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePfmPosts } from "@/hooks/use-social";
import * as api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PLATFORMS } from "@/lib/platforms";
import type { Platform } from "@/types";
import { isPfmAuthError } from "@/lib/pfm-errors";
import { PfmAuthExpired } from "@/components/PfmAuthExpired";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface PfmPost {
  id: string;
  caption: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  social_accounts: string[];
  platform?: string;
  media?: { url: string }[];
}

export default function Schedule() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const postsQuery = usePfmPosts({ status: "scheduled", limit: 50 });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Parse posts from PFM response
  const posts: PfmPost[] = (postsQuery.data?.data || []).filter(
    (p: any) => p.status === "scheduled" && p.scheduled_at
  );

  const pfmAuthExpired = postsQuery.isError && isPfmAuthError(postsQuery.error);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getPostsForDay = (day: number) => {
    return posts.filter((p) => {
      if (!p.scheduled_at) return false;
      const d = new Date(p.scheduled_at);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.pfmDeletePost(id);
      postsQuery.refetch();
      toast({ title: "Post removido da agenda" });
    } catch (err) {
      toast({
        title: "Erro ao remover",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = (post: PfmPost) => {
    navigate("/studio", { state: { sourceContent: post.caption, sourceTitle: "Post duplicado" } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-h2Sm md:text-h2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <span className="text-gradient-bilhon">Agenda</span>
          </h1>
          <p className="mt-1 text-muted-foreground">Visualize e gerencie seus posts agendados</p>
        </div>
        <Link to="/studio">
          <Button className="bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30">
            <Plus className="mr-2 h-4 w-4" />
            Novo Post
          </Button>
        </Link>
      </div>

      {pfmAuthExpired ? (
        <PfmAuthExpired />
      ) : postsQuery.isError ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          Erro ao carregar agenda: {postsQuery.error?.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2 card-premium">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <CardTitle className="text-base">{MONTHS[month]} {year}</CardTitle>
              <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                const dayPosts = day ? getPostsForDay(day) : [];
                return (
                  <div
                    key={i}
                    className={`min-h-[80px] rounded-lg border p-1.5 transition-colors ${
                      day
                        ? isToday(day)
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/50 hover:border-primary/30"
                        : "border-transparent"
                    }`}
                  >
                    {day && (
                      <>
                        <span className={`text-xs font-medium ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>
                          {day}
                        </span>
                        <div className="mt-0.5 space-y-0.5">
                          {dayPosts.slice(0, 2).map((p) => (
                            <div key={p.id} className="rounded bg-primary/10 px-1 py-0.5 text-[9px] text-primary truncate">
                              {new Date(p.scheduled_at!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              {" "}{p.caption?.slice(0, 15)}
                            </div>
                          ))}
                          {dayPosts.length > 2 && (
                            <span className="text-[9px] text-muted-foreground">+{dayPosts.length - 2} mais</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Posts */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Próximos Posts
            </CardTitle>
            <CardDescription>
              {postsQuery.isLoading ? <span className="inline-block h-4 w-24 animate-pulse rounded-md bg-muted align-middle" /> : `${posts.length} post(s) agendado(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {postsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">Nenhum post agendado</p>
                <Link to="/studio">
                  <Button variant="outline" size="sm" className="mt-3"><Plus className="mr-2 h-3 w-3" />Criar Post</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {posts.map((post) => (
                  <div key={post.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">
                        Agendado
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => handleDuplicate(post)}
                          title="Duplicar"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover post agendado?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O post será removido da fila de publicação.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(post.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                {deletingId === post.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <p className="text-xs line-clamp-2">{post.caption || "(sem legenda)"}</p>
                    {post.scheduled_at && (
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(post.scheduled_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
