/**
 * "Incluir imagem" — o portão único de mídia própria da plataforma.
 *
 * Três origens, conforme o pedido: arquivo do computador, a galeria da própria
 * plataforma e o banco de imagens (Pexels, já conectado). Quem usa escolhe
 * quais origens fazem sentido no contexto: na Galeria não faz sentido oferecer
 * "da galeria"; na criação de post, faz.
 */

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Search, Loader2, Check, ImageOff, Film } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MediaUploader } from "@/components/MediaUploader";
import { searchStockImages, type StockImage } from "@/lib/api";
import { getCreations, saveUploadToGallery, type Creation, type CreationOrigin } from "@/lib/gallery";
import { cn } from "@/lib/utils";

export type OrigemImagem = "upload" | "galeria" | "banco";

const ROTULO: Record<OrigemImagem, string> = {
  upload: "Do computador",
  galeria: "Da galeria",
  banco: "Banco de imagens",
};

interface IncluirImagemDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Origens oferecidas, na ordem das abas. Default: as três. */
  origens?: OrigemImagem[];
  /** Recebe as URLs escolhidas quando o usuário confirma. */
  onConfirmar: (urls: string[]) => void | Promise<void>;
  /** Grava o que foi escolhido na galeria (`creations`). */
  salvarNaGaleria?: boolean;
  titulo?: string;
  descricao?: string;
}

