import { FormEvent, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import { normalizeSupportError, type SupportError } from "@/lib/error-handling";

export const Route = createFileRoute("/alterar-senha")({
  component: AlterarSenhaPage,
});

function AlterarSenhaPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<SupportError | null>(null);

  const passwordIsValid =
    newPassword.length >= 8 && newPassword === confirmPassword;

  useEffect(() => {
    let active = true;

    const prepare = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!data.session?.user) {
          throw new Error(
            "Sua sessão de acesso não está mais disponível. Solicite um novo link.",
          );
        }

        if (!active) return;
        setEmail(data.session.user.email ?? "");

        const stored = window.sessionStorage.getItem("supporttech-auth-flow");
        if (stored) window.sessionStorage.removeItem("supporttech-auth-flow");
      } catch (err) {
        if (!active) return;
        setError(
          normalizeSupportError(
            err,
            "auth.password.session",
            "Não foi possível abrir a tela de criação de senha.",
          ),
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void prepare();

    return () => {
      active = false;
    };
  }, []);

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordIsValid || saving) return;

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      window.sessionStorage.removeItem("supporttech-auth-flow");
      setNewPassword("");
      setConfirmPassword("");
      await navigate({ to: "/", replace: true });
    } catch (err) {
      setError(
        normalizeSupportError(
          err,
          "auth.password.update",
          "Não foi possível criar sua senha. Tente novamente ou solicite um novo link.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">SuportTech</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              IT Operations
            </div>
          </div>
        </div>

        <Card className="border-border/70 p-6 shadow-sm sm:p-8">
          <div className="mb-7">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
              <ShieldCheck className="h-4 w-4" />
              Ativação de acesso
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Crie sua senha
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Seu acesso foi validado. Defina uma nova senha para entrar no
              SuportTech.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error.userMessage}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <form className="space-y-4" onSubmit={savePassword}>
              <div>
                <label className="mb-1.5 block text-xs font-medium">
                  E-mail
                </label>
                <Input
                  type="email"
                  value={email}
                  readOnly
                  className="bg-muted/50"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  E-mail associado ao acesso.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium">
                  Nova senha
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium">
                  Confirmar senha
                </label>
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Digite novamente a senha"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-xs text-destructive">
                    As senhas não coincidem.
                  </p>
                )}
              </div>

              <Button
                className="w-full"
                type="submit"
                disabled={!passwordIsValid || saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    Criar minha senha
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
