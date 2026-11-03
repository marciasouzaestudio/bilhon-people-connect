import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert } from "lucide-react";
import { requireOrgId } from "@/lib/org";

export default function Admin() {
  const { toast } = useToast();
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("id, registration_enabled")
        .limit(1)
        .maybeSingle();
      // Sem row → registro habilitado por padrão
      if (data) {
        setSettingsId(data.id);
        setRegistrationEnabled(data.registration_enabled);
      } else {
        setRegistrationEnabled(true);
      }
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (checked: boolean) => {
    setUpdating(true);
    let error: { message: string } | null = null;

    if (settingsId) {
      const result = await supabase
        .from("system_settings")
        .update({ registration_enabled: checked })
        .eq("id", settingsId);
      error = result.error;
    } else {
      const result = await supabase
        .from("system_settings")
        .insert({ registration_enabled: checked, org_id: await requireOrgId() } as any)
        .select("id")
        .maybeSingle();
      error = result.error;
      if (!error && result.data) setSettingsId(result.data.id);
    }

    if (error) {
      toast({ title: "Erro ao atualizar configuração", description: error.message, variant: "destructive" });
    } else {
      setRegistrationEnabled(checked);
      toast({ title: checked ? "Registro habilitado" : "Registro desabilitado" });
    }
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-primary" />
        <h1 className="text-h2Sm md:text-h2"><span className="text-gradient-bilhon">Administração</span></h1>
      </div>

      <div className="card-premium p-6">
        <h2 className="text-lg font-semibold mb-4">Configurações do Sistema</h2>
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-1">
            <Label className="font-medium">Permitir novos registros</Label>
            <p className="text-sm text-muted-foreground">
              Quando desativado, a criação de novas contas é bloqueada e o link "Criar conta" é ocultado na tela de login.
            </p>
          </div>
          <Switch checked={registrationEnabled} onCheckedChange={handleToggle} disabled={updating} />
        </div>
      </div>
    </div>
  );
}