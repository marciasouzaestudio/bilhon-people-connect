import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FlaskConical,
  Upload,
  Sparkles,
  SlidersHorizontal,
  Copy,
  Trash2,
  Send,
  Loader2,
  Wand2,
  RotateCcw,
  Download,
  Plus,
  Trophy,
  BarChart3,
  Lightbulb,
  ImagePlus,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useGenerateContent } from "@/hooks/use-social";
import { saveUploadToGallery } from "@/lib/gallery";

// ─── Types ──────────────────────────────────────────────────────

interface ImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
  blur: number;
  grayscale: number;
  sepia: number;
}

interface Variation {
  id: string;
  imageUrl: string;
  filters: ImageFilters;
  caption: string;
  aiScore: number | null;
  aiInsight: string;
}

const DEFAULT_FILTERS: ImageFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hueRotate: 0,
  blur: 0,
  grayscale: 0,
  sepia: 0,
};

const FILTER_PRESETS = [
  { name: "Original", filters: { ...DEFAULT_FILTERS } },
  { name: "Vibrante", filters: { ...DEFAULT_FILTERS, saturation: 150, contrast: 110 } },
  { name: "Frio", filters: { ...DEFAULT_FILTERS, hueRotate: 200, saturation: 80, brightness: 105 } },
  { name: "Quente", filters: { ...DEFAULT_FILTERS, hueRotate: 20, saturation: 120, sepia: 20 } },
  { name: "Cinema", filters: { ...DEFAULT_FILTERS, contrast: 130, saturation: 80, brightness: 90 } },
  { name: "Suave", filters: { ...DEFAULT_FILTERS, blur: 0.5, brightness: 110, contrast: 90 } },
  { name: "P&B", filters: { ...DEFAULT_FILTERS, grayscale: 100 } },
  { name: "Sépia", filters: { ...DEFAULT_FILTERS, sepia: 80, brightness: 105 } },
  { name: "Alto Contraste", filters: { ...DEFAULT_FILTERS, contrast: 160, brightness: 105, saturation: 120 } },
  { name: "Vintage", filters: { ...DEFAULT_FILTERS, sepia: 40, contrast: 110, brightness: 95, saturation: 80 } },
];

function filtersToCSS(f: ImageFilters): string {
  return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) hue-rotate(${f.hueRotate}deg) blur(${f.blur}px) grayscale(${f.grayscale}%) sepia(${f.sepia}%)`;
}

// "Queima" os filtros na imagem via canvas e devolve um data URL. Sem isto os
// ajustes eram só de pré-visualização (CSS) e se perdiam ao usar/salvar o post.
function burnFilters(src: string, f: ImageFilters): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(src); return; }
      ctx.filter = filtersToCSS(f);
      ctx.drawImage(img, 0, 0);
      try { resolve(canvas.toDataURL("image/png")); }
      catch { resolve(src); } // canvas "tainted" (CORS) → mantém o original
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

function generateId(): string {
  return `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Component ──────────────────────────────────────────────────

