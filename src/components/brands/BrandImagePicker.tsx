import { useEffect, useState } from "react";
import { ImageIcon, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { searchStockImages, type StockImage } from "@/lib/api";

interface Props {
  /** Termo padrão para pré-buscar (ex.: setor da marca). */
  defaultQuery?: string;
  /** Sugestões de termos rápidos que aparecem como chips. */
  suggestions?: string[];
  /** Orientação retornada pelo Pexels. */
  orientation?: "landscape" | "portrait" | "squarish";
  /** Texto do botão que abre o banco. */
  label?: string;
  /** Chamado quando o usuário escolhe uma imagem. */
  onPick: (url: string) => void;
}

/**
 * Banco de imagens (Pexels) reutilizável para a tela de Marcas.
 * Substitui a necessidade de upload manual quando o usuário só quer um
 * placeholder bonito (foto de perfil/logo) alinhado ao setor da marca.
 */
export function BrandImagePicker({
  defaultQuery,
  suggestions = [],
  orientation = "squarish",
  label = "Banco de imagens",
  onPick,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(defaultQuery || "");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<StockImage[]>([]);

  const run = async (query: string) => {
    const term = query.trim();
    if (!term) {
      toast.error("Digite o que buscar.");
      return;
    }
    setLoading(true);
    setImages([]);
    try {
      const { images } = await searchStockImages({ query: term, count: 12, orientation });
      if (!images?.length) toast.error("Nada encontrado.");
      else setImages(images);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na busca");
    } finally {
      setLoading(false);
    }
  };

  // Pré-busca ao abrir se houver query padrão e ainda não houver resultados.
  useEffect(() => {
    if (open && defaultQuery && images.length === 0 && !loading) {
      setQ(defaultQuery);
      run(defaultQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (url: string) => {
    onPick(url);
    setOpen(false);
    toast.success("Imagem aplicada");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9">
          <ImageIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Banco de imagens</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar no Pexels (ex: tecnologia, café, moda)"
            onKeyDown={(e) => e.key === "Enter" && run(q)}
          />
          <Button
            type="button"
            onClick={() => run(q)}
            disabled={loading}
            className="bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQ(s);
                  run(s);
                }}
                className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && images.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Pesquise por um termo ou clique em uma sugestão.
            </p>
          )}
          {!loading && images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => pick(img.fullUrl || img.url)}
                  className="group overflow-hidden rounded-lg border border-border hover:ring-2 hover:ring-primary"
                  title={`Foto por ${img.author}`}
                >
                  <img
                    src={img.thumbUrl || img.url}
                    alt={img.alt}
                    className="aspect-square w-full object-cover transition group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">
          Imagens fornecidas por Pexels. Configure sua chave em Configurações.
        </p>
      </DialogContent>
    </Dialog>
  );
}