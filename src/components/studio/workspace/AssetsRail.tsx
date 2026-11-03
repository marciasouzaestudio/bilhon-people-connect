import { useState } from "react";
import { Type, Image as ImageIcon, Square, Upload, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBrands } from "@/hooks/use-brands";
import { searchStockImages, type StockImage } from "@/lib/api";
import { ArtStyles } from "./ArtStyles";
import { useStudio } from "./StudioProvider";
import { uid, type El } from "./types";

export function AssetsRail() {
  const { user } = useAuth();
  const { brands } = useBrands();
  const { doc, addEl, patchEl, patchSlide, currentSlide, selectedEl } = useStudio();
  const brand = brands.find((b) => b.id === doc.brandId) || null;
  const accent = brand?.colors?.[2] || "#ffffff";

  const [uploading, setUploading] = useState(false);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [stock, setStock] = useState<StockImage[]>([]);

  const addElement = (type: El["type"]) => {
    const base: El = type === "text"
      ? { id: uid(), type, x: 40, y: 180, w: 320, h: 70, text: "Novo texto", fontSize: 24, color: accent, weight: 600, align: "left" }
      : type === "image"
      ? { id: uid(), type, x: 130, y: 130, w: 140, h: 140, src: "", radius: 12 }
      : { id: uid(), type, x: 130, y: 150, w: 140, h: 100, bg: accent, radius: 12, opacity: 1 };
    addEl(base);
  };

  const applyImage = (url: string) => {
    if (selectedEl?.type === "image") patchEl(selectedEl.id, { src: url });
    else patchSlide(currentSlide, { bgImage: url });
    toast.success("Imagem aplicada ao slide");
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      // RLS do bucket "media": a 1a pasta do caminho tem que ser o auth.uid().
      const path = `${user.id}/studio/upload_${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file);
      if (error) throw error;
      applyImage(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally { setUploading(false); }
  };

  const search = async () => {
    const query = q.trim() || brand?.industry || brand?.name || "";
    if (!query) { toast.error("Digite o que buscar."); return; }
    setSearching(true); setStock([]);
    try {
      const { images } = await searchStockImages({ query, count: 9, orientation: "squarish" });
      if (!images?.length) toast.error("Nada encontrado."); else setStock(images);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro na busca"); } finally { setSearching(false); }
  };

  return (
    <div className="space-y-4">
      {/* Elementos */}
      <div>
        <p className="mb-2 eyebrow">Elementos</p>
        <div className="grid grid-cols-3 gap-1.5">
          <Button variant="outline" size="sm" className="h-auto flex-col gap-1 py-2 text-[11px]" onClick={() => addElement("text")}><Type className="h-4 w-4" />Texto</Button>
          <Button variant="outline" size="sm" className="h-auto flex-col gap-1 py-2 text-[11px]" onClick={() => addElement("image")}><ImageIcon className="h-4 w-4" />Imagem</Button>
          <Button variant="outline" size="sm" className="h-auto flex-col gap-1 py-2 text-[11px]" onClick={() => addElement("shape")}><Square className="h-4 w-4" />Forma</Button>
        </div>
      </div>

      {/* Mídia */}
      <div className="space-y-2">
        <p className="eyebrow">Mídia</p>
        <label className="block">
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          <span className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar imagem
          </span>
        </label>

        <div className="flex gap-1.5">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no Pexels" className="h-9" onKeyDown={(e) => e.key === "Enter" && search()} />
          <Button size="icon" className="h-9 w-9 shrink-0 bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30" onClick={search} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {stock.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {stock.map((img) => (
              <button key={img.id} type="button" onClick={() => applyImage(img.url)} className="overflow-hidden rounded-md border border-border hover:ring-2 hover:ring-primary">
                <img src={img.thumbUrl || img.url} alt={img.alt} className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Estilos de arte (gpt-image-2) */}
      <ArtStyles />
    </div>
  );
}