export function IncluirImagemDialog({
  open,
  onOpenChange,
  origens = ["upload", "galeria", "banco"],
  onConfirmar,
  salvarNaGaleria = false,
  titulo = "Incluir imagem",
  descricao = "Envie um arquivo seu, escolha algo já salvo na galeria ou busque no banco de imagens.",
}: IncluirImagemDialogProps) {
  const [aba, setAba] = useState<OrigemImagem>(origens[0]);

  // upload
  const [enviadas, setEnviadas] = useState<string[]>([]);
  // galeria
  const [criacoes, setCriacoes] = useState<Creation[]>([]);
  const [carregandoGaleria, setCarregandoGaleria] = useState(false);
  const [daGaleria, setDaGaleria] = useState<string[]>([]);
  // banco de imagens
  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [stock, setStock] = useState<StockImage[]>([]);
  const [doBanco, setDoBanco] = useState<string[]>([]);

  const [confirmando, setConfirmando] = useState(false);

  // Zera tudo ao reabrir — dialog que lembra a escolha anterior confunde.
  useEffect(() => {
    if (!open) return;
    setAba(origens[0]);
    setEnviadas([]); setDaGaleria([]); setDoBanco([]);
    setBusca(""); setStock([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A galeria só é carregada quando a aba é aberta de fato.
  useEffect(() => {
    if (!open || aba !== "galeria" || criacoes.length > 0) return;
    let vivo = true;
    (async () => {
      setCarregandoGaleria(true);
      const dados = await getCreations();
      if (vivo) setCriacoes(dados);
      setCarregandoGaleria(false);
    })();
    return () => { vivo = false; };
  }, [open, aba, criacoes.length]);

  const buscarNoBanco = useCallback(async () => {
    const q = busca.trim();
    if (!q) { toast.error("Digite o que você quer buscar."); return; }
    setBuscando(true); setStock([]);
    try {
      const { images } = await searchStockImages({ query: q, count: 12, orientation: "squarish" });
      if (!images?.length) toast.error("Nada encontrado para essa busca.");
      else setStock(images);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar no banco de imagens");
    } finally { setBuscando(false); }
  }, [busca]);

  const alternar = (lista: string[], set: (v: string[]) => void, url: string) =>
    set(lista.includes(url) ? lista.filter((u) => u !== url) : [...lista, url]);

  const selecionadas = [...enviadas, ...daGaleria, ...doBanco];

  const confirmar = async () => {
    if (!selecionadas.length) { toast.error("Escolha ao menos uma imagem."); return; }
    setConfirmando(true);
    try {
      if (salvarNaGaleria) {
        // Cada origem entra na galeria com o seu selo. O que veio DA galeria
        // já está lá — não duplica.
        const porOrigem: Array<[string[], CreationOrigin, string]> = [
          [enviadas, "upload", "Enviada por você"],
          [doBanco, "stock", "Banco de imagens"],
        ];
        for (const [urls, origin, templateName] of porOrigem) {
          if (urls.length) await saveUploadToGallery(urls, { origin, templateName });
        }
      }
      await onConfirmar(selecionadas);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui incluir a imagem");
    } finally { setConfirmando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-primary" /> {titulo}
          </DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        <Tabs value={aba} onValueChange={(v) => setAba(v as OrigemImagem)} className="mt-2">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${origens.length}, minmax(0, 1fr))` }}>
            {origens.map((o) => (
              <TabsTrigger key={o} value={o} data-testid={`aba-${o}`}>{ROTULO[o]}</TabsTrigger>
            ))}
          </TabsList>

          {/* ── Do computador ── */}
          {origens.includes("upload") && (
            <TabsContent value="upload" className="mt-4">
              <MediaUploader onFilesUploaded={setEnviadas} maxFiles={10} />
            </TabsContent>
          )}

          {/* ── Da galeria ── */}
          {origens.includes("galeria") && (
            <TabsContent value="galeria" className="mt-4">
              {carregandoGaleria ? (
                <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
              ) : criacoes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                  <ImageOff className="h-8 w-8 opacity-50" />
                  Nenhuma criação salva ainda.
                </div>
              ) : (
                <div className="grid max-h-[45vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                  {criacoes.map((c) => {
                    const url = c.thumbnailUrl ?? c.urls[0];
                    if (!url) return null;
                    const ativo = daGaleria.includes(url);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => alternar(daGaleria, setDaGaleria, url)}
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-md border-2 transition",
                          ativo ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-primary/50",
                        )}
                      >
                        {c.type === "video" ? (
                          <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                        ) : (
                          <img src={url} alt={c.templateName ?? "Criação"} loading="lazy" className="h-full w-full object-cover" />
                        )}
                        {c.type === "video" && (
                          <span className="absolute left-1 top-1 rounded bg-black/70 p-0.5"><Film className="h-3 w-3 text-white" /></span>
                        )}
                        {ativo && (
                          <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5"><Check className="h-3 w-3 text-primary-foreground" /></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}

          {/* ── Banco de imagens (Pexels) ── */}
          {origens.includes("banco") && (
            <TabsContent value="banco" className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscarNoBanco()}
                  placeholder="Buscar no Pexels (ex.: café, escritório, equipe)"
                  aria-label="Buscar no banco de imagens"
                />
                <Button onClick={buscarNoBanco} disabled={buscando} className="shrink-0">
                  {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">Buscar</span>
                </Button>
              </div>
              {stock.length > 0 && (
                <div className="grid max-h-[42vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                  {stock.map((img) => {
                    const ativo = doBanco.includes(img.url);
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => alternar(doBanco, setDoBanco, img.url)}
                        title={img.author ? `Foto de ${img.author}` : img.alt}
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-md border-2 transition",
                          ativo ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-primary/50",
                        )}
                      >
                        <img src={img.thumbUrl || img.url} alt={img.alt} loading="lazy" className="h-full w-full object-cover" />
                        {ativo && (
                          <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5"><Check className="h-3 w-3 text-primary-foreground" /></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="mt-4 flex-row items-center justify-between gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground" data-testid="contador-selecionadas">
            {selecionadas.length === 0
              ? "Nenhuma imagem escolhida"
              : `${selecionadas.length} ${selecionadas.length === 1 ? "imagem escolhida" : "imagens escolhidas"}`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={confirmando || selecionadas.length === 0} data-testid="confirmar-incluir-imagem">
              {confirmando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Incluir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