export default function Lab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const generateMutation = useGenerateContent();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [filters, setFilters] = useState<ImageFilters>({ ...DEFAULT_FILTERS });
  const [caption, setCaption] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [variations, setVariations] = useState<Variation[]>([]);
  const [activeTab, setActiveTab] = useState("filters");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilters({ ...DEFAULT_FILTERS });
    // Lê como data URL (não blob): persistUrls só persiste data:/http no storage;
    // blob: era descartado no save e a imagem editada se perdia ao salvar/publicar.
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
    setVariations([]);
    toast({ title: "Imagem carregada!" });
  };

  // Filter change
  const updateFilter = (key: keyof ImageFilters, value: number) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: typeof FILTER_PRESETS[0]) => {
    setFilters({ ...preset.filters });
  };

  const resetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  // Variations
  const addVariation = () => {
    if (!imageUrl) return;
    const variation: Variation = {
      id: generateId(),
      imageUrl,
      filters: { ...filters },
      caption,
      aiScore: null,
      aiInsight: "",
    };
    setVariations((prev) => [...prev, variation]);
    toast({ title: `Variação ${variations.length + 1} salva!` });
  };

  const removeVariation = (id: string) => {
    setVariations((prev) => prev.filter((v) => v.id !== id));
  };

  // AI Caption Generation
  const handleGenerateCaption = async () => {
    if (!aiPrompt.trim()) return;
    try {
      const result = await generateMutation.mutateAsync({
        prompt: aiPrompt,
        platforms: ["instagram"],
      });
      const text = result.posts?.instagram || Object.values(result.posts || {})[0] || "";
      setCaption(text);
      toast({ title: "Legenda gerada!" });
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    }
  };

  // AI A/B Analysis
  const handleAnalyzeVariations = async () => {
    if (variations.length < 2) {
      toast({ title: "Crie pelo menos 2 variações para comparar", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const variationDescriptions = variations.map((v, i) => {
        const f = v.filters;
        return `Variação ${i + 1}: Caption="${v.caption.slice(0, 100)}", Filtros: brilho=${f.brightness}%, contraste=${f.contrast}%, saturação=${f.saturation}%, tons=${f.hueRotate > 0 ? "alterados" : "naturais"}, ${f.grayscale > 0 ? "P&B" : f.sepia > 0 ? "sépia" : "colorido"}`;
      }).join("\n");

      const result = await generateMutation.mutateAsync({
        prompt: `Analise estas variações de post para Instagram e dê uma nota de 1-10 para cada uma com justificativa.
Considere: engajamento esperado, apelo visual, clareza da mensagem, uso de hashtags, call-to-action.

${variationDescriptions}

Responda em JSON: { "scores": [{ "variation": 1, "score": 8.5, "insight": "..." }] }`,
        platforms: ["instagram"],
      });

      // Parse AI response for scores - result may have scores directly or inside posts
      let scores: Array<{ variation?: number; score?: number; insight?: string }> = [];
      
      if ((result as any).scores && Array.isArray((result as any).scores)) {
        // Direct scores from AI JSON response
        scores = (result as any).scores;
      } else {
        // Try to extract from posts text
        const responseText = result.posts?.instagram || Object.values(result.posts || {})[0] || "";
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*"scores"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            scores = parsed.scores || [];
          }
        } catch {
          // If all parsing fails, set raw insight
          setVariations((prev) =>
            prev.map((v, i) => ({
              ...v,
              aiInsight: i === 0 ? responseText : v.aiInsight,
            }))
          );
          toast({ title: "Análise concluída!" });
          return;
        }
      }

      if (scores.length > 0) {
        setVariations((prev) =>
          prev.map((v, i) => ({
            ...v,
            aiScore: scores[i]?.score ?? null,
            aiInsight: scores[i]?.insight ?? "",
          }))
        );
      }

      toast({ title: "Análise concluída!" });
    } catch (err) {
      toast({ title: "Erro na análise", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Use winner
  const handleUseInPost = async (variation?: Variation) => {
    const v = variation || { imageUrl, filters, caption };
    if (!v.imageUrl) return;
    // Aplica os filtros de verdade na imagem antes de enviar/salvar.
    const finalUrl = await burnFilters(v.imageUrl, v.filters);
    saveUploadToGallery([finalUrl]);
    navigate("/studio", {
      state: {
        mediaUrls: [finalUrl],
        sourceContent: (v as any).caption || caption,
        sourceTitle: "Post Lab",
        fromVisual: true,
      },
    });
  };

  const bestVariation = variations.length > 0
    ? variations.reduce((best, v) => (v.aiScore ?? 0) > (best.aiScore ?? 0) ? v : best)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-h2Sm md:text-h2">
          <FlaskConical className="h-6 w-6 text-primary" />
          <span className="text-gradient-bilhon">Post Lab</span>
        </h1>
        <p className="mt-1 text-muted-foreground">
          Laboratório criativo — filtros, IA, e testes A/B para o post perfeito
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Image + Filters */}
        <div className="space-y-6">
          {/* Upload / Image */}
          {!imageUrl ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ImagePlus className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-sm text-muted-foreground mb-4">Suba uma imagem para começar a experimentar</p>
                <Button
                  className="bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-medium"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Escolher Imagem
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="card-premium">
              <CardContent className="p-4 space-y-4">
                {/* Image preview with filters */}
                <div className="relative overflow-hidden rounded-lg bg-muted aspect-square">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    style={{ filter: filtersToCSS(filters) }}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Trocar
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Resetar
                  </Button>
                  <Button variant="outline" size="sm" onClick={addVariation}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Salvar Variação
                  </Button>
                  <Button
                    size="sm"
                    className="ml-auto bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30 text-white"
                    onClick={() => handleUseInPost()}
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Usar em Post
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Presets */}
          {imageUrl && (
            <Card className="card-premium">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Presets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {FILTER_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className="group flex flex-col items-center gap-1"
                    >
                      <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-transparent group-hover:border-orange-500 transition-colors">
                        <img
                          src={imageUrl}
                          alt={preset.name}
                          className="w-full h-full object-cover"
                          style={{ filter: filtersToCSS(preset.filters) }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground group-hover:text-foreground transition-colors">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Controls */}
        <div className="space-y-6">
          {imageUrl && (
            <Card className="card-premium">
              <CardContent className="p-0">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full rounded-b-none border-b h-11">
                    <TabsTrigger value="filters" className="flex-1 gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Filtros
                    </TabsTrigger>
                    <TabsTrigger value="caption" className="flex-1 gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Legenda IA
                    </TabsTrigger>
                    <TabsTrigger value="ab" className="flex-1 gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Teste A/B
                      {variations.length > 0 && (
                        <Badge variant="secondary" className="text-[9px] ml-1">{variations.length}</Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  {/* FILTERS TAB */}
                  <TabsContent value="filters" className="p-4 space-y-4">
                    {[
                      { key: "brightness" as const, label: "Brilho", min: 0, max: 200, unit: "%" },
                      { key: "contrast" as const, label: "Contraste", min: 0, max: 200, unit: "%" },
                      { key: "saturation" as const, label: "Saturação", min: 0, max: 200, unit: "%" },
                      { key: "hueRotate" as const, label: "Matiz", min: 0, max: 360, unit: "°" },
                      { key: "grayscale" as const, label: "Escala de cinza", min: 0, max: 100, unit: "%" },
                      { key: "sepia" as const, label: "Sépia", min: 0, max: 100, unit: "%" },
                      { key: "blur" as const, label: "Desfoque", min: 0, max: 10, unit: "px" },
                    ].map(({ key, label, min, max, unit }) => (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{label}</Label>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {key === "blur" ? filters[key].toFixed(1) : filters[key]}{unit}
                          </span>
                        </div>
                        <Slider
                          value={[filters[key]]}
                          min={min}
                          max={max}
                          step={key === "blur" ? 0.1 : 1}
                          onValueChange={([v]) => updateFilter(key, v)}
                          className="accent-orange-500"
                        />
                      </div>
                    ))}
                  </TabsContent>

                  {/* CAPTION TAB */}
                  <TabsContent value="caption" className="p-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Tema / Prompt</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ex: post motivacional sobre persistência"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          className="flex-1"
                          onKeyDown={(e) => e.key === "Enter" && handleGenerateCaption()}
                        />
                        <Button
                          size="sm"
                          disabled={!aiPrompt.trim() || generateMutation.isPending}
                          className="bg-gradient-to-r from-orange-500 to-yellow-500 text-black"
                          onClick={handleGenerateCaption}
                        >
                          {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {["Motivacional", "Educativo", "Vendas", "Storytelling", "Humor", "Pergunta"].map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="cursor-pointer hover:bg-orange-500/10 hover:border-orange-500/50 transition-colors text-xs"
                          onClick={() => setAiPrompt((p) => p ? `${p}, ${tag.toLowerCase()}` : tag.toLowerCase())}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <Textarea
                      placeholder="Legenda gerada ou escreva a sua..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="min-h-[120px]"
                    />
                    <p className="text-xs text-muted-foreground">{caption.length} caracteres</p>
                  </TabsContent>

                  {/* A/B TEST TAB */}
                  <TabsContent value="ab" className="p-4 space-y-4">
                    {variations.length === 0 ? (
                      <div className="text-center py-8">
                        <FlaskConical className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Ajuste os filtros e legenda, depois clique <strong>"Salvar Variação"</strong> para criar versões para comparar.
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Crie pelo menos 2 variações para a IA analisar qual performa melhor.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Variations grid */}
                        <div className="grid grid-cols-2 gap-3">
                          {variations.map((v, i) => (
                            <div key={v.id} className={`rounded-lg border p-2 space-y-2 ${
                              bestVariation?.id === v.id && v.aiScore ? "border-yellow-500 ring-1 ring-yellow-500/20" : ""
                            }`}>
                              <div className="relative aspect-square rounded overflow-hidden">
                                <img
                                  src={v.imageUrl}
                                  alt={`Variação ${i + 1}`}
                                  className="w-full h-full object-cover"
                                  style={{ filter: filtersToCSS(v.filters) }}
                                />
                                {bestVariation?.id === v.id && v.aiScore && (
                                  <div className="absolute top-1 right-1 bg-yellow-500 text-black rounded-full p-1">
                                    <Trophy className="h-3 w-3" />
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium">Variação {i + 1}</span>
                                  {v.aiScore && (
                                    <Badge className={`text-[9px] ${v.aiScore >= 7 ? "bg-green-500/10 text-green-600" : v.aiScore >= 5 ? "bg-yellow-500/10 text-yellow-600" : "bg-red-500/10 text-red-600"}`}>
                                      {v.aiScore}/10
                                    </Badge>
                                  )}
                                </div>
                                {v.caption && (
                                  <p className="text-[10px] text-muted-foreground line-clamp-2">{v.caption}</p>
                                )}
                                {v.aiInsight && (
                                  <p className="text-[10px] text-orange-600 dark:text-orange-400 line-clamp-3">
                                    <Lightbulb className="h-3 w-3 inline mr-0.5" />
                                    {v.aiInsight}
                                  </p>
                                )}
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] flex-1"
                                    onClick={() => handleUseInPost(v)}
                                  >
                                    <Send className="h-3 w-3 mr-1" />
                                    Usar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] text-destructive"
                                    onClick={() => removeVariation(v.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Analyze button */}
                        <Button
                          className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-medium"
                          disabled={variations.length < 2 || isAnalyzing}
                          onClick={handleAnalyzeVariations}
                        >
                          {isAnalyzing ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analisando com IA...</>
                          ) : (
                            <><BarChart3 className="mr-2 h-4 w-4" />Analisar Variações com IA ({variations.length})</>
                          )}
                        </Button>

                        {bestVariation?.aiScore && (
                          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              <Trophy className="h-4 w-4 text-yellow-500" />
                              Melhor variação: Variação {variations.findIndex((v) => v.id === bestVariation.id) + 1}
                              <Badge className="bg-yellow-500/10 text-yellow-600 text-[10px]">{bestVariation.aiScore}/10</Badge>
                            </p>
                            {bestVariation.aiInsight && (
                              <p className="text-xs text-muted-foreground">{bestVariation.aiInsight}</p>
                            )}
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30 text-white"
                              onClick={() => handleUseInPost(bestVariation)}
                            >
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                              Usar Vencedora em Post
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
