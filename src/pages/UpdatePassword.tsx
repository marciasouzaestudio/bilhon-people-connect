import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Loader2, AlertCircle, Lock, CheckCircle2 } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export default function UpdatePassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordValid = password.length >= 6;
  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid || !passwordsMatch) return;
    setLoading(true);
    setError("");

    const { error: err } = await updatePassword(password);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => navigate("/dashboard"), 2000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/90 via-primary/60 to-primary/30 text-white shadow-2xl shadow-primary/30">
            <Zap className="h-8 w-8" />
          </div>
        </div>

        <Card className="card-premium">
          {success ? (
            <CardContent className="flex flex-col items-center py-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-h2Sm">Senha atualizada!</h2>
              <p className="mt-2 text-sm text-muted-foreground">Redirecionando para o dashboard...</p>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-h2Sm md:text-h2">Nova <span className="text-gradient-bilhon">Senha</span></CardTitle>
                <CardDescription>Escolha uma nova senha para sua conta</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nova Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                        className="pl-10"
                        required
                      />
                    </div>
                    {password && !passwordValid && (
                      <p className="text-xs text-destructive">Mínimo 6 caracteres</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirmar Nova Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm"
                        type="password"
                        placeholder="Repita a nova senha"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                        className="pl-10"
                        required
                      />
                    </div>
                    {confirmPassword && !passwordsMatch && (
                      <p className="text-xs text-destructive">As senhas não coincidem</p>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-primary/90 via-primary/60 to-primary/30"
                    disabled={loading || !passwordValid || !passwordsMatch}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar Nova Senha
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
