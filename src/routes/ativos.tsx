import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAssets, createAsset, updateAsset, deleteAsset, getActiveDepartments, listProfiles, getMyProfile } from "@/lib/supabase/repositories";
import { toast } from "sonner";

export const Route = createFileRoute("/ativos")({ component: AtivosPage });

type Asset = any;
type Form = {
  name: string;
  assetType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  departmentId: string;
  assignedUserId: string;
  status: "ativo" | "em_manutencao" | "inativo" | "baixado";
  location: string;
  notes: string;
  warrantyUntil: string;
};

const empty: Form = {
  name: "",
  assetType: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  departmentId: "",
  assignedUserId: "",
  status: "ativo",
  location: "",
  notes: "",
  warrantyUntil: "",
};

const statusLabel: Record<string, string> = {
  ativo: "Ativo",
  em_manutencao: "Em manutenção",
  inativo: "Inativo",
  baixado: "Baixado",
};

const statusTone: Record<string, string> = {
  ativo: "bg-emerald-50 text-emerald-700",
  em_manutencao: "bg-amber-50 text-amber-700",
  inativo: "bg-slate-100 text-slate-600",
  baixado: "bg-red-50 text-red-700",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR").format(date);
}

function warrantyInfo(value?: string | null) {
  if (!value) return { label: "Não informada", tone: "bg-slate-100 text-slate-600" };
  const today = new Date().toISOString().slice(0, 10);
  if (value >= today) return { label: "Em garantia", tone: "bg-emerald-50 text-emerald-700" };
  return { label: "Garantia vencida", tone: "bg-red-50 text-red-700" };
}

function AtivosPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const [a, d, u, p] = await Promise.all([listAssets(), getActiveDepartments(), listProfiles(), getMyProfile()]);
      setAssets(a ?? []);
      setDepartments(d ?? []);
      setUsers(u ?? []);
      const roles = p?.roles as any;
      const key = Array.isArray(roles) ? roles[0]?.key : roles?.key;
      setCanManage(["admin", "manager"].includes(key));
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível carregar os ativos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      assets.filter((a) =>
        `${a.asset_tag} ${a.name} ${a.asset_type} ${a.manufacturer ?? ""} ${a.model ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [assets, query],
  );

  const edit = (a: Asset) => {
    setEditing(a);
    setForm({
      name: a.name,
      assetType: a.asset_type,
      manufacturer: a.manufacturer ?? "",
      model: a.model ?? "",
      serialNumber: a.serial_number ?? "",
      departmentId: a.department_id ?? "",
      assignedUserId: a.assigned_user_id ?? "",
      status: a.status,
      location: a.location ?? "",
      notes: a.notes ?? "",
      warrantyUntil: a.warranty_until ?? "",
    });
    setOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.assetType.trim()) {
      toast.error("Preencha nome e tipo do ativo.");
      return;
    }

    try {
      if (editing) {
        await updateAsset({ id: editing.id, ...form });
      } else {
        await createAsset(form);
      }
      toast.success(editing ? "Ativo atualizado" : "Ativo cadastrado");
      setOpen(false);
      setEditing(null);
      setForm(empty);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o ativo.");
    }
  };

  const remove = async (a: Asset) => {
    if (!window.confirm(`Excluir o ativo ${a.asset_tag}?`)) return;
    try {
      await deleteAsset(a.id);
      toast.success("Ativo excluído");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível excluir o ativo.");
    }
  };

  const guaranteeCount = assets.filter((a) => warrantyInfo(a.warranty_until).label === "Em garantia").length;

  return (
    <AppShell title="Ativos" subtitle="Inventário e ciclo de vida dos equipamentos de TI.">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="mt-1 text-2xl font-bold">{assets.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Ativos</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">{assets.filter((a) => a.status === "ativo").length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Em garantia</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">{guaranteeCount}</div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por patrimônio, nome, tipo ou modelo..." className="pl-9" />
            </div>
            {canManage && (
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Novo ativo
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Patrimônio</th>
                  <th className="p-3">Ativo</th>
                  <th className="p-3">Setor</th>
                  <th className="p-3">Responsável</th>
                  <th className="p-3">Data de registro</th>
                  <th className="p-3">Garantia</th>
                  <th className="p-3">Status</th>
                  {canManage && <th className="p-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={canManage ? 8 : 7} className="p-10 text-center text-muted-foreground">Carregando ativos...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 8 : 7} className="p-10 text-center text-muted-foreground">Nenhum ativo encontrado.</td>
                  </tr>
                ) : (
                  filtered.map((a) => {
                    const warranty = warrantyInfo(a.warranty_until);
                    return (
                      <tr key={a.id} className="border-t hover:bg-muted/20">
                        <td className="p-3 font-semibold">{a.asset_tag}</td>
                        <td className="p-3">
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.asset_type}
                            {a.manufacturer ? ` · ${a.manufacturer}` : ""}
                            {a.model ? ` ${a.model}` : ""}
                          </div>
                        </td>
                        <td className="p-3">{a.departments?.name ?? "—"}</td>
                        <td className="p-3">{a.profiles?.full_name ?? "Não atribuído"}</td>
                        <td className="p-3 whitespace-nowrap">{formatDate(a.created_at)}</td>
                        <td className="p-3">
                          <span className={`inline-flex flex-col rounded-md px-2.5 py-1 text-xs font-medium ${warranty.tone}`}>
                            <span>{warranty.label}</span>
                            {a.warranty_until && <span className="font-normal opacity-80">até {formatDate(a.warranty_until)}</span>}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone[a.status]}`}>
                            {statusLabel[a.status]}
                          </span>
                        </td>
                        {canManage && (
                          <td className="p-3 text-right">
                            <Button variant="ghost" size="icon" onClick={() => edit(a)} aria-label="Editar ativo">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => void remove(a)} aria-label="Excluir ativo" className="text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{editing ? "Editar ativo" : "Novo ativo"}</h2>
                <p className="text-sm text-muted-foreground">Cadastre o equipamento e seu vínculo operacional.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X />
              </Button>
            </div>

            {!editing ? (
              <div className="mb-5 rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="font-medium">Cadastro automático</div>
                <div className="mt-1 text-muted-foreground">
                  O patrimônio será gerado automaticamente pelo sistema e a data de registro será definida no momento do cadastro.
                </div>
              </div>
            ) : (
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Patrimônio</div>
                  <div className="mt-1 font-semibold">{editing.asset_tag}</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Data de registro</div>
                  <div className="mt-1 font-semibold">{formatDate(editing.created_at)}</div>
                </div>
              </div>
            )}

            {!editing && (
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Patrimônio</div>
                  <div className="mt-1 font-medium">Gerado automaticamente</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Data de registro</div>
                  <div className="mt-1 font-medium">Automática no cadastro</div>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ["name", "Nome *"],
                ["assetType", "Tipo *"],
                ["manufacturer", "Fabricante"],
                ["model", "Modelo"],
                ["serialNumber", "Número de série"],
                ["location", "Localização"],
              ] as [keyof Form, string][]).map(([k, l]) => (
                <div key={k} className="space-y-1.5">
                  <Label>{l}</Label>
                  <Input value={form[k] as string} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </div>
              ))}

              <div className="space-y-1.5">
                <Label>Data de garantia</Label>
                <Input type="date" value={form.warrantyUntil} onChange={(e) => setForm({ ...form, warrantyUntil: e.target.value })} />
                <p className="text-xs text-muted-foreground">Informe a data final da cobertura da garantia.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Select value={form.departmentId || ""} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select value={form.assignedUserId || ""} onValueChange={(v) => setForm({ ...form, assignedUserId: v })}>
                  <SelectTrigger><SelectValue placeholder="Não atribuído" /></SelectTrigger>
                  <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Form["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <textarea className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => void save()}>{editing ? "Salvar alterações" : "Cadastrar ativo"}</Button>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
