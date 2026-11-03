import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Globe,
  Youtube,
  FileText,
  MessageSquare,
  Search,
  Headphones,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Trash2,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { extractSource } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ContentSource } from "@/types";
import { requireOrgId } from "@/lib/org";

const SOURCE_TYPES = [
  { id: "perplexity-query", label: "Pesquisar com IA", icon: Search, desc: "Pesquise tendências e informações com IA", inputType: "text" as const },
  { id: "article", label: "Artigo / URL", icon: Globe, desc: "Extraia conteúdo de qualquer URL", inputType: "url" as const },
  { id: "youtube", label: "YouTube", icon: Youtube, desc: "Extraia transcrição de vídeos", inputType: "url" as const },
  { id: "text", label: "Texto", icon: FileText, desc: "Insira texto bruto para processar", inputType: "text" as const },
  { id: "twitter", label: "Tweet", icon: MessageSquare, desc: "Extraia conteúdo de tweets", inputType: "url" as const },
  { id: "tiktok", label: "TikTok", icon: MessageSquare, desc: "Extraia transcrição de TikToks", inputType: "url" as const },
  { id: "audio", label: "Áudio", icon: Headphones, desc: "Transcreva arquivos de áudio", inputType: "url" as const },
  { id: "pdf", label: "PDF", icon: FileText, desc: "Extraia texto de documentos PDF", inputType: "url" as const },
];

export default function Sources() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState("perplexity-query");
  const [inputValue, setInputValue] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [extracting, setExtracting] = useState(false);

  const { data: savedSources = [], isLoading: loadingSources } = useQuery({
    queryKey: ["saved_sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_sources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  async function persistSource(source: { title?: string; content?: string; sourceType?: string; referenceUrl?: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const org_id = await requireOrgId();
    const exists = savedSources.some(s => s.title === (source.title || "Fonte sem título") && s.source_type === (source.sourceType || selectedType));
    if (exists) return;
    await supabase.from("saved_sources").insert({
      org_id,
      user_id: user.id,
      source_type: source.sourceType || selectedType,
      title: source.title || "Fonte sem título",
      content: source.content || "",
      reference_url: source.referenceUrl || null,
      custom_instructions: customInstructions || null,
    });
    queryClient.invalidateQueries({ queryKey: ["saved_sources"] });
  }

  const currentType = SOURCE_TYPES.find((t) => t.id === selectedType)!;

  const handleExtract = async () => {
    if (!inputValue.trim()) return;
    setExtracting(true);
    try {
      const params: { sourceType: string; url?: string; text?: string; customInstructions?: string } = { sourceType: selectedType };
      if (currentType.inputType === "url") params.url = inputValue;
      else params.text = inputValue;
      if (customInstructions.trim()) params.customInstructions = customInstructions;

      const result = await extractSource(params);
      toast({ title: "Conteúdo extraído!", description: result.title || "Fonte pronta para uso." });
      persistSource(result);
      setInputValue("");
      setCustomInstructions("");
    } catch (err) {
      toast({ title: "Erro na extração", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remover esta fonte da biblioteca? Esta ação não pode ser desfeita.")) return;
    await supabase.from("saved_sources").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["saved_sources"] });
    toast({ title: "Fonte removida" });
  };

  const isExtracting = extracting;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-h2Sm md:text-h2">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="text-gradient-bilhon">Fontes de Conteúdo</span>
        </h1>
        <p className="mt-1 text-muted-foreground">
          Extraia e pesquise conteúdo de diversas fontes para transformar em posts
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="card-premium lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Selecionar Fonte</CardTitle>
            <CardDescription>Escolha o tipo de fonte e insira a URL ou texto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SOURCE_TYPES.map((type) => (
                <div
                  key={type.id}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 cursor-pointer transition-all text-center ${
                    selectedType === type.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/50 hover:border-primary/30"
                  }`}
                  onClick={() => { setSelectedType(type.id); setInputValue(""); }}
                >
                  <type.icon className={`h-5 w-5 ${selectedType === type.id ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs font-medium">{type.label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{currentType.desc}</label>
              {currentType.inputType === "url" ? (
                <Input
                  placeholder="Cole a URL aqui (ex: https://...)"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              ) : (
                <Textarea
                  placeholder={selectedType === "perplexity-query" ? "Ex: Quais são as tendências de redes sociais em 2026?" : "Cole seu texto aqui..."}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="min-h-[100px]"
                />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Instruções personalizadas (opcional)</label>
              <Input
                placeholder="Ex: Foque nos pontos principais, resuma em 5 bullets"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
              />
            </div>

            <Button
              className="w-full bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30"
              disabled={!inputValue.trim() || isExtracting}
              onClick={handleExtract}
            >
              {isExtracting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extraindo...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />Extrair Conteúdo</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Saved Sources History */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Histórico de Fontes
            </CardTitle>
            <CardDescription>{savedSources.length} fonte(s) salva(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSources ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : savedSources.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma fonte extraída ainda</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {savedSources.map((source) => (
                  <div key={source.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">
                        {SOURCE_TYPES.find((t) => t.id === source.source_type)?.label ?? source.source_type}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(source.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs font-medium truncate">{source.title || "Fonte sem título"}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-3">{source.content}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {new Date(source.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => navigate("/studio", {
                        state: {
                          sourceContent: source.content,
                          sourceTitle: source.title,
                        },
                      })}
                    >
                      Usar como base para post
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
