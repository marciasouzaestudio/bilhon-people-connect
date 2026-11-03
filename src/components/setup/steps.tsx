import { Link2, Image, BarChart3, Palette, Film, Search } from "lucide-react";

export interface StepConfig {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  required: boolean;
}

export const STEPS: StepConfig[] = [
  { id: 1, title: "Post for Me",   subtitle: "Publicação multi-plataforma", icon: <Link2 className="h-5 w-5" />,     required: true  },
  { id: 2, title: "Gemini Omni",  subtitle: "Geração de vídeo IA",         icon: <Film className="h-5 w-5" />,      required: false },
  { id: 3, title: "Analytics",     subtitle: "Métricas reais",              icon: <BarChart3 className="h-5 w-5" />, required: false },
  { id: 4, title: "Firecrawl",    subtitle: "Pesquisa e extração de conteúdo", icon: <Search className="h-5 w-5" />, required: false },
  { id: 5, title: "Pexels",       subtitle: "Banco de imagens",             icon: <Image className="h-5 w-5" />,     required: false },
  { id: 6, title: "Marca",         subtitle: "Identidade visual",           icon: <Palette className="h-5 w-5" />,   required: false },
  { id: 7, title: "Redes Sociais", subtitle: "Conectar contas",             icon: <Link2 className="h-5 w-5" />,     required: true  },
];
