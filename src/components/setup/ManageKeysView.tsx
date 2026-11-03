import { useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, Trash2, Save, Eye, EyeOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { validatePfmKey, validateApifyToken, validateFirecrawlKey, validatePexelsKey } from "@/lib/api";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { useAuth } from "@/contexts/AuthContext";
import type { AppConfig } from "@/types";

type ManageKeyDef = {
  id: keyof AppConfig;
  label: string;
  description: string;
  placeholder: string;
  link?: string;
  linkLabel?: string;
  validate?: (value: string) => Promise<{ valid: boolean; error?: string }>;
};

const MANAGE_KEYS: ManageKeyDef[] = [
  {
    id: "postformeApiKey",
    label: "Post for Me",
    description: "Publicação multi-plataforma.",
    placeholder: "pfm_live_xxxxxxxxxxxxx",
    link: "https://app.postforme.dev/settings",
    linkLabel: "app.postforme.dev",
    validate: async (v) => validatePfmKey(v),
  },
  {
    id: "apifyApiToken",
    label: "Apify",
    description: "Analytics reais das redes.",
    placeholder: "apify_api_xxxxxxxxxxxxx",
    link: "https://console.apify.com/account/integrations",
    linkLabel: "console.apify.com",
    validate: async (v) => validateApifyToken(v),
  },
  {
    id: "firecrawlApiKey",
    label: "Firecrawl",
    description: "Pesquisa de conteúdo (Emily).",
    placeholder: "fc-xxxxxxxxxxxxx",
    link: "https://www.firecrawl.dev/app/api-keys",
    linkLabel: "firecrawl.dev",
    validate: async (v) => validateFirecrawlKey(v),
  },
  {
    id: "pexelsApiKey",
    label: "Pexels",
    description: "Banco de imagens (fotos de acervo).",
    placeholder: "Sua chave Pexels",
    link: "https://www.pexels.com/api/",
    linkLabel: "pexels.com/api",
    validate: async (v) => validatePexelsKey(v),
  },
];

function maskKey(value?: string) {
  if (!value) return "Não configurada";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export function ManageKeysView({
  currentConfig,
  onSave,
  onBack,
}: {
  currentConfig: AppConfig;
  onSave: (partial: Partial<AppConfig>) => Promise<void>;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const email = user?.email;
  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <AnimatedBackground />
      <div className="mx-auto max-w-3xl space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h2Sm md:text-h2">
              Configurações — <span className="text-gradient-bilhon">Chaves de API</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Atualize ou remova suas chaves a qualquer momento.
            </p>
            {email && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Conectado como <span className="font-medium text-foreground">{email}</span>
              </div>
            )}
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>

        <div className="grid gap-4">
          {MANAGE_KEYS.map((def) => (
            <ManageKeyCard
              key={def.id as string}
              def={def}
              currentValue={currentConfig[def.id] as string | undefined}
              onSave={onSave}
            />
          ))}

        </div>
      </div>
    </div>
  );
}

function ManageKeyCard({
  def,
  currentValue,
  onSave,
}: {
  def: ManageKeyDef;
  currentValue?: string;
  onSave: (partial: Partial<AppConfig>) => Promise<void>;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const isConfigured = !!currentValue;

  const handleSave = async () => {
    if (!value.trim()) return;
    setBusy(true);
    try {
      if (def.validate) {
        const r = await def.validate(value.trim());
        if (!r.valid) {
          toast({ title: "Chave inválida", description: r.error, variant: "destructive" });
          return;
        }
      }
      await onSave({ [def.id]: value.trim() } as Partial<AppConfig>);
      setValue("");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Remover a chave do ${def.label}? As funcionalidades dependentes deixarão de funcionar.`)) return;
    setBusy(true);
    try {
      await onSave({ [def.id]: undefined } as Partial<AppConfig>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="card-premium">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {def.label}
              {isConfigured ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-4">Conectado</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Não configurado</Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs mt-1">{def.description}</CardDescription>
          </div>
          <div className="text-right text-xs text-muted-foreground font-mono shrink-0">
            {maskKey(currentValue)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            placeholder={isConfigured ? "Cole uma nova chave para substituir" : def.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="font-mono text-sm pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          {def.link && (
            <a href={def.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
              Obter chave em {def.linkLabel} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <div className="flex gap-2 ml-auto">
            {isConfigured && (
              <Button variant="outline" size="sm" onClick={handleRemove} disabled={busy}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={busy || !value.trim()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Salvar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
