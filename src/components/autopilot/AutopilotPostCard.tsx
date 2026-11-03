import { useState } from "react";
import { Check, X, Pencil, Clock, Hash, Eye, LayoutGrid, ChevronRight, ImageIcon, Wand2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { aiAssist } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostStatusBadge } from "./AutopilotStatusBadge";
import { PLATFORMS } from "@/lib/platforms";
import type { AutopilotPost, Platform } from "@/types";
import {
  useApprovePost,
  useRejectPost,
  useEditAutopilotPost,
  useRegeneratePostVisual,
} from "@/hooks/use-autopilot";

interface Props {
  post: AutopilotPost;
}

/** O visual pode ser vídeo (Veo) — a miniatura precisa saber renderizar os dois. */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export function AutopilotPostCard({ post }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.text_content);
  const [improving, setImproving] = useState(false);

  const approvePost = useApprovePost();
  const rejectPost = useRejectPost();
  const editPost = useEditAutopilotPost();
  const regenVisual = useRegeneratePostVisual();

  const platformConfig = PLATFORMS[post.platform as Platform];
  const scheduledDate = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  function handleSaveEdit() {
    editPost.mutate(
      { id: post.id, text_content: editText },
      { onSuccess: () => setEditing(false) }
    );
  }

  async function handleImprove() {
    setImproving(true);
    try {
      const { text } = await aiAssist({
        system: `Você é redator de redes sociais. Reescreva o post para ${platformConfig?.name || post.platform} deixando-o mais persuasivo e fluido, mantendo o tema. Limite ${maxChars} caracteres. Responda APENAS com o texto final.`,
        prompt: editText,
        temperature: 0.7,
      });
      if (text) { setEditText(text); toast.success("Texto aprimorado pela IA"); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aprimorar");
    } finally {
      setImproving(false);
    }
  }

  const charCount = post.text_content.length;
  const maxChars = platformConfig?.maxChars || 2200;

  return (
    <>
      {/* Card compacto (clicável) */}
      <Card
        className="card-premium overflow-hidden cursor-pointer transition-all"
        onClick={() => setOpen(true)}
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {platformConfig && (
                <span style={{ color: platformConfig.color }}>
                  {platformConfig.icon}
                </span>
              )}
              <span className="text-sm font-medium">
                {platformConfig?.name || post.platform}
              </span>
            </div>
            <PostStatusBadge status={post.status} />
          </div>

          {scheduledDate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {scheduledDate}
            </div>
          )}

          {/* A PEÇA VISUAL no próprio card da coluna — antes ela só existia
              dentro do Dialog de preview, e o quadro mostrava só um badge. */}
          {post.media_urls?.length > 0 ? (
            isVideoUrl(post.media_urls[0]) ? (
              <video
                src={post.media_urls[0]}
                className="h-32 w-full rounded-lg border object-cover"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={post.media_urls[0]}
                alt={`Peça visual do post para ${platformConfig?.name || post.platform}`}
                loading="lazy"
                className="h-32 w-full rounded-lg border object-cover"
              />
            )
          ) : post.status === "generating_visual" ? (
            <div className="flex h-32 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando a arte…
            </div>
          ) : null}

          <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
            {post.text_content}
          </p>

          {/* error_message no card da coluna — antes só existia no Dialog de
              preview, e a trava de "sem arte" / falhas de visual ficavam
              invisíveis no quadro. */}
          {post.error_message && (
            <p className="text-xs text-destructive line-clamp-2" title={post.error_message}>
              {post.error_message}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {post.theme_name && (
              <Badge variant="secondary" className="text-[10px]">{post.theme_name}</Badge>
            )}
            {post.carousel_data && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <LayoutGrid className="h-3 w-3" />
                {post.carousel_data.slides?.length || 0} slides
              </Badge>
            )}
            {post.media_urls?.length > 0 && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <ImageIcon className="h-3 w-3" />
                {post.media_urls.length} mídia
              </Badge>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Eye className="h-3 w-3" /> Preview <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Modal de preview */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {platformConfig && (
                <span style={{ color: platformConfig.color }}>
                  {platformConfig.icon}
                </span>
              )}
              {platformConfig?.name || post.platform}
              <PostStatusBadge status={post.status} />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Horário agendado */}
            {scheduledDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {scheduledDate}
              </div>
            )}

            {/* Tópico de origem */}
            {post.source_topic && (
              <div className="text-xs text-muted-foreground">
                Baseado em: <span className="font-medium">{post.source_topic}</span>
              </div>
            )}

            <Separator />

            {/* Conteúdo — simulação de post */}
            <div className="card-premium p-5 space-y-4">
              {/* Texto do post */}
              {editing ? (
                <div className="space-y-3">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={8}
                    className="text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${charCount > maxChars ? "text-destructive" : "text-muted-foreground"}`}>
                      {editText.length}/{maxChars} caracteres
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1 text-primary" onClick={handleImprove} disabled={improving}>
                        {improving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                        Melhorar com IA
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={editPost.isPending}>
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditing(false); setEditText(post.text_content); }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {post.text_content}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {charCount}/{maxChars} caracteres
                  </div>
                </div>
              )}

              {/* Hashtags */}
              {post.hashtags?.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  {post.hashtags.map((h) => (
                    <span key={h} className="text-xs text-primary font-medium">
                      #{h}
                    </span>
                  ))}
                </div>
              )}

              {/* Mídia */}
              {post.media_urls?.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {post.media_urls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Mídia ${i + 1}`}
                      className="rounded-lg border object-cover w-full aspect-square"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Carrossel preview */}
            {post.carousel_data && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                    Carrossel — {post.carousel_data.title}
                  </h4>
                  <div className="grid gap-2">
                    {post.carousel_data.slides?.map((slide, i) => (
                      <div
                        key={i}
                        className="rounded-lg border bg-gradient-to-br from-primary/20 to-primary/10 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                            {i + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{slide.heading}</p>
                            <p className="text-xs text-muted-foreground mt-1">{slide.body}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Erro */}
            {post.error_message && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {post.error_message}
              </div>
            )}

            <Separator />

            {/* Ações */}
            <div className="flex gap-2 flex-wrap">
              {/* Aprovar só a partir de "Visual pronto": o humano aprova o post
                  com a arte na frente, nunca o rascunho sem peça. */}
              {post.status === "visual_ready" && (
                <Button
                  size="sm"
                  className="gap-1 bg-primary hover:bg-primary/90"
                  onClick={() => { approvePost.mutate(post.id); setOpen(false); }}
                  disabled={approvePost.isPending}
                >
                  <Check className="h-3.5 w-3.5" /> Aprovar
                </Button>
              )}
              {(post.status === "draft" || post.status === "visual_ready") && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-destructive hover:text-destructive border-destructive/30"
                    onClick={() => { rejectPost.mutate(post.id); setOpen(false); }}
                    disabled={rejectPost.isPending}
                  >
                    <X className="h-3.5 w-3.5" /> Rejeitar
                  </Button>
                </>
              )}
              {post.status !== "draft" && post.status !== "visual_ready" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setEditing(true)}
                  disabled={post.status === "scheduled" || post.status === "published"}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
              )}
              {post.status !== "published" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => { regenVisual.mutate({ id: post.id, calendarId: post.calendar_id }); setOpen(false); toast.info(post.media_urls?.length ? "Regerando visual…" : "Gerando visual…"); }}
                  disabled={regenVisual.isPending}
                >
                  {regenVisual.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {post.media_urls?.length ? "Regerar visual" : "Gerar visual"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
