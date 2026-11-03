/**
 * OutputScreen — tela dedicada de resultado do modo automático.
 * Preview grande dos slides/vídeo, legenda editável (com geração IA),
 * seleção de redes, placement IG, publicar agora ou agendar.
 */
import { useEffect, useState } from "react";
import {
  Send, CalendarClock, Loader2, CheckCircle2, RotateCcw, PenTool,
  ChevronLeft, ChevronRight, Copy, Users, Link2, ImagePlus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePfmAccounts, usePfmCreatePost } from "@/hooks/use-social";
import { pfmCreateUploadUrl } from "@/lib/api";
import { PLATFORMS } from "@/lib/platforms";
import { type BrandProfile } from "@/lib/brand";
import { saveVisualToGallery, saveUploadToGallery, markAsPublishedByUrls } from "@/lib/gallery";
import { CaptionEditor } from "@/components/studio/CaptionEditor";
import { IncluirImagemDialog } from "@/components/media/IncluirImagemDialog";
import { targetAspectFor, fitImageToAspect, isVideoUrl } from "@/lib/media-fit";
import type { Platform } from "@/types";
import type { StudioDoc } from "./types";

function isHttp(u?: string): boolean { return !!u && /^https?:\/\//.test(u); }

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] || "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function OutputScreen({
  doc, brand, onRestart, onEditInCanvas,
}: {
  doc: StudioDoc;
  brand: BrandProfile | null;
  onRestart: () => void;
  onEditInCanvas: (doc: StudioDoc) => void;
}) {
  const { user } = useAuth();
  const { data: accounts = [], isLoading: acctLoading } = usePfmAccounts();
  const createPost = usePfmCreatePost();

  const [slideIdx, setSlideIdx] = useState(0);
  const [caption, setCaption] = useState(doc.caption || "");
  const [selected, setSelected] = useState<string[]>([]);
  const [igPlacement, setIgPlacement] = useState<"timeline" | "reels" | "stories">("timeline");
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capsByPlat, setCapsByPlat] = useState<Record<string, string>>(doc.captionsByPlatform || {});

  // Mídia própria incluída pelo usuário — soma à arte gerada, sem substituí-la.
  const [incluirOpen, setIncluirOpen] = useState(false);
  const [midiaPropria, setMidiaPropria] = useState<string[]>([]);

  const isVideo = !!doc.videoUrl;
  const gerada = isVideo ? [doc.videoUrl!] : doc.slides.map((s) => s.bgImage).filter((u): u is string => !!u);
  const media = [...gerada, ...midiaPropria];
  const hasIg = selected.some((id) => accounts.find((a) => a.id === id)?.platform === "instagram");
  const selectedPlatforms = Array.from(
    new Set(selected.map((id) => accounts.find((a) => a.id === id)?.platform).filter(Boolean) as string[])
  );

  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // Auto-seleciona quando existe uma única conta conectada — sem isso, o botão
  // "Publicar agora" fica desabilitado e o usuário pensa que não funciona.
  useEffect(() => {
    if (!acctLoading && accounts.length === 1 && selected.length === 0) {
      setSelected([accounts[0].id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acctLoading, accounts.length]);


  /** Faz upload da lista de mídias para o PFM, opcionalmente ajustando à proporção alvo. */
  const uploadMediaFitted = async (aspect: number | null): Promise<string[]> => {
    if (!user) return [];
    const out: string[] = [];
    for (const url of media) {
      try {
        // Vídeo: não há como ajustar no canvas; envia como está.
        if (isVideo || isVideoUrl(url)) {
          if (isHttp(url)) {
            const { media_url, upload_url } = await pfmCreateUploadUrl();
            const blob = await (await fetch(url)).blob();
            await fetch(upload_url, { method: "PUT", body: blob, headers: { "Content-Type": blob.type || "application/octet-stream" } });
            out.push(media_url);
          }
          continue;
        }
        // Imagem: ajusta para a proporção alvo (cover) quando definida.
        let blob: Blob;
        if (aspect) {
          blob = await fitImageToAspect(url, aspect, "cover");
        } else if (url.startsWith("data:")) {
          blob = dataUrlToBlob(url);
        } else {
          blob = await (await fetch(url)).blob();
        }
        const { media_url, upload_url } = await pfmCreateUploadUrl();
        await fetch(upload_url, { method: "PUT", body: blob, headers: { "Content-Type": blob.type || "image/png" } });
        out.push(media_url);
      } catch { if (isHttp(url)) out.push(url); }
    }
    return out.filter(isHttp);
  };

  const publish = async () => {
    if (!selected.length) { toast.error("Selecione ao menos uma conta."); return; }
    if (when === "schedule" && !scheduledAt) { toast.error("Defina data e hora do agendamento."); return; }
    if (!caption.trim()) { toast.error("Escreva uma legenda antes de publicar."); return; }
    setPublishing(true); setDone(false);
    try {
      // Agrupa contas por proporção alvo e faz 1 upload por ratio único.
      const targets = selected.map((id) => {
        const acc = accounts.find((a) => a.id === id);
        const placement = acc?.platform === "instagram" ? igPlacement : undefined;
        return { id, acc, aspect: targetAspectFor(acc?.platform, placement) };
      });
      const uniqueAspects = Array.from(new Set(targets.map((t) => t.aspect)));
      const byAspect = new Map<number | null, string[]>();
      if (media.length) {
        for (const a of uniqueAspects) {
          byAspect.set(a, await uploadMediaFitted(a));
        }
      }
      const anyHosted = Array.from(byAspect.values()).flat();
      if (anyHosted.length) saveUploadToGallery(anyHosted);

      const cfgs = targets.map(({ id, acc, aspect }) => {
        const cfg: Record<string, unknown> = {
          caption: (acc && (capsByPlat[acc.platform] || doc.captionsByPlatform?.[acc.platform])) || caption,
        };
        if (acc?.platform === "instagram") cfg.placement = igPlacement;
        const hosted = byAspect.get(aspect) || [];
        if (hosted.length) cfg.media = hosted.map((url) => ({ url }));
        return { social_account_id: id, configuration: cfg };
      });

      const payload: Record<string, unknown> = { caption, social_accounts: selected, account_configurations: cfgs };
      if (when === "schedule") payload.scheduled_at = new Date(scheduledAt).toISOString();
      // Mídia root fallback (PFM exige media na raiz em alguns endpoints)
      const fallback = byAspect.get(null) || byAspect.values().next().value || [];
      if (fallback.length) payload.media = fallback.map((url) => ({ url }));

      await createPost.mutateAsync(payload as unknown as Parameters<typeof createPost.mutateAsync>[0]);
      if (anyHosted.length) markAsPublishedByUrls(anyHosted);
      setDone(true);
      toast.success(when === "schedule" ? "Post agendado!" : "Publicado com sucesso!");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao publicar"); }
    finally { setPublishing(false); }
  };

  const handleSaveGallery = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const urls: string[] = [];
      for (const url of media) {
        if (url.startsWith("data:")) {
          const blob = dataUrlToBlob(url);
          const path = `${user.id}/studio/gal_${crypto.randomUUID()}.png`;
          const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: "image/png" });
          if (!error) urls.push(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
        } else if (isHttp(url)) urls.push(url);
      }
      if (urls.length) {
        await saveVisualToGallery({ urls, prompt: doc.caption, templateName: "Studio · Automático" });
        toast.success("Salvo na galeria");
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onRestart}><RotateCcw className="mr-1.5 h-4 w-4" /> Recomeçar</Button>
        <Button variant="ghost" size="sm" onClick={() => onEditInCanvas(doc)}><PenTool className="mr-1.5 h-4 w-4" /> Refinar no canvas</Button>
        <h1 className="ml-auto text-lg font-semibold text-foreground">Resultado</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* ── Preview ── */}
        <div className="space-y-3">
          <Card className="card-premium">
            <CardContent className="p-3">
              {isVideo ? (
                <video src={doc.videoUrl} controls className="w-full rounded-xl" />
              ) : media.length === 1 ? (
                <img src={media[0]} alt="Arte" className="w-full rounded-xl" />
              ) : (
                <div className="space-y-2">
                  <img src={media[slideIdx] || media[0]} alt={`Slide ${slideIdx + 1}`} className="w-full rounded-xl" />
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setSlideIdx(Math.max(0, slideIdx - 1))} disabled={slideIdx === 0}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-xs text-muted-foreground">{slideIdx + 1}/{media.length}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setSlideIdx(Math.min(media.length - 1, slideIdx + 1))} disabled={slideIdx === media.length - 1}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                  {/* thumbs */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {media.map((m, i) => (
                      <button key={i} onClick={() => setSlideIdx(i)} className={`shrink-0 overflow-hidden rounded-lg border-2 ${i === slideIdx ? "border-primary" : "border-transparent"}`}>
                        <img src={m} alt="" className="h-14 w-14 object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleSaveGallery} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />} Salvar na galeria
            </Button>
            {/* Só para posts de imagem: num post de vídeo a prévia é o próprio
                vídeo, e somar imagem deixaria o preview mentindo. */}
            {!isVideo && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setIncluirOpen(true)}
                data-testid="botao-incluir-imagem-post"
              >
                <ImagePlus className="mr-2 h-4 w-4" /> Incluir imagem
              </Button>
            )}
          </div>

          <IncluirImagemDialog
            open={incluirOpen}
            onOpenChange={setIncluirOpen}
            descricao="Escolha uma imagem sua, algo já salvo na galeria ou do banco de imagens para entrar neste post."
            salvarNaGaleria
            onConfirmar={(urls) => {
              setMidiaPropria((prev) => [...prev, ...urls.filter((u) => !prev.includes(u) && !gerada.includes(u))]);
            }}
          />
        </div>

        {/* ── Publicação ── */}
        <div className="space-y-4">
          {/* Legenda */}
          <Card className="card-premium">
            <CardContent className="p-4">
              <CaptionEditor
                caption={caption}
                onCaptionChange={setCaption}
                capsByPlat={capsByPlat}
                onCapsByPlatChange={setCapsByPlat}
                selectedPlatforms={selectedPlatforms}
                brand={brand}
                hashtags={doc.hashtags}
                captionTopic={doc.caption}
              />
            </CardContent>
          </Card>

          <Separator />

          {/* Contas */}
          <Card className="card-premium">
            <CardContent className="space-y-3 p-4">
              <Label className="text-xs font-medium">Publicar em</Label>
              {acctLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
              ) : accounts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto mb-2 h-5 w-5 opacity-50" /> Nenhuma conta conectada.
                  <div className="mt-2"><Button asChild variant="outline" size="sm"><Link to="/accounts"><Link2 className="mr-1.5 h-3.5 w-3.5" /> Conectar</Link></Button></div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {accounts.map((a) => {
                    const cfg = PLATFORMS[a.platform as Platform];
                    const on = selected.includes(a.id);
                    return (
                      <button key={a.id} onClick={() => toggle(a.id)}>
                        <Badge variant={on ? "default" : "secondary"} className={on ? "bg-primary hover:bg-primary/90 cursor-pointer gap-1" : "cursor-pointer hover:bg-accent gap-1"}>
                          {cfg?.icon} {a.username || cfg?.name || a.platform}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}

              {hasIg && (
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Posição no Instagram</Label>
                  <div className="flex gap-1.5">
                    {([["timeline", "Feed"], ["reels", "Reels"], ["stories", "Stories"]] as const).map(([v, lbl]) => (
                      <Button key={v} variant={igPlacement === v ? "default" : "outline"} size="sm" className={igPlacement === v ? "bg-primary hover:bg-primary/90" : ""} onClick={() => setIgPlacement(v)}>{lbl}</Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agendamento */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={when === "now" ? "default" : "outline"} size="sm" className={when === "now" ? "bg-primary hover:bg-primary/90" : ""} onClick={() => setWhen("now")}>Publicar agora</Button>
            <Button variant={when === "schedule" ? "default" : "outline"} size="sm" className={when === "schedule" ? "bg-primary hover:bg-primary/90" : ""} onClick={() => setWhen("schedule")}>
              <CalendarClock className="mr-1.5 h-3.5 w-3.5" /> Agendar
            </Button>
            {when === "schedule" && <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-9 w-auto" />}
          </div>

          {/* CTA principal */}
          <Button className="w-full btn-bilhon" size="lg" onClick={publish} disabled={publishing || !selected.length}>
            {publishing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>
              : done ? <><CheckCircle2 className="mr-2 h-4 w-4" /> {when === "schedule" ? "Agendado ✓ — enviar de novo" : "Publicado ✓ — enviar de novo"}</>
              : !selected.length ? <><Send className="mr-2 h-4 w-4" /> Selecione uma conta acima</>
              : <><Send className="mr-2 h-4 w-4" /> {when === "schedule" ? "Agendar post" : "Publicar agora"}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
