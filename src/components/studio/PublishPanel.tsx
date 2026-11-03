import { useEffect, useState } from "react";
import { Loader2, Send, CheckCircle2, CalendarClock, Link2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { usePfmAccounts, usePfmCreatePost } from "@/hooks/use-social";
import { pfmCreateUploadUrl } from "@/lib/api";
import { PLATFORMS } from "@/lib/platforms";
import type { Platform } from "@/types";
import { type BrandProfile } from "@/lib/brand";
import { saveUploadToGallery, markAsPublishedByUrls } from "@/lib/gallery";
import { isPfmAuthError } from "@/lib/pfm-errors";
import { PfmAuthExpired } from "@/components/PfmAuthExpired";
import { CaptionEditor } from "@/components/studio/CaptionEditor";
import { targetAspectFor, fitImageToAspect, isVideoUrl } from "@/lib/media-fit";

function isHttp(u?: string): boolean {
  return !!u && /^https?:\/\//.test(u);
}

/**
 * Publicação direta no Post for Me — reutilizável por todas as abas do Studio.
 * Seleção de contas conectadas, legenda (com override por plataforma), publicar
 * agora ou agendar, e upload de mídia (data:/http) para o CDN do PFM.
 */
export function PublishPanel({
  defaultCaption = "",
  captionsByPlatform,
  media = [],
  defaultScheduledAt,
  brand,
  captionTopic,
}: {
  defaultCaption?: string;
  captionsByPlatform?: Record<string, string>;
  media?: string[];
  defaultScheduledAt?: string;
  brand?: BrandProfile | null;
  captionTopic?: string;
}) {
  const { data: accounts = [], isLoading, isError, error } = usePfmAccounts();
  const pfmAuthExpired = isError && isPfmAuthError(error);
  const createPost = usePfmCreatePost();
  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState(defaultCaption);
  const [when, setWhen] = useState<"now" | "schedule">(defaultScheduledAt ? "schedule" : "now");
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt ? defaultScheduledAt.slice(0, 16) : "");
  const [igPlacement, setIgPlacement] = useState<"timeline" | "reels" | "stories">("timeline");
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);
  const [capsByPlat, setCapsByPlat] = useState<Record<string, string>>(captionsByPlatform || {});

  // Auto-seleciona quando o usuário tem uma única conta conectada — evita
  // que o botão "Publicar agora" pareça inerte por falta de seleção visível.
  useEffect(() => {
    if (!isLoading && accounts.length === 1 && selected.length === 0) {
      setSelected([accounts[0].id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, accounts.length]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const hasInstagram = selected.some((id) => accounts.find((a) => a.id === id)?.platform === "instagram");
  const selectedPlatforms = Array.from(
    new Set(selected.map((id) => accounts.find((a) => a.id === id)?.platform).filter(Boolean) as string[])
  );

  /** Sobe a lista de mídias, opcionalmente ajustando à proporção alvo (cover). */
  const uploadMediaFitted = async (aspect: number | null): Promise<string[]> => {
    const out: string[] = [];
    for (const url of media) {
      try {
        let blob: Blob;
        if (aspect && !isVideoUrl(url)) {
          blob = await fitImageToAspect(url, aspect, "cover");
        } else {
          blob = await (await fetch(url)).blob();
        }
        const { media_url, upload_url } = await pfmCreateUploadUrl();
        await fetch(upload_url, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": blob.type || "application/octet-stream" },
        });
        out.push(media_url);
      } catch {
        if (isHttp(url)) out.push(url);
      }
    }
    return out.filter(isHttp);
  };

  const publish = async () => {
    if (!selected.length) { toast.error("Selecione ao menos uma conta."); return; }
    if (when === "schedule" && !scheduledAt) { toast.error("Defina data e hora do agendamento."); return; }
    if (!caption.trim()) { toast.error("Escreva uma legenda antes de publicar."); return; }
    setPublishing(true);
    setDone(false);
    try {
      // 1 upload por proporção única exigida pelas contas selecionadas.
      const targets = selected.map((id) => {
        const acc = accounts.find((a) => a.id === id);
        const placement = acc?.platform === "instagram" ? igPlacement : undefined;
        return { id, acc, aspect: targetAspectFor(acc?.platform, placement) };
      });
      const uniqueAspects = Array.from(new Set(targets.map((t) => t.aspect)));
      const byAspect = new Map<number | null, string[]>();
      if (media.length) {
        for (const a of uniqueAspects) byAspect.set(a, await uploadMediaFitted(a));
      }
      const anyHosted = Array.from(byAspect.values()).flat();
      if (anyHosted.length) saveUploadToGallery(anyHosted);

      const account_configurations = targets.map(({ id, acc, aspect }) => {
        const cfg: Record<string, unknown> = {
          caption: (acc && (capsByPlat[acc.platform] || captionsByPlatform?.[acc.platform])) || caption,
        };
        if (acc?.platform === "instagram") cfg.placement = igPlacement;
        const hosted = byAspect.get(aspect) || [];
        if (hosted.length) cfg.media = hosted.map((url) => ({ url }));
        return { social_account_id: id, configuration: cfg };
      });

      const payload: Record<string, unknown> = {
        caption,
        social_accounts: selected,
        account_configurations,
      };
      if (when === "schedule") payload.scheduled_at = new Date(scheduledAt).toISOString();
      const fallback = byAspect.get(null) || byAspect.values().next().value || [];
      if (fallback.length) payload.media = fallback.map((url) => ({ url }));

      await createPost.mutateAsync(payload as unknown as Parameters<typeof createPost.mutateAsync>[0]);
      if (anyHosted.length) markAsPublishedByUrls(anyHosted);
      setDone(true);
      toast.success(when === "schedule" ? "Post agendado!" : "Publicado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Card className="card-premium">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Send className="h-4 w-4 text-primary" /> Publicar no Post for Me
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando contas…</div>
        ) : pfmAuthExpired ? (
          <PfmAuthExpired compact />
        ) : accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-6 w-6 opacity-50" />
            Nenhuma conta conectada.
            <div className="mt-2">
              <Button asChild variant="outline" size="sm"><Link to="/accounts"><Link2 className="mr-1.5 h-3.5 w-3.5" /> Conectar contas</Link></Button>
            </div>
          </div>
        ) : (
          <>
            {/* Account selection */}
            <div className="flex flex-wrap gap-1.5">
              {accounts.map((a) => {
                const cfg = PLATFORMS[a.platform as Platform];
                const on = selected.includes(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => toggle(a.id)}>
                    <Badge variant={on ? "default" : "secondary"} className={on ? "bg-primary hover:bg-primary/90 cursor-pointer gap-1" : "cursor-pointer hover:bg-accent gap-1"}>
                      {cfg?.icon} {a.username || cfg?.name || a.platform}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {/* Caption */}
            <CaptionEditor
              caption={caption}
              onCaptionChange={setCaption}
              capsByPlat={capsByPlat}
              onCapsByPlatChange={setCapsByPlat}
              selectedPlatforms={selectedPlatforms}
              brand={brand ?? null}
              captionTopic={captionTopic}
              rows={3}
              perPlatformNote
            />

            {/* Instagram placement */}
            {hasInstagram && (
              <div className="space-y-1.5">
                <Label className="text-xs">Posição no Instagram</Label>
                <div className="flex gap-1.5">
                  {([["timeline", "Feed"], ["reels", "Reels"], ["stories", "Stories"]] as const).map(([v, lbl]) => (
                    <Button key={v} variant={igPlacement === v ? "default" : "outline"} size="sm" className={igPlacement === v ? "bg-primary hover:bg-primary/90" : ""} onClick={() => setIgPlacement(v)}>
                      {lbl}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={when === "now" ? "default" : "outline"} size="sm" onClick={() => setWhen("now")} className={when === "now" ? "bg-primary hover:bg-primary/90" : ""}>
                Publicar agora
              </Button>
              <Button variant={when === "schedule" ? "default" : "outline"} size="sm" onClick={() => setWhen("schedule")} className={when === "schedule" ? "bg-primary hover:bg-primary/90" : ""}>
                <CalendarClock className="mr-1.5 h-3.5 w-3.5" /> Agendar
              </Button>
              {when === "schedule" && (
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-9 w-auto" />
              )}
            </div>

            <Button className="w-full bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30" onClick={publish} disabled={publishing || !selected.length}>
              {publishing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>
                : done ? <><CheckCircle2 className="mr-2 h-4 w-4" /> {when === "schedule" ? "Agendado" : "Publicado"} — enviar de novo</>
                : !selected.length ? <><Send className="mr-2 h-4 w-4" /> Selecione uma conta acima</>
                : <><Send className="mr-2 h-4 w-4" /> {when === "schedule" ? "Agendar post" : "Publicar agora"}</>}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
