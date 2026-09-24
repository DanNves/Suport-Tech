import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { EmailOtpType } from "@supabase/supabase-js";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { normalizeSupportError, type SupportError } from "@/lib/error-handling";

export const Route = createFileRoute("/auth/confirm")({
  component: AuthConfirmPage,
});

function AuthConfirmPage() {
  const [error, setError] = useState<SupportError | null>(null);
  const [status, setStatus] = useState("Validando seu acesso...");

  useEffect(() => {
    let active = true;

    const finish = async () => {
      if (!supabaseConfigured) {
        setError(
          normalizeSupportError(
            new Error("Supabase não configurado."),
            "auth.callback.config",
            "O ambiente de autenticação não está configurado.",
          ),
        );
        return;
      }

      try {
        const url = new URL(window.location.href);
        const query = url.searchParams;
        const tokenHash = query.get("token_hash");
        const rawType = query.get("type");
        const code = query.get("code");
        const flow: EmailOtpType =
          rawType === "invite" ||
          rawType === "signup" ||
          rawType === "recovery" ||
          rawType === "email"
            ? rawType
            : "recovery";

        if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: flow,
          });

          if (verifyError) throw verifyError;
        } else if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) throw exchangeError;
        } else {
          // Backwards compatibility: Supabase may already have consumed an
          // implicit-flow URL and created the session from the URL hash.
          await supabase.auth.getSession();
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.user) {
          throw new Error(
            "O link foi processado, mas a sessão de acesso não foi criada.",
          );
        }

        if (!active) return;

        const email = sessionData.session.user.email ?? "";
        const nextType =
          flow === "invite" || flow === "signup" ? "invite" : "recovery";

        setStatus("Acesso validado. Abrindo a tela para criar sua senha...");
        window.history.replaceState({}, document.title, "/auth/confirm");
        window.sessionStorage.setItem(
          "supporttech-auth-flow",
          JSON.stringify({ type: nextType, email }),
        );
        window.location.replace("/alterar-senha");
      } catch (err) {
        if (!active) return;
        setError(
          normalizeSupportError(
            err,
            "auth.callback.verify",
            "Não foi possível validar este link de acesso. Solicite um novo link e tente novamente.",
          ),
        );
      }
    };

    void finish();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <Card className="border-border/70 p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">SuportTech</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                IT Operations
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <h1 className="font-semibold text-destructive">
                    Não foi possível validar o acesso
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {error.userMessage}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                {status.startsWith("Acesso validado") ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                <p className="text-sm font-medium">{status}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
