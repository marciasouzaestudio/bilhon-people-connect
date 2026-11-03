import { useState, useCallback, useEffect } from "react";
import {
  Image,
  Film,
  LayoutGrid,
  Eye,
  Send,
  Download,
  Trash2,
  ImageOff,
  Loader2,
  Play,
  ImagePlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MediaPreviewDialog } from "@/components/MediaPreviewDialog";
import { IncluirImagemDialog } from "@/components/media/IncluirImagemDialog";
import { getCreations, deleteCreation, type Creation, type CreationOrigin } from "@/lib/gallery";

// ─── Selo de origem ─────────────────────────────────────────────
// Sem isto o cliente não distingue o que ELE enviou do que a IA gerou.

const ORIGEM: Record<CreationOrigin, { rotulo: string; classe: string } | null> = {
  ai: null, // o default histórico não precisa de selo — polui a grade
  upload: { rotulo: "Enviada", classe: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  stock: { rotulo: "Banco de imagens", classe: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
};

// ─── Filter types ───────────────────────────────────────────────

type FilterType = "all" | "image" | "video" | "carousel";

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "image", label: "Imagens" },
  { value: "video", label: "Vídeos" },
  { value: "carousel", label: "Carroséis" },
];

// ─── Component ──────────────────────────────────────────────────

export default function Gallery() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCreation, setPreviewCreation] = useState<Creation | null>(null);
  const [creations, setCreations] = useState<Creation[]>([]);
  const [loading, setLoading] = useState(true);
  const [incluirOpen, setIncluirOpen] = useState(false);

  const loadCreations = useCallback(async () => {
    setLoading(true);
    const data = await getCreations();
    setCreations(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCreations();
  }, [loadCreations]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteCreation(id);
    loadCreations();
    toast({ title: "Criação removida" });
  }, [toast, loadCreations]);

  const filtered =
    activeFilter === "all"
      ? creations
      : creations.filter((c) => c.type === activeFilter);

  // ── Handlers ────────────────────────────────────────────────

  function handleView(creation: Creation) {
    setPreviewCreation(creation);
    setPreviewOpen(true);
  }

  function handleUseInPost(creation: Creation) {
    navigate("/studio", { state: { mediaUrls: creation.urls, fromVisual: true } });
  }

  function handleDownload(creation: Creation) {
    const url = creation.thumbnailUrl ?? creation.urls[0];
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = creation.templateName ?? "download";
      a.target = "_blank";
      a.click();
    }
    toast({ title: "Download iniciado" });
  }

  function handleDeleteCreation(creation: Creation) {
    handleDelete(creation.id);
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-h2Sm md:text-h2">
            <Image className="h-6 w-6 text-primary" />
            <span className="text-gradient-bilhon">Galeria de Criações</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suas criações — geradas por IA, enviadas por você ou do banco de imagens
          </p>
        </div>
        <Button onClick={() => setIncluirOpen(true)} data-testid="botao-incluir-imagem">
          <ImagePlus className="mr-2 h-4 w-4" />
          Incluir imagem
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={activeFilter === f.value ? "default" : "outline"}
            className={
              activeFilter === f.value
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : ""
            }
            onClick={() => setActiveFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Grid or empty state */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/40 bg-primary/5 py-20 text-center dark:bg-primary/10">
          <ImageOff className="mb-4 h-12 w-12 text-primary/60" />
          <p className="max-w-md text-sm text-muted-foreground">
            Nenhuma criação salva ainda. Use{" "}
            <span className="font-medium text-primary">Incluir imagem</span> para
            enviar uma foto sua ou buscar no banco de imagens — ou crie visuais na
            aba <span className="font-medium text-primary">Criar Visual</span>.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setIncluirOpen(true)}>
            <ImagePlus className="mr-2 h-4 w-4" />
            Incluir imagem
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((creation) => (
            <CreationCard
              key={creation.id}
              creation={creation}
              onView={handleView}
              onUseInPost={handleUseInPost}
              onDownload={handleDownload}
              onDelete={handleDeleteCreation}
            />
          ))}
        </div>
      )}

      {/* Incluir imagem — upload do computador ou banco de imagens.
          A aba "da galeria" não entra aqui: já estamos nela. */}
      <IncluirImagemDialog
        open={incluirOpen}
        onOpenChange={setIncluirOpen}
        origens={["upload", "banco"]}
        salvarNaGaleria
        descricao="Envie fotos do seu computador ou busque no banco de imagens. Elas ficam salvas aqui e podem ser usadas em qualquer post."
        onConfirmar={async (urls) => {
          await loadCreations();
          toast({
            title: urls.length === 1 ? "Imagem incluída na galeria" : `${urls.length} imagens incluídas na galeria`,
          });
        }}
      />

      {/* Media Preview Dialog */}
      {previewCreation && (
        <MediaPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          urls={previewCreation.urls}
          title={previewCreation.templateName}
          onUseInPost={() => handleUseInPost(previewCreation)}
        />
      )}
    </div>
  );
}

