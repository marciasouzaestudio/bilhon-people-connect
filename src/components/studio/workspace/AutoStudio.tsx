import { useState, useRef, useEffect } from "react";
import { Loader2, Sparkles, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useBrands } from "@/hooks/use-brands";
import {
  generateContent, generateOpenAiImage, aiAssist, extractSource,
  startTextToVideo, videoGenStatus, type VideoGenerationResult, type GenerateContentResult,
} from "@/lib/api";
import { brandImageDirective, brandTextProfile, brandTextHint, brandVideoDirective, brandVoiceDirective, type BrandProfile } from "@/lib/brand";
import { STUDIO_VIDEO_MODELS } from "@/lib/video-models";
import { saveVisualToGallery } from "@/lib/gallery";
import { OutputScreen } from "./OutputScreen";
import { emptyDoc } from "./StudioProvider";
import type { StudioDoc, StudioFormat, Slide } from "./types";

const EXAMPLES = [
  "Um carrossel de dicas para esta semana",
  "Um post de bastidores da equipe",
  "Um card com uma frase da marca",
  "Uma imagem para anunciar uma novidade",
];

type FormatChoice = "auto" | "carousel" | "post" | "card" | "image" | "video";
const FORMAT_CHOICES: { value: FormatChoice; label: string }[] = [
  { value: "auto", label: "Automático (IA decide)" },
  { value: "carousel", label: "Carrossel" },
  { value: "post", label: "Post" },
  { value: "card", label: "Card (estilo X)" },
  { value: "image", label: "Criativo / Imagem" },
  { value: "video", label: "Vídeo" },
];

type AspectChoice = "1:1" | "4:5" | "16:9";
// gpt-image só aceita 1024x1024, 1024x1536 (2:3) e 1536x1024 (3:2).
// Para 4:5 geramos no tamanho 2:3 mais próximo e cortamos no client.
const ASPECT_CHOICES: { value: AspectChoice; label: string; size: "1024x1024" | "1024x1536" | "1536x1024"; ratio: number }[] = [
  { value: "1:1", label: "Quadrado 1:1", size: "1024x1024", ratio: 1 },
  { value: "4:5", label: "Retrato 4:5", size: "1024x1536", ratio: 4 / 5 },
  { value: "16:9", label: "Paisagem 16:9", size: "1536x1024", ratio: 16 / 9 },
];

