import { useEffect, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, ImagePlus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useBrands } from "@/hooks/use-brands";
import { PublishPanel } from "@/components/studio/PublishPanel";
import { IncluirImagemDialog } from "@/components/media/IncluirImagemDialog";
import { saveVisualToGallery } from "@/lib/gallery";
import { useStudio } from "./StudioProvider";

export function PublishDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { doc, exportSlides } = useStudio();
  const { brands } = useBrands();
  const brand = brands.find((b) => b.id === doc.brandId) || null;

  const [media, setMedia] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const [incluirOpen, setIncluirOpen] = useState(false);
  const selectedMedia = media[Math.min(idx, Math.max(0, media.length - 1))];
  const selectedIsVideo = selectedMedia ? /\.(mp4|mov|webm)/i.test(selectedMedia) || selectedMedia.startsWith("blob:") : false;

  useEffect(() => {
    if (!open) return;
    setIdx(0);
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const m = doc.format === "video" ? (doc.videoUrl ? [doc.videoUrl] : []) : await exportSlides();
        if (alive) {
          setMedia(m);
          // saveVisualToGallery agora faz upload de data: URLs automaticamente
          if (m.length) saveVisualToGallery({ urls: m, prompt: doc.caption, templateName: "Studio · Canvas" });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, doc.format, doc.videoUrl, doc.caption, exportSlides]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Revisar e publicar</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="mt-3 text-sm">Preparando a mídia…</p>
            </div>
          ) : (
            <>
              {/* Revisar — preview da mídia */}
              {media.length > 0 && (
                <div>
                  <p className="eyebrow mb-2">Pré-visualização</p>
                  <div className="flex justify-center rounded-lg border border-border bg-muted/20 p-2">
                    {selectedIsVideo
                      ? <video src={selectedMedia} controls className="aspect-[4/5] max-h-[65vh] w-auto max-w-full rounded-md object-contain" />
                      : <img src={selectedMedia} alt={`Mídia ${idx + 1}`} className="aspect-[4/5] max-h-[65vh] w-auto max-w-full rounded-md object-contain" />}
                  </div>
                  {media.length > 1 && (
                    <>
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="text-xs text-muted-foreground">{idx + 1}/{media.length}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setIdx(Math.min(media.length - 1, idx + 1))} disabled={idx === media.length - 1}><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                        {media.map((m, i) => (
                          <button key={i} onClick={() => setIdx(i)} className={`shrink-0 overflow-hidden rounded-lg border-2 ${i === idx ? "border-primary" : "border-transparent"}`}>
                            <img src={m} alt="" className="h-14 w-14 object-cover" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Mídia própria — foto de produto/equipe/evento ou peça do
                  designer entram no post sem passar pela IA. */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIncluirOpen(true)}
                data-testid="botao-incluir-imagem-post"
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Incluir imagem
              </Button>

              <IncluirImagemDialog
                open={incluirOpen}
                onOpenChange={setIncluirOpen}
                descricao="Escolha uma imagem sua, algo já salvo na galeria ou do banco de imagens para entrar neste post."
                salvarNaGaleria
                onConfirmar={(urls) => {
                  setMedia((prev) => [...prev, ...urls.filter((u) => !prev.includes(u))]);
                }}
              />

              {/* Postar / Agendar */}
              <PublishPanel
                media={media}
                captionsByPlatform={doc.captionsByPlatform}
                defaultCaption={doc.caption}
                brand={brand}
                captionTopic={doc.caption}
                defaultScheduledAt={doc.schedule.at}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
