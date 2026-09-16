import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/perfil")({ component: ProfilePage });

type Department = { id: string; name: string; code: string };
type Profile = { id: string; full_name: string; email: string | null; phone: string | null; job_title: string | null; department_id: string | null };

function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão não encontrada.");
      const [{ data: row, error: profileError }, { data: deps, error: departmentError }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,phone,job_title,department_id").eq("id", auth.user.id).single(),
        supabase.from("departments").select("id,name,code").eq("is_active", true).order("name"),
      ]);
      if (profileError) throw profileError;
      if (departmentError) throw departmentError;
      const next = row as Profile;
      setProfile(next); setFullName(next.full_name ?? ""); setPhone(next.phone ?? ""); setJobTitle(next.job_title ?? ""); setDepartmentId(next.department_id ?? ""); setDepartments((deps ?? []) as Department[]);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar seu perfil."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!profile || fullName.trim().length < 2 || saving) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const { error: updateError } = await supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone.trim() || null, job_title: jobTitle.trim() || null, department_id: departmentId || null }).eq("id", profile.id);
      if (updateError) throw updateError;
      setMessage("Perfil atualizado com sucesso.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar seu perfil."); }
    finally { setSaving(false); }
  };

  return <AppShell title="Meu perfil" subtitle="Atualize seus dados e informe o setor ao qual você pertence.">
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="border-border/70 p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><UserRound className="h-5 w-5" /></div><div><h2 className="text-base font-semibold">Dados do usuário</h2><p className="mt-1 text-sm text-muted-foreground">O setor informado aqui será usado para identificar sua área nos chamados e na administração do SuportTech.</p></div></div>
        {loading ? <div className="flex items-center justify-center py-12 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando perfil...</div> : <div className="mt-6 space-y-4">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          {message && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />{message}</div>}
          <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-medium">Nome completo</label><Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome" /></div><div><label className="mb-1.5 block text-xs font-medium">E-mail</label><Input value={profile?.email ?? ""} disabled /></div><div><label className="mb-1.5 block text-xs font-medium">Telefone</label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" /></div><div><label className="mb-1.5 block text-xs font-medium">Cargo</label><Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Ex.: Analista" /></div></div>
          <div><label className="mb-1.5 block text-xs font-medium">Setor</label><select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione seu setor</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}</select><p className="mt-1.5 text-[11px] text-muted-foreground">Os setores disponíveis são administrados pelo responsável do sistema.</p></div>
          <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving || fullName.trim().length < 2}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar alterações"}</Button></div>
        </div>}
      </Card>
    </div>
  </AppShell>;
}
