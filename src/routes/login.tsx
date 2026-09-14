import { FormEvent, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, LifeBuoy, Loader2, ShieldCheck } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<SupportError | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) void navigate({ to: "/", replace: true });
      if (active) setChecking(false);
    }).catch((err) => { if (active) { setError(normalizeSupportError(err, "auth.session.check", "Não foi possível verificar sua sessão.")); setChecking(false); } });
    return () => { active = false; };
  }, [navigate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password || loading) return;
    setLoading(true); setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      await navigate({ to: "/", replace: true });
    } catch (err) {
      setError(normalizeSupportError(err, "auth.login", "Não foi possível entrar. Verifique suas credenciais."));
    } finally { setLoading(false); }
  };

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8"><div className="w-full max-w-md">
    <div className="mb-6 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><LifeBuoy className="h-5 w-5" /></div><div><div className="text-lg font-bold tracking-tight">SUPPORTECH</div><div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">IT Operations</div></div></div>
    <Card className="border-border/70 p-6 shadow-sm sm:p-8"><div className="mb-7"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><ShieldCheck className="h-4 w-4" />Acesso seguro</div><h1 className="text-2xl font-bold tracking-tight">Entrar no Supportech</h1><p className="mt-1 text-sm text-muted-foreground">Use suas credenciais para acessar a operação de suporte.</p></div>
      {!supabaseConfigured && <div className="mb-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>O ambiente de preview ainda não recebeu as variáveis do Supabase. Configure <strong>VITE_SUPABASE_URL</strong> e <strong>VITE_SUPABASE_ANON_KEY</strong> para habilitar o login.</span></div>}
      {error && <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><div className="flex gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0"><div>{error.userMessage}</div><div className="mt-2 text-[11px] text-destructive/80">Código: <strong>{error.code}</strong> · Referência: <strong>{error.reference}</strong></div><details className="mt-2 text-[11px]"><summary className="cursor-pointer font-medium">Detalhes para o suporte</summary><p className="mt-1 break-words">{error.supportMessage}</p></details></div></div></div>}
      <form className="space-y-4" onSubmit={submit}><div><label className="mb-1.5 block text-xs font-medium">E-mail</label><Input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com" disabled={!supabaseConfigured || loading} /></div><div><label className="mb-1.5 block text-xs font-medium">Senha</label><Input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" disabled={!supabaseConfigured || loading} /></div><Button className="w-full" type="submit" disabled={!supabaseConfigured || !email.trim() || !password || loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</> : <>Entrar <ArrowRight className="ml-2 h-4 w-4" /></>}</Button></form>
    </Card>
    <p className="mt-4 text-center text-[11px] text-muted-foreground">Supportech · Ambiente de suporte e operações de TI</p>
  </div></main>;
}
