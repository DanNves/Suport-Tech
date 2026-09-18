import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Pencil, Plus, ShieldCheck, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listAllDepartments, createDepartment, updateDepartment, getRoles, getMyProfile } from "@/lib/supabase/repositories";
import { toast } from "sonner";

export const Route = createFileRoute("/gestao")({ component: GestaoPage });

function GestaoPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "", isActive: true });

  const load = async () => {
    try {
      setLoading(true);
      const [d, r, p] = await Promise.all([listAllDepartments(), getRoles(), getMyProfile()]);
      setDepartments(d ?? []);
      setRoles(r ?? []);
      const role = p?.roles as any;
      const key = Array.isArray(role) ? role[0]?.key : role?.key;
      setCanManage(key === "admin");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível carregar a gestão.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "", description: "", isActive: true });
    setOpen(true);
  };

  const openEdit = (d: any) => {
    setEditing(d);
    setForm({ name: d.name ?? "", code: d.code ?? "", description: d.description ?? "", isActive: !!d.is_active });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Informe o nome e o código do setor.");
      return;
    }
    try {
      if (editing) await updateDepartment({ id: editing.id, ...form });
      else await createDepartment(form);
      toast.success(editing ? "Setor atualizado" : "Setor cadastrado");
      setOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o setor.");
    }
  };

  return (
    <AppShell title="Gestão" subtitle="Administre setores e visualize os perfis de acesso disponíveis no SuportTech.">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div><div><div className="text-xs text-muted-foreground">Setores</div><div className="text-2xl font-bold">{departments.length}</div></div></div></Card>
          <Card className="p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><div className="text-xs text-muted-foreground">Perfis ativos</div><div className="text-2xl font-bold">{roles.length}</div></div></div></Card>
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold">Setores</h2><p className="text-sm text-muted-foreground">Os setores podem ser vinculados a usuários, ativos e chamados.</p></div>{canManage && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo setor</Button>}</div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="p-3">Setor</th><th className="p-3">Código</th><th className="p-3">Descrição</th><th className="p-3">Status</th>{canManage && <th className="p-3 text-right">Ação</th>}</tr></thead>
            <tbody>{loading ? <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">Carregando setores...</td></tr> : departments.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">Nenhum setor cadastrado.</td></tr> : departments.map(d => <tr key={d.id} className="border-t hover:bg-muted/20"><td className="p-3 font-medium">{d.name}</td><td className="p-3 font-mono text-xs">{d.code}</td><td className="p-3 text-muted-foreground">{d.description ?? "—"}</td><td className="p-3"><span className={d.is_active ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"}>{d.is_active ? "Ativo" : "Inativo"}</span></td>{canManage && <td className="p-3 text-right"><Button variant="ghost" size="icon" onClick={() => openEdit(d)} aria-label="Editar setor"><Pencil className="h-4 w-4" /></Button></td>}</tr>)}</tbody>
          </table></div>
        </Card>

        <Card className="overflow-hidden"><div className="border-b p-4"><h2 className="font-semibold">Perfis de acesso</h2><p className="text-sm text-muted-foreground">Perfis ativos disponíveis para os usuários.</p></div><div className="divide-y">{roles.map(r => <div key={r.id} className="flex items-center justify-between p-4"><div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.description ?? "Perfil " + r.key}</div></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{r.key}</span></div>)}</div></Card>
      </div>

      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><Card className="w-full max-w-lg p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold">{editing ? "Editar setor" : "Novo setor"}</h2><p className="text-sm text-muted-foreground">Cadastre a área que será usada no atendimento.</p></div><Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X /></Button></div><div className="space-y-4"><div><Label>Nome *</Label><Input className="mt-1.5" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div><div><Label>Código *</Label><Input className="mt-1.5" maxLength={10} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div><div><Label>Descrição</Label><Input className="mt-1.5" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>{editing && <div><Label>Status</Label><select className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.isActive ? "ativo" : "inativo"} onChange={e => setForm({ ...form, isActive: e.target.value === "ativo" })}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></div>}</div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void save()}>{editing ? "Salvar alterações" : "Cadastrar setor"}</Button></div></Card></div>}
    </AppShell>
  );
}
