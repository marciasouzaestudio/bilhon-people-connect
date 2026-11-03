import { useState } from "react";
import { Loader2, Wand2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useBrands } from "@/hooks/use-brands";
import { generateOpenAiImage } from "@/lib/api";
import { brandImageDirective } from "@/lib/brand";
import { saveVisualToGallery } from "@/lib/gallery";
import { useStudio } from "./StudioProvider";

// Estilos de arte gerados 100% via gpt-image-2.
const STYLES: { name: string; hint: string; withText?: boolean }[] = [
  { name: "Quote card", hint: "card de citação elegante, tipografia em destaque, fundo sólido sofisticado", withText: true },
  { name: "Pôster tipográfico", hint: "pôster com tipografia grande e marcante, alto contraste, composição ousada", withText: true },
  { name: "Infográfico", hint: "infográfico limpo e organizado com ícones simples e hierarquia visual clara", withText: true },
  { name: "Minimalista", hint: "design minimalista, muito espaço negativo, elegante e moderno" },
  { name: "Editorial", hint: "estética de revista editorial premium, fotográfico e sofisticado" },
  { name: "3D render", hint: "render 3D moderno, materiais suaves e iluminação cinematográfica" },
  { name: "Foto realista", hint: "fotografia realista de alta qualidade, iluminação natural, profundidade" },
  { name: "Aquarela", hint: "ilustração artística em aquarela, traços orgânicos" },
];

export function ArtStyles() {
  const { brands } = useBrands();
  const { doc, patchSlide, patchEl, currentSlide, selectedEl } = useStudio();
  const brand = brands.find((b) => b.id === doc.brandId) || null;

  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const apply = (url: string) => {
    if (selectedEl?.type === "image") patchEl(selectedEl.id, { src: url });
    else patchSlide(currentSlide, { bgImage: url });
  };

  const generate = async (style: { name: string; hint: string; withText?: boolean }) => {
    const subject = topic.trim() || doc.caption || brand?.industry || brand?.name || "";
    if (!subject) { toast.error("Descreva o tema da arte."); return; }
    setBusy(style.name);
    try {
      const textClause = style.withText ? `Inclua o texto em destaque, legível e bem composto: "${subject}".` : `Tema: ${subject}.`;
      const prompt = [
        brandImageDirective(brand),
        `Crie uma arte para redes sociais no estilo "${style.name}": ${style.hint}.`,
        textClause,
        "Composição profissional, pronta para publicação.",
      ].filter(Boolean).join("\n\n");
      const { images } = await generateOpenAiImage({ prompt, size: "1024x1536", quality: "medium", n: 1 });
      if (!images?.[0]) { toast.error("Falha ao gerar a arte."); return; }
      apply(images[0]);
      toast.success(`Arte "${style.name}" gerada`);
      saveVisualToGallery({ urls: [images[0]], prompt: `${style.name}: ${subject}`, templateName: `Studio · ${style.name}` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar arte");
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
        <Palette className="h-3.5 w-3.5" /> Estilos de arte (IA)
      </p>
      <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema da arte (ou usa a legenda atual)" className="h-9" />
      <div className="grid grid-cols-2 gap-1.5">
        {STYLES.map((s) => (
          <Button key={s.name} variant="outline" size="sm" className="h-auto min-h-9 justify-start whitespace-normal text-left leading-tight py-2 text-[11px]" onClick={() => generate(s)} disabled={!!busy}>
            {busy === s.name ? <Loader2 className="mr-1.5 h-3 w-3 shrink-0 animate-spin" /> : <Wand2 className="mr-1.5 h-3 w-3 shrink-0 text-primary" />}
            {s.name}
          </Button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Gera a arte com gpt-image-2 (paleta/tom da marca) e aplica ao slide.</p>
    </div>
  );
}
