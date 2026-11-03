import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2, Plus, Star, Pencil, Trash2, ChevronDown, Palette,
  Sparkles, Globe, Upload, Loader2, Eye, Instagram, Linkedin,
  Twitter, Facebook, Youtube
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandImagePicker } from "@/components/brands/BrandImagePicker";
import { requireOrgId } from "@/lib/org";

interface BrandProfile {
  id: string;
  name: string;
  description: string;
  tone: string;
  target_audience: string;
  industry: string;
  keywords: string[];
  avoid_words: string[];
  example_posts: string[];
  system_prompt: string;
  logo_url: string;
  colors: string[];
  is_default: boolean;
  handle?: string;
  profile_photo_url?: string;
  website?: string;
  social_links?: Record<string, string>;
  values?: string;
}

const TONE_OPTIONS = [
  { value: "profissional", label: "Profissional" },
  { value: "casual", label: "Casual" },
  { value: "tecnico", label: "Técnico" },
  { value: "inspirador", label: "Inspirador" },
  { value: "humoristico", label: "Humorístico" },
  { value: "educativo", label: "Educativo" },
  { value: "autoritario", label: "Autoritário" },
  { value: "amigavel", label: "Amigável" },
];

const TONE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  TONE_OPTIONS.map((t) => [t.value, t.label])
);

const emptyForm = {
  name: "",
  description: "",
  tone: "",
  target_audience: "",
  industry: "",
  keywords: [] as string[],
  avoid_words: [] as string[],
  example_posts: [] as string[],
  system_prompt: "",
  logo_url: "",
  colors: ["#e85600", "#ff8f39", "#ffffff"] as string[],
  is_default: false,
  handle: "",
  profile_photo_url: "",
  website: "",
  social_links: { instagram: "", linkedin: "", twitter: "", facebook: "", youtube: "" } as Record<string, string>,
  values: "",
};

type FormState = typeof emptyForm;

