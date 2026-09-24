import { FormEvent, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Eye, EyeOff, LifeBuoy, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { normalizeSupportError, type SupportError } from "@/lib/error-handling";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [setupMode, setSetupMode] = useState<"invite" | "signup" | "recovery" | null>(null);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<SupportError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const passwordIsValid = newPassword.length >= 8 && newPassword === confirmPassword;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const flow = params.get("type") ?? hashParams.get("type");
    const hasRecoveryCode = params.has("code");
    const initialMode =
      flow === "invite" || flow === "signup" || flow === "recovery"
        ? flow
        : hasRecoveryCode
          ? "recovery"
          : null;

    setSetupMode(initialMode);

    let active = true;
    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY") {
        setSetupMode("recovery");
      }

      if (session?.user.email) {
        setEmail(session.user.email);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      if (data.session?.user.email) {
        setEmail(data.session.user.email);
      }

      // Never redirect a recovery/invite callback back to the dashboard.
      // Supabase can finish the callback asynchronously after getSession().
      if (data.session && !initialMode && !hasRecoveryCode) {
        void navigate({ to: "/", replace: true });
        return;
      }

      setChecking(false);
    }).catch((err) => {
      if (active) {
        setError(
          normalizeSupportError(
            err,
            "auth.session.check",
            "Não foi possível verificar sua sessão.",
          ),
        );
        setChecking(false);
      }
    });

    return () => {
      active = false;
      subscription.data.subscription.unsubscribe();
    };
  }, [navigate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password || loading || recovering) return;
    setLoading(true); setError(null); setNotice(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      await navigate({ to: "/", replace: true });
    } catch (err) {
      setError(normalizeSupportError(err, "auth.login", "Não foi possível entrar. Verifique suas credenciais e tente novamente."));
    } finally { setLoading(false); }
  };

  const setInitialPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordIsValid || loading) return;
    setLoading(true); setError(null); setNotice(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNotice("Senha definida com sucesso. Seu acesso está pronto.");
      setNewPassword(""); setConfirmPassword("");
      await navigate({ to: "/", replace: true });
    } catch (err) {
      setError(normalizeSupportError(err, "auth.password.set", "Não foi possível definir a senha. Tente novamente."));
    } finally { setLoading(false); }
  };

  const recoverPassword = async () => {
    if (!email.trim() || recovering || loading) return;
    setRecovering(true); setError(null); setNotice(null);
    try {
      const redirectTo = "https://suporttech.lovable.app/auth/confirm";
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (authError) throw authError;
      setNotice("Se existir uma conta para este e-mail, enviaremos as instruções para redefinir a senha.");
    } catch (err) {
      setError(normalizeSupportError(err, "auth.password.reset", "Não foi possível iniciar a recuperação da senha."));
    } finally { setRecovering(false); }
  };

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const isSetup = !!setupMode;
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8"><div className="w-full max-w-md">
    <div className="mb-6 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><LifeBuoy className="h-5 w-5" /></div><div><div className="text-lg font-bold tracking-tight">SuportTech</div><div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">IT Operations</div></div></div>
    <Card className="border-border/70 p-6 shadow-sm sm:p-8">
      <div className="mb-7"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><ShieldCheck className="h-4 w-4" />{isSetup ? "Ativação de acesso" : "Acesso seguro"}</div><h1 className="text-2xl font-bold tracking-tight">{setupMode ? "Defina sua senha" : "Entrar no SuportTech"}</h1><p className="mt-1 text-sm text-muted-foreground">{setupMode ? "Seu acesso foi validado. Crie uma nova senha para concluir ou recuperar seu acesso." : "Use suas credenciais para acessar a operação de suporte."}</p></div>
      {!supabaseConfigured && <div className="mb-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>O ambiente de preview ainda não recebeu as variáveis do Supabase.</span></div>}
      {error && <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><div className="flex gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0"><div>{error.userMessage}</div><div className="mt-2 text-[11px] text-destructive/80">Código: <strong>{error.code}</strong> · Referência: <strong>{error.reference}</strong></div><details className="mt-2 text-[11px]"><summary className="cursor-pointer font-medium">Detalhes para o suporte</summary><p className="mt-1 break-words">{error.supportMessage}</p></details></div></div></div>}
      {notice && <div className="mb-5 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Mail className="mt-0.5 h-4 w-4 shrink-0" /><span>{notice}</span></div>}
      {isSetup ? <form className="space-y-4" onSubmit={setInitialPassword}><div><label className="mb-1.5 block text-xs font-medium">E-mail</label><Input type="email" autoComplete="email" value={email} readOnly className="bg-muted/50" disabled={!supabaseConfigured || loading}/><p className="mt-1 text-[11px] text-muted-foreground">Este é o e-mail associado ao seu acesso.</p></div><div><label className="mb-1.5 block text-xs font-medium">Nova senha</label><div className="relative"><Input type={showPassword ? "text" : "password"} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" disabled={!supabaseConfigured || loading}/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label={showPassword?"Ocultar senhas":"Mostrar senhas"}>{showPassword?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></div><div><label className="mb-1.5 block text-xs font-medium">Confirmar senha</label><Input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repita a senha" disabled={!supabaseConfigured || loading}/>{confirmPassword && newPassword!==confirmPassword && <p className="mt-1 text-xs text-destructive">As senhas não coincidem.</p>}</div><Button className="w-full" type="submit" disabled={!supabaseConfigured || !passwordIsValid || loading}>{loading?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Salvando...</>:<>Criar minha senha <ArrowRight className="ml-2 h-4 w-4"/></>}</Button></form> : <><form className="space-y-4" onSubmit={submit}><div><label className="mb-1.5 block text-xs font-medium">E-mail</label><Input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@empresa.com" disabled={!supabaseConfigured || loading || recovering}/></div><div><label className="mb-1.5 block text-xs font-medium">Senha</label><div className="relative"><Input type={showPassword?"text":"password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" disabled={!supabaseConfigured || loading || recovering} className="pr-10"/><button type="button" onClick={()=>setShowPassword(v=>!v)} disabled={!supabaseConfigured || loading || recovering} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label={showPassword?"Ocultar senha":"Mostrar senha"}>{showPassword?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></div><Button className="w-full" type="submit" disabled={!supabaseConfigured || !email.trim() || !password || loading || recovering}>{loading?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Entrando...</>:<>Entrar <ArrowRight className="ml-2 h-4 w-4"/></>}</Button></form><div className="mt-4 border-t border-border/70 pt-4 text-center"><button type="button" onClick={()=>void recoverPassword()} disabled={!supabaseConfigured || !email.trim() || loading || recovering} className="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50">{recovering?"Enviando instruções...":"Esqueci minha senha"}</button><p className="mt-1 text-[11px] text-muted-foreground">Informe o e-mail acima para receber as instruções de recuperação.</p></div></>}
    </Card>
    <p className="mt-4 text-center text-[11px] text-muted-foreground">SuportTech · Ambiente de suporte e operações de TI</p>
  </div></main>;
}