// ─── Creation Card ────────────────────────────────────────────────

interface CreationCardProps {
  creation: Creation;
  onView: (c: Creation) => void;
  onUseInPost: (c: Creation) => void;
  onDownload: (c: Creation) => void;
  onDelete: (c: Creation) => void;
}

function CreationCard({
  creation,
  onView,
  onUseInPost,
  onDownload,
  onDelete,
}: CreationCardProps) {
  const thumb = creation.thumbnailUrl ?? creation.urls[0] ?? "";
  const isVideo = creation.type === "video";
  const selo = ORIGEM[creation.origin];
  const [broken, setBroken] = useState(false);
  const date = new Date(creation.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const showMedia = !!thumb && !broken;

  return (
    <Card className="group card-premium overflow-hidden">
      {/* Thumbnail — clicar abre o preview. Vídeo NÃO pode ir num <img>. */}
      <button
        type="button"
        onClick={() => onView(creation)}
        title="Ver"
        className="relative block aspect-square w-full overflow-hidden bg-muted"
      >
        {showMedia ? (
          isVideo ? (
            <video
              src={thumb}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setBroken(true)}
            />
          ) : (
            <img
              src={thumb}
              alt={creation.templateName ?? "Criação"}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setBroken(true)}
            />
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground/50">
            {isVideo ? <Film className="h-10 w-10" /> : <ImageOff className="h-10 w-10" />}
            <span className="text-[11px]">Prévia indisponível</span>
          </div>
        )}

        {/* Type overlay icon */}
        {isVideo && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-1">
            <Play className="h-3.5 w-3.5 text-white" />
          </div>
        )}
        {creation.type === "carousel" && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-1">
            <LayoutGrid className="h-4 w-4 text-white" />
            <span className="text-xs font-medium text-white">
              {creation.urls.length}
            </span>
          </div>
        )}

        {/* Selo de origem — distingue o que o cliente enviou do que a IA gerou */}
        {selo && (
          <span
            className={`absolute right-2 top-2 rounded-md border px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm ${selo.classe}`}
            data-testid="selo-origem"
          >
            {selo.rotulo}
          </span>
        )}
      </button>

      {/* Info + ações sempre visíveis (funciona no touch, contraste ok) */}
      <CardContent className="space-y-2 p-3">
        <p className="truncate text-sm font-medium">
          {creation.templateName ?? "Sem nome"}
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{date}</p>
          {creation.published ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">
              Publicado
            </Badge>
          ) : (
            <Badge variant="secondary">Rascunho</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 pt-1">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 flex-1 gap-1.5 px-2"
            title="Ver"
            onClick={() => onView(creation)}
          >
            <Eye className="h-4 w-4" />
            <span className="text-xs">Ver</span>
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            title="Usar em post"
            onClick={() => onUseInPost(creation)}
          >
            <Send className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            title="Baixar"
            onClick={() => onDownload(creation)}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 text-destructive hover:text-destructive"
            title="Excluir"
            onClick={() => onDelete(creation)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