export default function Brands() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<BrandProfile | null>(null);
  const [dialogTab, setDialogTab] = useState("basic");

  // Load from database
  const fetchProfiles = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar perfis");
      console.error(error);
    } else {
    setProfiles(
        (data || []).map((d: any) => ({
          ...d,
          keywords: d.keywords || [],
          avoid_words: d.avoid_words || [],
          example_posts: d.example_posts || [],
          colors: d.colors || [],
          system_prompt: d.system_prompt || "",
          handle: d.handle || "",
          profile_photo_url: d.profile_photo_url || "",
          website: d.website || "",
          social_links: d.social_links || {},
          values: d.values || "",
        }))
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogTab("basic");
    setDialogOpen(true);
  };

  const openEdit = (profile: BrandProfile) => {
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      description: profile.description || "",
      tone: profile.tone,
      target_audience: profile.target_audience || "",
      industry: profile.industry || "",
      keywords: profile.keywords || [],
      avoid_words: profile.avoid_words || [],
      example_posts: profile.example_posts || [],
      system_prompt: profile.system_prompt || "",
      logo_url: profile.logo_url || "",
      colors: profile.colors?.length ? profile.colors : ["#e85600", "#ff8f39", "#ffffff"],
      is_default: profile.is_default,
      handle: profile.handle || "",
      profile_photo_url: profile.profile_photo_url || "",
      website: profile.website || "",
      social_links: { instagram: "", linkedin: "", twitter: "", facebook: "", youtube: "", ...profile.social_links },
      values: profile.values || "",
    });
    setDialogTab("basic");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description,
      tone: form.tone || "profissional",
      target_audience: form.target_audience,
      industry: form.industry,
      keywords: form.keywords,
      avoid_words: form.avoid_words,
      example_posts: form.example_posts,
      system_prompt: form.system_prompt,
      logo_url: form.logo_url,
      colors: form.colors,
      is_default: form.is_default,
      handle: form.handle,
      profile_photo_url: form.profile_photo_url,
      website: form.website,
      social_links: form.social_links,
      values: form.values,
      user_id: user.id,
    };

    if (editingId) {
      const { error } = await supabase.from("brand_profiles").update(payload).eq("id", editingId);
      if (error) toast.error("Erro ao salvar");
      else toast.success("Perfil atualizado!");
    } else {
      // If first profile, set as default
      if (profiles.length === 0) payload.is_default = true;
      const { error } = await supabase.from("brand_profiles").insert({ ...payload, org_id: await requireOrgId() });
      if (error) toast.error("Erro ao criar perfil");
      else toast.success("Perfil criado!");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchProfiles();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir este perfil de marca? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("brand_profiles").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Perfil excluído");
      fetchProfiles();
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    // Unset all defaults, then set the chosen one
    await supabase.from("brand_profiles").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("brand_profiles").update({ is_default: true }).eq("id", id);
    fetchProfiles();
    toast.success("Perfil padrão atualizado");
  };

  // Logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    // RLS do bucket "media": a 1a pasta do caminho tem que ser o auth.uid().
    const path = `${user.id}/brands/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) {
      toast.error("Erro no upload");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
    setForm((f) => ({ ...f, logo_url: urlData.publicUrl }));
    setUploading(false);
    toast.success("Logo enviado!");
  };

  // AI suggestions
  const handleAISuggest = async () => {
    if (!form.name.trim()) {
      toast.error("Preencha pelo menos o nome da marca");
      return;
    }
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("social_brand-suggest", {
        body: { name: form.name, description: form.description, industry: form.industry },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setForm((f) => ({
        ...f,
        tone: data.tone || f.tone,
        target_audience: data.target_audience || f.target_audience,
        industry: data.industry || f.industry,
        keywords: data.keywords?.length ? data.keywords : f.keywords,
        avoid_words: data.avoid_words?.length ? data.avoid_words : f.avoid_words,
        description: f.description || data.description || "",
        values: data.values || f.values,
        system_prompt: data.system_prompt || f.system_prompt,
      }));
      toast.success("Sugestões da IA aplicadas!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar sugestões");
    }
    setSuggesting(false);
  };

  const updateColor = (index: number, value: string) => {
    setForm((prev) => {
      const colors = [...prev.colors];
      colors[index] = value;
      return { ...prev, colors };
    });
  };
  const addColor = () => {
    if (form.colors.length < 6) setForm((p) => ({ ...p, colors: [...p.colors, "#000000"] }));
  };
  const removeColor = (index: number) => {
    setForm((p) => ({ ...p, colors: p.colors.filter((_, i) => i !== index) }));
  };

  const updateSocialLink = (platform: string, value: string) => {
    setForm((f) => ({ ...f, social_links: { ...f.social_links, [platform]: value } }));
  };

  const socialIcons: Record<string, any> = {
    instagram: Instagram,
    linkedin: Linkedin,
    twitter: Twitter,
    facebook: Facebook,
    youtube: Youtube,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-h2Sm">
            <Building2 className="h-6 w-6 text-primary" />
            Perfis de <span className="text-gradient-bilhon">Empresa</span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Configure perfis para a IA gerar conteúdo com a identidade da sua marca
          </p>
        </div>
        <Button
          size="sm"
          className="bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30"
          onClick={openCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Perfil
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && profiles.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground max-w-md">
              Nenhum perfil cadastrado. Crie um perfil para a IA gerar conteúdo alinhado com sua marca.
            </p>
            <Button className="mt-6 bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Criar Primeiro Perfil
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Profile Cards */}
      {!loading && profiles.length > 0 && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id} className={`card-premium ${profile.is_default ? "border-primary/50 shadow-primary/10 shadow-md" : ""}`}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 shrink-0 overflow-hidden">
                    {profile.profile_photo_url ? (
                      <img src={profile.profile_photo_url} alt={profile.name} className="h-10 w-10 rounded-full object-cover" />
                    ) : profile.logo_url ? (
                      <img src={profile.logo_url} alt={profile.name} className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <Building2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold truncate">{profile.name}</h3>
                      {profile.is_default && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />}
                    </div>
                    {profile.handle && <p className="text-xs text-muted-foreground truncate">{profile.handle}</p>}
                    {!profile.handle && profile.industry && <p className="text-xs text-muted-foreground truncate">{profile.industry}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {profile.tone && (
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      {TONE_LABEL_MAP[profile.tone] || profile.tone}
                    </Badge>
                  )}
                  {profile.is_default && (
                    <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Padrão</Badge>
                  )}
                  {profile.website && (
                    <Badge variant="outline" className="text-xs">
                      <Globe className="h-3 w-3 mr-1" /> Site
                    </Badge>
                  )}
                </div>

                {profile.target_audience && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{profile.target_audience}</p>
                )}

                {profile.colors.length > 0 && (
                  <div className="flex gap-1.5">
                    {profile.colors.map((color, i) => (
                      <div key={i} className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                )}

                {/* Social icons */}
                {profile.social_links && Object.values(profile.social_links).some(Boolean) && (
                  <div className="flex gap-2">
                    {Object.entries(profile.social_links).map(([platform, url]) => {
                      if (!url) return null;
                      const Icon = socialIcons[platform];
                      return Icon ? <Icon key={platform} className="h-4 w-4 text-muted-foreground" /> : null;
                    })}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => { setPreviewProfile(profile); setPreviewOpen(true); }}>
                    <Eye className="mr-1.5 h-3 w-3" /> Preview
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => openEdit(profile)}>
                    <Pencil className="mr-1.5 h-3 w-3" /> Editar
                  </Button>
                  {!profile.is_default && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleSetDefault(profile.id)}>
                      <Star className="mr-1 h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(profile.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview da Marca</DialogTitle>
          </DialogHeader>
          {previewProfile && (
            <div className="space-y-4">
              {/* Brand header preview */}
              <div className="rounded-xl p-6 text-center" style={{
                background: `linear-gradient(135deg, ${previewProfile.colors[0] || '#e85600'}, ${previewProfile.colors[1] || '#ff8f39'})`,
              }}>
                <div className="flex items-center justify-center gap-3 mb-3">
                  {previewProfile.profile_photo_url ? (
                    <img src={previewProfile.profile_photo_url} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-white/30" />
                  ) : previewProfile.logo_url ? (
                    <img src={previewProfile.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover border-2 border-white/30" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center">
                      <Building2 className="h-7 w-7 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white">{previewProfile.name}</h3>
                {previewProfile.handle && <p className="text-white/80 text-sm mt-0.5">{previewProfile.handle}</p>}
                {previewProfile.industry && <p className="text-white/70 text-sm mt-1">{previewProfile.industry}</p>}
              </div>

              {previewProfile.description && (
                <p className="text-sm text-muted-foreground">{previewProfile.description}</p>
              )}
              {previewProfile.values && (
                <div>
                  <Label className="text-xs text-foreground/80">Missão & Valores</Label>
                  <p className="text-sm mt-1">{previewProfile.values}</p>
                </div>
              )}
              {previewProfile.target_audience && (
                <div>
                  <Label className="text-xs text-foreground/80">Público-alvo</Label>
                  <p className="text-sm mt-1">{previewProfile.target_audience}</p>
                </div>
              )}
              {previewProfile.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {previewProfile.keywords.map((k, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{k}</Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                {previewProfile.colors.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="h-8 w-8 rounded-lg border border-border" style={{ backgroundColor: c }} />
                    <span className="text-[10px] text-muted-foreground">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Perfil" : "Novo Perfil de Empresa"}</DialogTitle>
          </DialogHeader>

          {/* AI Suggest Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAISuggest}
            disabled={suggesting || !form.name.trim()}
            className="w-full border-dashed border-primary/50 text-primary hover:bg-primary/5"
          >
            {suggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {suggesting ? "Gerando sugestões..." : "Preencher com IA"}
          </Button>

          <Tabs value={dialogTab} onValueChange={setDialogTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="identity">Identidade</TabsTrigger>
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="advanced">Avançado</TabsTrigger>
            </TabsList>

            {/* Tab: Básico */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="brand-name">Nome da empresa *</Label>
                <Input id="brand-name" placeholder="Nome da empresa" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand-desc">Descrição</Label>
                <Textarea id="brand-desc" placeholder="Sobre a empresa..." value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tom de voz</Label>
                  <Select value={form.tone} onValueChange={(v) => setForm((f) => ({ ...f, tone: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-industry">Setor</Label>
                  <Input id="brand-industry" placeholder="Ex: Marketing Digital" value={form.industry}
                    onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand-audience">Público-alvo</Label>
                <Input id="brand-audience" placeholder="Ex: Empreendedores de 25-45 anos" value={form.target_audience}
                  onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand-values">Missão & Valores</Label>
                <Textarea id="brand-values" placeholder="O que a empresa acredita e defende..." value={form.values}
                  onChange={(e) => setForm((f) => ({ ...f, values: e.target.value }))} rows={2} />
              </div>
            </TabsContent>

            {/* Tab: Identidade Visual */}
            <TabsContent value="identity" className="space-y-4 mt-4">
              {/* Handle */}
              <div className="space-y-2">
                <Label htmlFor="brand-handle">Handle (@arroba)</Label>
                <Input id="brand-handle" placeholder="@suamarca" value={form.handle}
                  onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Usado automaticamente nos carrosséis e publicações.</p>
              </div>

              {/* Profile Photo */}
              <div className="space-y-2">
                <Label>Foto de perfil</Label>
                <div className="flex items-center gap-4">
                  {form.profile_photo_url ? (
                    <img src={form.profile_photo_url} alt="Perfil" className="h-14 w-14 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                      <Eye className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user) return;
                        setUploading(true);
                        const ext = file.name.split(".").pop();
                        const path = `${user.id}/brands/pfp_${crypto.randomUUID()}.${ext}`;
                        const { error } = await supabase.storage.from("media").upload(path, file);
                        if (error) { toast.error("Erro no upload"); setUploading(false); return; }
                        const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
                        setForm((f) => ({ ...f, profile_photo_url: urlData.publicUrl }));
                        setUploading(false);
                        toast.success("Foto enviada!");
                      }} />
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-accent text-sm">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? "Enviando..." : "Upload"}
                      </div>
                    </label>
                    <BrandImagePicker
                      defaultQuery={form.industry || form.name || "retrato profissional"}
                      suggestions={[form.industry, "retrato", "equipe", "negócios", "criativo"].filter(Boolean) as string[]}
                      orientation="squarish"
                      onPick={(url) => setForm((f) => ({ ...f, profile_photo_url: url }))}
                    />
                    {form.profile_photo_url && (
                      <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setForm((f) => ({ ...f, profile_photo_url: "" }))}>
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Logo */}
              <div className="space-y-2">
                <Label>Logo da marca</Label>
                <div className="flex items-center gap-4">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="h-16 w-16 rounded-xl object-cover border border-border" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-accent text-sm">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? "Enviando..." : "Upload"}
                      </div>
                    </label>
                    <BrandImagePicker
                      defaultQuery={form.industry || form.name || "logotipo minimalista"}
                      suggestions={[form.industry, "ícone", "símbolo", "abstrato", "minimalista"].filter(Boolean) as string[]}
                      orientation="squarish"
                      label="Banco de imagens"
                      onPick={(url) => setForm((f) => ({ ...f, logo_url: url }))}
                    />
                    {form.logo_url && (
                      <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}>
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Palette className="h-4 w-4" /> Cores da marca (até 6)
                </Label>
                <div className="flex flex-wrap items-center gap-3">
                  {form.colors.map((color, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <input type="color" value={color} onChange={(e) => updateColor(i, e.target.value)}
                        className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5" />
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">{color}</span>
                        <button type="button" onClick={() => removeColor(i)} className="text-xs text-muted-foreground hover:text-destructive">&times;</button>
                      </div>
                    </div>
                  ))}
                  {form.colors.length < 6 && (
                    <Button type="button" variant="outline" size="sm" onClick={addColor}>
                      <Plus className="mr-1 h-3 w-3" /> Cor
                    </Button>
                  )}
                </div>
              </div>

              {/* Website */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> Website
                </Label>
                <Input placeholder="https://seusite.com.br" value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
              </div>

              {/* Social Links */}
              <div className="space-y-2">
                <Label>Redes Sociais</Label>
                <div className="space-y-2">
                  {Object.entries(socialIcons).map(([platform, Icon]) => (
                    <div key={platform} className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input placeholder={`@${platform} ou URL`} value={form.social_links[platform] || ""}
                        onChange={(e) => updateSocialLink(platform, e.target.value)} className="h-9" />
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Conteúdo */}
            <TabsContent value="content" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Palavras-chave da marca</Label>
                <Input placeholder="Separadas por vírgula" value={form.keywords.join(", ")}
                  onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))} />
                {form.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {form.keywords.map((k, i) => <Badge key={i} variant="secondary" className="text-xs">{k}</Badge>)}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Palavras a evitar</Label>
                <Input placeholder="Separadas por vírgula" value={form.avoid_words.join(", ")}
                  onChange={(e) => setForm((f) => ({ ...f, avoid_words: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))} />
                {form.avoid_words.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {form.avoid_words.map((w, i) => <Badge key={i} variant="destructive" className="text-xs">{w}</Badge>)}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Exemplos de posts</Label>
                <Textarea placeholder="Cole 2-3 posts que representam sua marca, um por linha"
                  value={form.example_posts.join("\n")}
                  onChange={(e) => setForm((f) => ({ ...f, example_posts: e.target.value.split("\n").filter(Boolean) }))}
                  rows={4} />
              </div>
            </TabsContent>

            {/* Tab: Avançado */}
            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Prompt personalizado para IA</Label>
                <Textarea placeholder="Instruções avançadas para a IA quando gerar conteúdo desta marca..."
                  value={form.system_prompt}
                  onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
                  rows={6} />
                <p className="text-xs text-muted-foreground">
                  Este prompt será enviado junto com cada geração de conteúdo para personalizar o comportamento da IA.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30" onClick={handleSave}
              disabled={!form.name.trim() || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingId ? "Salvar Alterações" : "Criar Perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