// Ajusta a imagem para o aspect ratio alvo SEM cortar conteúdo:
// extende a tela e preenche as bordas com a cor média da própria imagem
// (letterbox/pillarbox). Mantém 100% do conteúdo gerado pelo modelo.
async function fitToAspect(dataUrl: string, targetRatio: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const srcRatio = img.width / img.height;
      if (Math.abs(srcRatio - targetRatio) < 0.01) { resolve(dataUrl); return; }
      // Tela alvo: mantém a maior dimensão da fonte e ajusta a outra.
      let cw: number, ch: number;
      if (srcRatio > targetRatio) {
        // fonte mais larga → aumenta altura
        cw = img.width;
        ch = Math.round(img.width / targetRatio);
      } else {
        // fonte mais alta → aumenta largura
        ch = img.height;
        cw = Math.round(img.height * targetRatio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      // Cor de fundo = média das bordas da imagem (combina melhor que preto).
      try {
        const tmp = document.createElement("canvas");
        tmp.width = img.width; tmp.height = img.height;
        const tctx = tmp.getContext("2d")!;
        tctx.drawImage(img, 0, 0);
        const sample = (x: number, y: number, w: number, h: number) => {
          const d = tctx.getImageData(x, y, w, h).data;
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
          return [r / n, g / n, b / n];
        };
        const [r, g, b] = sample(0, 0, img.width, Math.min(8, img.height));
        ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
      } catch { ctx.fillStyle = "#000"; }
      ctx.fillRect(0, 0, cw, ch);
      const dx = Math.round((cw - img.width) / 2);
      const dy = Math.round((ch - img.height) / 2);
      ctx.drawImage(img, dx, dy);
      try { resolve(canvas.toDataURL("image/png")); } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Detecta aspect ratio mencionado no prompt do usuário (ex: "1:1", "quadrado", "16:9", "paisagem").
const detectAspectFromText = (text: string): AspectChoice | null => {
  const t = text.toLowerCase();
  if (/\b1\s*[:x]\s*1\b|quadrad[oa]|square/.test(t)) return "1:1";
  if (/\b16\s*[:x]\s*9\b|paisagem|landscape|horizontal/.test(t)) return "16:9";
  if (/\b4\s*[:x]\s*5\b|\b9\s*[:x]\s*16\b|\b3\s*[:x]\s*4\b|retrato|portrait|vertical|stor(y|ies)/.test(t)) return "4:5";
  return null;
};

interface Brief {
  format: StudioFormat;
  count: number;
  topic: string;
  objective: string;
  platforms: string[];
}

export function AutoStudio({ onEditInCanvas }: { onEditInCanvas: (doc: StudioDoc) => void; onBack?: () => void }) {
  const { brands, defaultBrand } = useBrands();
  const [brandId, setBrandId] = useState<string | null>(null);
  useEffect(() => { if (!brandId && defaultBrand) setBrandId(defaultBrand.id); }, [defaultBrand, brandId]);
  const brand = (brands.find((b) => b.id === brandId) || defaultBrand || null) as BrandProfile | null;

  const [prompt, setPrompt] = useState("");
  const [formatChoice, setFormatChoice] = useState<FormatChoice>("auto");
  const [slideCount, setSlideCount] = useState(6);
  const [aspectChoice, setAspectChoice] = useState<AspectChoice>("4:5");
  const [useBrand, setUseBrand] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [doc, setDoc] = useState<StudioDoc | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Modo avançado: pesquisa da empresa → roteiro revisável → vídeo com narração pt-BR;
  // passada dedicada de LinkedIn nos formatos de texto. Não muda a experiência padrão.
  const [advanced, setAdvanced] = useState(false);
  const [advContext, setAdvContext] = useState("");
  const [advUrl, setAdvUrl] = useState("");
  const [advExtracting, setAdvExtracting] = useState(false);
  // Modelo único de vídeo: Veo 3.1 via Gemini.
  const advVideoModels = STUDIO_VIDEO_MODELS.filter((m) => m.kind === "text-to-video");
  const defaultAdvModel = advVideoModels.find((m) => m.ptbrSpeech) || advVideoModels[0];
  const [advModelId, setAdvModelId] = useState<string>(defaultAdvModel.id);
  const advModel = advVideoModels.find((m) => m.id === advModelId) || defaultAdvModel;
  const closestTo10 = (ds: number[]) => ds.reduce((a, b) => (Math.abs(b - 10) < Math.abs(a - 10) ? b : a));
  const [advDuration, setAdvDuration] = useState<number>(closestTo10(defaultAdvModel.durations));
  const pickAdvModel = (id: string) => {
    setAdvModelId(id);
    const m = advVideoModels.find((x) => x.id === id);
    if (m && !m.durations.includes(advDuration)) setAdvDuration(closestTo10(m.durations));
  };
  const [script, setScript] = useState<{ narracao: string; cena: string; brief: Brief } | null>(null);

  // Marca só entra na geração (texto + enriquecimento do prompt de imagem/vídeo)
  // quando a caixa estiver marcada.
  const effectiveBrand = useBrand ? brand : null;
  const c1 = effectiveBrand?.colors?.[0] || "var(--bl-accent)";
  const c2 = effectiveBrand?.colors?.[1] || "var(--bl-accent)";
  const grad = `linear-gradient(135deg, ${c1}, ${c2})`;

  // Auto-save na galeria. saveVisualToGallery agora faz upload de data: URLs automaticamente.
  const autoSave = async (mediaOrDoc: StudioDoc) => {
    try {
      const urls = mediaOrDoc.videoUrl
        ? [mediaOrDoc.videoUrl]
        : mediaOrDoc.slides.map((s) => s.bgImage).filter(Boolean) as string[];
      if (urls.length) await saveVisualToGallery({ urls, prompt: mediaOrDoc.caption || prompt.trim(), templateName: "Studio · Automático" });
    } catch { /* best-effort */ }
  };

  const parseBrief = async (text: string): Promise<Brief> => {
    try {
      const { json } = await aiAssist({
        system: `Extraia da solicitação um JSON com: format ("post"|"carousel"|"image"|"card"|"video"), count (nº de slides; carrossel use o número pedido ou 5, senão 1), topic (tema curto), objective (objetivo/foco; ex: engajamento, vendas), platforms (array; default ["instagram"]). Responda APENAS o JSON.`,
        prompt: text, expectJson: true, temperature: 0.2,
      });
      const j = (json || {}) as Partial<Brief>;
      const format = (["post", "carousel", "image", "card", "video"].includes(j.format as string) ? j.format : "post") as StudioFormat;
      return {
        format,
        count: Math.min(Math.max(Number(j.count) || (format === "carousel" ? 5 : 1), 1), 10),
        topic: j.topic || text,
        objective: j.objective || "engajamento",
        platforms: Array.isArray(j.platforms) && j.platforms.length ? j.platforms : ["instagram"],
      };
    } catch {
      return { format: "post", count: 1, topic: text, objective: "engajamento", platforms: ["instagram"] };
    }
  };

  const slideArt = async (
    styleLine: string,
    heading: string,
    body: string,
    idx: number,
    total: number,
    size: "1024x1024" | "1024x1536" | "1536x1024",
    aspect: AspectChoice,
  ): Promise<string | undefined> => {
    const target = ASPECT_CHOICES.find((a) => a.value === aspect)!;
    const prompt = [
      brandImageDirective(effectiveBrand),
      styleLine,
      `Proporção (aspect ratio): ${aspect}. Mantenha o conteúdo principal (texto, rostos, logo) bem centralizado e longe das bordas — a imagem será cortada para ${aspect}.`,
      heading ? `Renderize o texto de forma legível, bonita e bem composta — TÍTULO: "${heading}".${body ? ` APOIO: "${body}".` : ""}` : "",
      total > 1 ? `Inclua um indicador discreto "${idx + 1}/${total}".` : "",
      effectiveBrand ? "Use a paleta da marca." : "",
    ].filter(Boolean).join("\n\n");
    const { images } = await generateOpenAiImage({ prompt, size, quality: "medium", n: 1 });
    const raw = images?.[0];
    if (!raw) return undefined;
    try { return await fitToAspect(raw, target.ratio); } catch { return raw; }
  };

  // Extrai o site do cliente (Firecrawl via source-extract) e soma ao contexto.
  const extractFromSite = async () => {
    const url = advUrl.trim();
    if (!url) { toast.error("Informe a URL do site."); return; }
    setAdvExtracting(true);
    try {
      const src = await extractSource({
        sourceType: "url", url,
        customInstructions: "Resuma em português brasileiro: quem é a empresa, o que vende, diferenciais, público-alvo e provas sociais (números, clientes).",
      });
      const extracted = (src.content || "").trim();
      if (!extracted) { toast.error("Não consegui extrair conteúdo desse site."); return; }
      setAdvContext((prev) => [prev.trim(), `— Extraído de ${url} —\n${extracted}`].filter(Boolean).join("\n\n").slice(0, 6000));
      toast.success("Contexto extraído do site!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao extrair do site");
    } finally { setAdvExtracting(false); }
  };

  // Roteiro pt-BR dimensionado à duração (~2,4 palavras/s de fala natural),
  // ancorado nos fatos do contexto — é o antídoto contra vídeo genérico.
  const buildRoteiro = async (brief: Brief): Promise<{ narracao: string; cena: string }> => {
    const words = Math.max(10, Math.round(advDuration * 2.4));
    const { json } = await aiAssist({
      system: `Você é roteirista de vídeos curtos de marketing. Escreva o roteiro de um vídeo de ${advDuration} segundos com narração FALADA em português brasileiro.
A narração tem gancho → desenvolvimento com fatos concretos do contexto → fechamento/CTA, em NO MÁXIMO ${words} palavras (o que cabe em ${advDuration}s de fala natural). Cite o nome da empresa/produto; nada genérico.
${brandTextHint(effectiveBrand)}
Responda APENAS JSON: { "narracao": "<fala completa em pt-BR>", "cena": "<descrição visual em pt-BR: ambiente, personagem, produto em evidência, enquadramento e movimento de câmera>" }`,
      prompt: `PEDIDO: ${brief.topic}. Objetivo: ${brief.objective}.${advContext.trim() ? `\n\nCONTEXTO DA EMPRESA/CLIENTE (use estes fatos):\n${advContext.trim().slice(0, 4000)}` : ""}`,
      expectJson: true, temperature: 0.7,
    });
    const j = (json || {}) as { narracao?: string; cena?: string };
    const narracao = String(j.narracao || "").trim();
    if (!narracao) throw new Error("A IA não retornou o roteiro. Tente novamente.");
    return { narracao, cena: String(j.cena || "").trim() || brief.topic };
  };

  // Dispara a geração no Gemini Veo 3.1 e faz o polling até concluir.
  // captionsPromise (opcional) escreve legenda/hashtags em paralelo ao vídeo.
  const launchVideo = async (
    brief: Brief,
    videoArgs: Record<string, unknown>,
    captionsPromise?: Promise<GenerateContentResult | null>,
  ) => {
    const base = emptyDoc("video", brandId);
    const r = await startTextToVideo(videoArgs) as VideoGenerationResult;
    if (!r?.request_id) throw new Error("Sem request_id do vídeo.");
    const startedAt = Date.now();
    const VIDEO_TIMEOUT_MS = 10 * 60 * 1000; // 10 min — evita polling infinito
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > VIDEO_TIMEOUT_MS) {
        clearInterval(pollRef.current!); pollRef.current = null;
        setGenerating(false); setProgress("");
        toast.error("O vídeo demorou demais. Tente novamente.");
        return;
      }
      try {
        const st = await videoGenStatus(r.request_id);
        if (st.status === "completed" && st.video?.url) {
          clearInterval(pollRef.current!); pollRef.current = null;
          let caption = brief.topic;
          let captionsByPlatform: Record<string, string> | undefined;
          let hashtags: string[] = [];
          if (captionsPromise) {
            const res = await captionsPromise.catch(() => null);
            if (res) {
              caption = res.posts?.[brief.platforms[0]] || Object.values(res.posts || {})[0] || caption;
              captionsByPlatform = res.posts;
              hashtags = res.hashtags || [];
            }
          }
          const videoDoc = { ...base, videoUrl: st.video.url, caption, captionsByPlatform, hashtags, platforms: brief.platforms as StudioDoc["platforms"] };
          setDoc(videoDoc);
          setGenerating(false); setProgress("");
          toast.success("Vídeo gerado!");
          autoSave(videoDoc);
        } else if (st.status === "failed" || st.status === "nsfw") {
          clearInterval(pollRef.current!); pollRef.current = null;
          setGenerating(false); setProgress(""); toast.error(st.error || "Vídeo falhou.");
        } else {
          setProgress(`Gerando vídeo… ${Math.round((Date.now() - startedAt) / 1000)}s`);
        }
      } catch { /* erro transitório: segue até o timeout */ }
    }, 5000);
  };

  // Modo avançado, etapa 2: gera o vídeo com o roteiro aprovado (narração explícita
  // em pt-BR via audio_prompt) + legenda em paralelo com o contexto da empresa.
  const generateVideoFromScript = async () => {
    if (!script) return;
    const narracao = script.narracao.trim();
    if (!narracao) { toast.error("A narração do roteiro está vazia."); return; }
    setGenerating(true); setProgress("Enviando para geração…");
    try {
      // Fala como DIÁLOGO entre aspas (é o formato que os modelos tratam como
      // fala literal; "Narração: X" vira descrição de cena e o TTS improvisa).
      const falaDirective = `A apresentadora olha para a câmera e diz, falando em português brasileiro (Brazilian Portuguese): "${narracao}". Toda a fala do vídeo é em português do Brasil — nunca em inglês.`;
      const vp = [brandVideoDirective(effectiveBrand), script.cena.trim() || script.brief.topic, falaDirective].filter(Boolean).join("\n\n");
      const captionsPromise = generateContent({
        prompt: `Legenda para um vídeo cuja narração é: "${narracao}". Tema: ${script.brief.topic}. Objetivo: ${script.brief.objective}.`,
        platforms: script.brief.platforms,
        tone: effectiveBrand?.tone,
        language: "português brasileiro",
        sourceContent: advContext.trim() || undefined,
        brandProfile: brandTextProfile(effectiveBrand),
      }).catch(() => null);
      await launchVideo(script.brief, {
        model: advModel.id,
        prompt: vp,
        duration: advDuration,
        with_audio: true,
        audio_language: "pt-BR",
      }, captionsPromise);
      setScript(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar");
      setGenerating(false); setProgress("");
    }
  };

  const regenRoteiro = async () => {
    if (!script) return;
    setGenerating(true); setProgress("Reescrevendo o roteiro…");
    try {
      const r = await buildRoteiro(script.brief);
      setScript({ ...r, brief: script.brief });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao refazer o roteiro");
    } finally { setGenerating(false); setProgress(""); }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error("Descreva o que você quer criar."); return; }
    setGenerating(true); setProgress("Interpretando seu pedido…"); setDoc(null);
    try {
      const brief = await parseBrief(prompt.trim());
      // Formato escolhido pelo usuário tem prioridade sobre o que a IA inferiu.
      if (formatChoice !== "auto") {
        brief.format = formatChoice as StudioFormat;
        brief.count = formatChoice === "carousel" ? Math.min(Math.max(slideCount, 2), 10) : 1;
      }
      // Aspect ratio: prompt do usuário > seletor (default 4:5).
      const detected = detectAspectFromText(prompt);
      const aspect: AspectChoice = detected ?? aspectChoice;
      const size = (ASPECT_CHOICES.find((a) => a.value === aspect) ?? ASPECT_CHOICES[1]).size;
      const base = emptyDoc(brief.format, brandId);

      if (brief.format === "video") {
        if (advanced) {
          // Etapa 1 da jornada avançada: roteiro revisável; o vídeo sai do botão "Gerar vídeo".
          setProgress("Escrevendo o roteiro…");
          const r = await buildRoteiro(brief);
          setScript({ ...r, brief });
          return;
        }
        setProgress("Gerando vídeo no Gemini Omni Flash…");
        const model = STUDIO_VIDEO_MODELS[0].id;
        const vp = [brandVideoDirective(effectiveBrand), `${brief.topic}. ${brief.objective}.`, brandVoiceDirective(effectiveBrand)].filter(Boolean).join("\n\n");
        await launchVideo(brief, { model, prompt: vp, duration: 8, with_audio: true, audio_language: "pt-BR" });
        return;
      }

      // texto (legenda + hashtags + slides se carrossel)
      // Contexto do cliente: campo do modo avançado OU uma URL colada no próprio
      // pedido (é o que o usuário fez ao pedir "carrossel de vendas <site>"). Sem
      // isto o resultado saía genérico mesmo com o site no comando.
      let srcContext = advanced && advContext.trim() ? advContext.trim() : "";
      if (!srcContext) {
        const urlInPrompt = prompt.match(/https?:\/\/[^\s]+/i)?.[0];
        if (urlInPrompt) {
          setProgress("Lendo o site informado…");
          try {
            const src = await extractSource({
              sourceType: "url", url: urlInPrompt,
              customInstructions: "Resuma em português brasileiro: quem é a empresa, o que vende, diferenciais, público-alvo e provas sociais (números, clientes).",
            });
            srcContext = (src.content || "").trim().slice(0, 6000);
            if (srcContext) toast.success("Li o site e usei como contexto.");
          } catch { /* segue sem o contexto do site */ }
        }
      }
      const ctxHint = srcContext
        ? `\n\nCONTEXTO DA EMPRESA/CLIENTE (baseie-se nestes fatos, nada genérico):\n${srcContext.slice(0, 4000)}`
        : "";

      setProgress("Escrevendo o conteúdo…");
      const res = await generateContent({
        prompt: `${brief.topic}. Objetivo: ${brief.objective}.${brief.format === "carousel" ? ` Gere um carrossel de ${brief.count} slides.` : ""}`,
        platforms: brief.platforms,
        tone: effectiveBrand?.tone,
        language: "português brasileiro",
        sourceContent: srcContext || undefined,
        brandProfile: brandTextProfile(effectiveBrand),
      });

      // Modo avançado: passada dedicada de LinkedIn — reescreve o rascunho da
      // campanha com profundidade (fatos do contexto), em vez de 1 campo num JSON só.
      if (advanced && brief.platforms.includes("linkedin") && res.posts?.linkedin) {
        setProgress("Aprofundando o post do LinkedIn…");
        try {
          const { text } = await aiAssist({
            system: `Você é um copywriter sênior de LinkedIn. Reescreva o post com mais profundidade: gancho forte na 1ª linha, storytelling com fatos CONCRETOS do contexto (nomes, números, detalhes), parágrafos curtos, fechamento com pergunta ou CTA, 800–1200 caracteres e 3-5 hashtags em pt-BR no final. ${brandTextHint(effectiveBrand)} Responda APENAS com o texto final do post.`,
            prompt: `RASCUNHO:\n${res.posts.linkedin}\n\nTEMA: ${brief.topic}. Objetivo: ${brief.objective}.${advContext.trim() ? `\n\nCONTEXTO DA EMPRESA/CLIENTE:\n${advContext.trim().slice(0, 4000)}` : ""}`,
            temperature: 0.7,
          });
          // O modelo (thinking) pode estourar o max_tokens do ai-assist e vir cortado
          // no meio da frase — só aceita se parecer completo (termina em pontuação
          // ou hashtag); senão fica o rascunho da campanha, que vem inteiro.
          const rewritten = (text || "").trim();
          const looksComplete = rewritten.length >= 300 && /[.!?…"”)\]]$|#[\p{L}\d_]+$/u.test(rewritten);
          if (looksComplete) res.posts.linkedin = rewritten;
        } catch { /* mantém o rascunho da campanha */ }
      }

      const plat = brief.platforms[0];
      const caption = res.posts?.[plat] || Object.values(res.posts || {})[0] || brief.topic;

      let slides: Slide[];
      if (brief.format === "carousel") {
        // Gera EXATAMENTE brief.count slides (não confiar no nº que o generate-content devolve).
        setProgress("Planejando os slides…");
        let specs: { heading: string; body: string }[] = [];
        try {
          const { json } = await aiAssist({
            system: `Crie um carrossel de Instagram com EXATAMENTE ${brief.count} slides sobre o tema${effectiveBrand ? ", na voz da marca" : ""}. O slide 1 é a capa (gancho forte) e o último é um CTA. Cada slide: { "heading": frase curta e impactante, "body": 1-2 linhas de apoio }. Use os fatos do contexto quando houver; nada genérico. ${brandTextHint(effectiveBrand)} Responda APENAS um array JSON com ${brief.count} objetos.`,
            prompt: `${brief.topic} (${brief.objective})${ctxHint}`, expectJson: true, temperature: 0.8,
          });
          specs = Array.isArray(json) ? json.filter((s) => s && s.heading).map((s) => ({ heading: String(s.heading), body: String(s.body || "") })) : [];
        } catch { /* usa fallback abaixo */ }
        // Completa com o carrossel do generate-content se vier curto.
        for (const s of res.carousel?.slides || []) { if (specs.length >= brief.count) break; specs.push({ heading: s.heading, body: s.body }); }
        specs = specs.slice(0, brief.count);
        if (!specs.length) throw new Error("A IA não retornou slides.");
        // Gera as artes em PARALELO — sequencial deixava o usuário esperando ~1min por slide.
        setProgress(`Gerando ${specs.length} artes em paralelo…`);
        const styleLine = `Arte de slide para carrossel de redes sociais sobre "${brief.topic}" (objetivo: ${brief.objective}). Design profissional e moderno.`;
        let done = 0;
        const imgs = await Promise.all(
          specs.map(async (s, i) => {
            const img = await slideArt(styleLine, s.heading, s.body, i, specs.length, size, aspect);
            done += 1;
            setProgress(`Artes prontas: ${done}/${specs.length}…`);
            return img;
          })
        );
        slides = imgs.map((img) => ({ bg: grad, bgImage: img, els: [] }));
      } else {
        setProgress("Gerando a arte…");
        // headline curto pra estampar na imagem
        const { text: headline } = await aiAssist({
          system: `Escreva uma frase curta e impactante (máx 8 palavras) em pt-BR para estampar numa arte sobre o tema${effectiveBrand ? ", na voz da marca" : ""}. Responda só a frase.`,
          prompt: `${brief.topic} (${brief.objective})${ctxHint}`, temperature: 0.8,
        });
        const styleByFormat: Record<string, string> = {
          card: `Card no estilo de um post do X/Twitter sobre "${brief.topic}": cartão claro com avatar redondo, nome e @handle da marca, e o texto em destaque, sobre fundo na paleta.`,
          image: `Imagem criativa de campanha publicitária sobre "${brief.topic}" (${brief.objective}): visual impactante, original e pronto para anúncio.`,
          post: `Arte de post para redes sociais sobre "${brief.topic}" (${brief.objective}). Design profissional e moderno.`,
        };
        const styleLine = styleByFormat[brief.format] || styleByFormat.post;
        const img = await slideArt(styleLine, (headline || brief.topic).trim(), "", 0, 1, size, aspect);
        slides = [{ bg: grad, bgImage: img, els: [] }];
      }

      const finalDoc: StudioDoc = {
        ...base,
        slides,
        caption,
        captionsByPlatform: res.posts,
        hashtags: res.hashtags || [],
        platforms: brief.platforms as StudioDoc["platforms"],
      };
      setDoc(finalDoc);
      toast.success("Criação pronta!");
      autoSave(finalDoc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar");
    } finally {
      if (!pollRef.current) { setGenerating(false); setProgress(""); }
    }
  };

  // Controles de vídeo do modo avançado — aparecem só quando vídeo está em jogo:
  // no painel avançado com o formato "Vídeo" selecionado, e no card de revisão
  // do roteiro (que é quando o vídeo vai ser gerado, inclusive no formato "auto").
  const videoControls = (
    <>
      <div className="space-y-1.5">
        <p className="eyebrow">Modelo de vídeo</p>
        <div className="flex flex-wrap gap-1.5">
          {advVideoModels.map((m) => (
            <button
              key={m.id}
              onClick={() => pickAdvModel(m.id)}
              disabled={generating}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                advModelId === m.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {m.label.split(" — ")[0]}{m.ptbrSpeech ? " · fala pt-BR" : ""}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">✓ Todo vídeo é gerado pelo Gemini Omni Flash com fala em português brasileiro.</p>
      </div>
      <div className="space-y-1.5">
        <p className="eyebrow">Duração do vídeo</p>
        <div className="flex flex-wrap gap-1.5">
          {advModel.durations.map((d) => (
            <button
              key={d}
              onClick={() => setAdvDuration(d)}
              disabled={generating}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                advDuration === d
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Para apresentar uma empresa, prefira a duração maior — 4–5s não desenvolvem o assunto.</p>
      </div>
    </>
  );

  return doc ? (
    <OutputScreen
      doc={doc}
      brand={effectiveBrand}
      onRestart={() => { setDoc(null); setPrompt(""); }}
      onEditInCanvas={onEditInCanvas}
    />
  ) : (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="eyebrow inline-flex items-center gap-1.5 justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Studio
        </p>
        <h1 className="mt-2 text-h2Sm md:text-h2 text-ink">
          O que vamos <span className="text-gradient-bilhon">publicar</span> hoje?
        </h1>
        {brands.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            <span className="text-xs text-muted-foreground">Marca:</span>
            {brands.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBrandId(b.id)}
                disabled={generating}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  brandId === b.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        ) : brand?.name ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Marca-base: <span className="font-medium text-primary">{brand.name}</span>
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          placeholder="Descreva a publicação em uma frase — a IA cuida do resto."
          className="text-base rounded-2xl"
          disabled={generating}
          autoFocus
        />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setPrompt(ex)} disabled={generating} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent">
              {ex}
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3 text-sm">
          <Switch checked={advanced} onCheckedChange={(v) => { setAdvanced(v); if (!v) setScript(null); }} disabled={generating} className="mt-0.5" />
          <span>
            Modo avançado
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Contexto da empresa + roteiro revisável com narração em pt-BR (vídeo) + passada dedicada para LinkedIn. A experiência padrão não muda com isto desligado.
            </span>
          </span>
        </label>

        {advanced && (
          <div className="space-y-4 rounded-xl border border-border p-3">
            <div className="space-y-1.5">
              <p className="eyebrow">Contexto da empresa/cliente</p>
              <Textarea
                value={advContext}
                onChange={(e) => setAdvContext(e.target.value)}
                rows={4}
                placeholder="Cole aqui fatos sobre a empresa/cliente: o que faz, produtos, diferenciais, público, números…"
                disabled={generating}
              />
              <div className="flex gap-2">
                <Input
                  value={advUrl}
                  onChange={(e) => setAdvUrl(e.target.value)}
                  placeholder="https://site-do-cliente.com"
                  disabled={generating || advExtracting}
                  className="h-9"
                />
                <Button type="button" variant="outline" className="h-9 shrink-0 rounded-full" onClick={extractFromSite} disabled={generating || advExtracting}>
                  {advExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Extrair do site"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                A extração usa a chave Firecrawl das Configurações. Esse contexto entra no roteiro do vídeo e nos textos — é o que evita conteúdo genérico.
              </p>
            </div>
            {formatChoice === "video" && !script && videoControls}
          </div>
        )}

        <details className="group card-premium p-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground">
            <Settings2 className="h-4 w-4" />
            Ajustes opcionais (formato, proporção, marca)
            <span className="ml-auto text-xs opacity-60 group-open:hidden">mostrar</span>
            <span className="ml-auto text-xs opacity-60 hidden group-open:inline">ocultar</span>
          </summary>
          <div className="mt-4 space-y-4">
        {/* Formato */}
        <div className="space-y-1.5">
          <p className="eyebrow">Formato</p>
          <div className="flex flex-wrap gap-1.5">
            {FORMAT_CHOICES.map((f) => (
              <button
                key={f.value}
                onClick={() => setFormatChoice(f.value)}
                disabled={generating}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  formatChoice === f.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {formatChoice === "carousel" && (
            <div className="flex items-center gap-2 pt-1">
              <label className="text-xs text-foreground">Nº de slides</label>
              <Input
                type="number" min={2} max={10} value={slideCount}
                onChange={(e) => setSlideCount(Math.min(Math.max(Number(e.target.value) || 6, 2), 10))}
                className="h-8 w-20" disabled={generating}
              />
            </div>
          )}
        </div>

        {/* Aspect ratio */}
        <div className="space-y-1.5">
          <p className="eyebrow">Proporção (aspect ratio)</p>
          <div className="flex flex-wrap gap-1.5">
            {ASPECT_CHOICES.map((a) => (
              <button
                key={a.value}
                onClick={() => setAspectChoice(a.value)}
                disabled={generating}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  aspectChoice === a.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Dica: se você escrever "1:1", "quadrado" ou "16:9" no pedido, a IA respeita o que você disse.</p>
        </div>

        {brand?.name && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3 text-sm">
            <Checkbox checked={useBrand} onCheckedChange={(v) => setUseBrand(v === true)} disabled={generating} className="mt-0.5" />
            <span>
              Usar a identidade da marca <span className="font-medium text-primary">{brand.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Enriquece o texto e o prompt das imagens (gpt-image-2) com a paleta, o tom e a voz da marca.
              </span>
            </span>
          </label>
        )}
          </div>
        </details>

        {script ? (
          <div className="space-y-3 rounded-2xl border border-primary/40 p-4">
            <p className="eyebrow flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Roteiro do vídeo — revise antes de gerar
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Narração (o que será falado, em pt-BR)</label>
              <Textarea value={script.narracao} onChange={(e) => setScript({ ...script, narracao: e.target.value })} rows={4} disabled={generating} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Cena (o que aparece no vídeo)</label>
              <Textarea value={script.cena} onChange={(e) => setScript({ ...script, cena: e.target.value })} rows={3} disabled={generating} />
            </div>
            {videoControls}
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={generateVideoFromScript} disabled={generating}>
                {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {progress || "Gerando…"}</> : <>Gerar vídeo ({advDuration}s)</>}
              </Button>
              <Button variant="outline" className="rounded-full" onClick={regenRoteiro} disabled={generating}>Refazer roteiro</Button>
              <Button variant="ghost" className="rounded-full" onClick={() => setScript(null)} disabled={generating}>Cancelar</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Mudou a duração? Use "Refazer roteiro" para a narração ser redimensionada ao novo tempo.</p>
          </div>
        ) : (
          <Button className="w-full rounded-full" size="lg" onClick={handleGenerate} disabled={generating || !prompt.trim()}>
            {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {progress || "Gerando…"}</> : <><Sparkles className="mr-2 h-4 w-4" /> Criar</>}
          </Button>
        )}
        {brand?.name
          ? <p className="text-center text-xs text-muted-foreground">{useBrand ? <>A IA usa a marca <span className="font-medium text-primary">{brand.name}</span> como base (paleta, tom, voz). Você poderá refinar no canvas depois.</> : "Marca desativada. Você poderá refinar no canvas depois."}</p>
          : <p className="text-center text-xs text-muted-foreground">Depois de gerar, você poderá refinar no canvas.</p>}
      </div>
    </div>
  );
}
