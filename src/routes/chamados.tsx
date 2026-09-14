import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Filter, Inbox, Plus, RefreshCw, Search, Ticket, Timer, X } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createTicket, getActiveCategories, getActiveServices, listMyTickets, transitionTicket } from "@/lib/supabase/repositories";

export const Route = createFileRoute("/chamados")({ component: ChamadosPage });

type TicketStatus = "novo" | "em_atendimento" | "resolvido" | "fechado";
type TicketItem = { id: string; ticket_number: number | string; subject: string; description?: string; status: TicketStatus; priority: string; created_at?: string; sla_resolution_at?: string | null };
type CatalogItem = { id: string; name: string };

const statusLabel: Record<TicketStatus, string> = { novo: "Novo", em_atendimento: "Em atendimento", resolvido: "Resolvido", fechado: "Fechado" };
const priorityLabel: Record<string, string> = { critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa" };

function ChamadosPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [ticketPriority, setTicketPriority] = useState<"baixa" | "media" | "alta" | "critica">("media");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | TicketStatus>("todos");
  const [priority, setPriority] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setTickets((await listMyTickets()) as TicketItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os chamados.");
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogs = async () => {
    setCatalogLoading(true);
    try {
      const [categoryData, serviceData] = await Promise.all([getActiveCategories(), getActiveServices()]);
      setCategories((categoryData ?? []) as CatalogItem[]);
      setServices((serviceData ?? []) as CatalogItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar categorias e serviços.");
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void loadCatalogs();
  }, []);

  const filtered = useMemo(() => tickets.filter((t) => {
    const text = `${t.ticket_number} ${t.subject}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (status === "todos" || t.status === status) && (priority === "todos" || t.priority === priority);
  }), [tickets, query, status, priority]);

  const resetForm = () => {
    setSubject("");
    setDescription("");
    setCategoryId("");
    setServiceId("");
    setTicketPriority("media");
  };

  const openCreateModal = () => {
    setError(null);
    setOpen(true);
    if (!categories.length && !services.length) void loadCatalogs();
  };

  const closeCreateModal = () => {
    if (saving) return;
    setOpen(false);
    resetForm();
  };

  const create = async () => {
    if (!subject.trim() || !description.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createTicket({
        subject: subject.trim(),
        description: description.trim(),
        categoryId: categoryId || undefined,
        serviceId: serviceId || undefined,
        priority: ticketPriority,
      });
      closeCreateModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o chamado.");
    } finally {
      setSaving(false);
    }
  };

  const transition = async (id: string, next: "em_atendimento" | "resolvido" | "fechado") => {
    try {
      setError(null);
      await transitionTicket(id, next);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o chamado.");
    }
  };

  const metrics = {
    total: tickets.length,
    open: tickets.filter(t => ["novo", "em_atendimento"].includes(t.status)).length,
    progress: tickets.filter(t => t.status === "em_atendimento").length,
    resolved: tickets.filter(t => ["resolvido", "fechado"].includes(t.status)).length,
  };

  return <AppShell title="Chamados" subtitle="Gerencie solicitações, prioridades e atendimentos de suporte.">
    <div className="space-y-6">
      <Card className="border-0 bg-primary p-5 text-primary-foreground shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 sm:flex"><Ticket className="h-5 w-5" /></div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-foreground/65">Central de suporte</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Fila de atendimento</h2>
              <p className="mt-1 max-w-2xl text-sm text-primary-foreground/70">Gerencie solicitações, acompanhe prioridades e mantenha os prazos de SLA sob controle.</p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
            <Button onClick={openCreateModal} className="bg-white text-primary shadow-none hover:bg-white/90"><Plus className="mr-2 h-4 w-4" />Novo chamado</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <QueueMetric label="Todos" value={loading ? "—" : metrics.total} icon={Inbox} active={status === "todos"} onClick={() => setStatus("todos")} />
        <QueueMetric label="Em aberto" value={loading ? "—" : metrics.open} icon={Timer} active={status === "novo"} onClick={() => setStatus("novo")} />
        <QueueMetric label="Em atendimento" value={loading ? "—" : metrics.progress} icon={Clock3} active={status === "em_atendimento"} onClick={() => setStatus("em_atendimento")} />
        <QueueMetric label="Resolvidos" value={loading ? "—" : metrics.resolved} icon={CheckCircle2} active={status === "resolvido"} onClick={() => setStatus("resolvido")} />
      </div>

      {error && <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div className="flex-1"><div className="font-medium">Não foi possível concluir a operação</div><div className="mt-0.5 text-destructive/80">{error}</div></div></Card>}

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <div className="border-b border-border/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Chamados registrados</div><h2 className="mt-1 text-base font-semibold">Chamados recentes</h2></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por número ou assunto" className="h-9 w-full pl-9 sm:w-60" /></div>
              <select value={status} onChange={e => setStatus(e.target.value as "todos" | TicketStatus)} className="h-9 rounded-md border border-input bg-background px-3 text-xs"><option value="todos">Todos os status</option><option value="novo">Novo</option><option value="em_atendimento">Em atendimento</option><option value="resolvido">Resolvido</option><option value="fechado">Fechado</option></select>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-xs"><option value="todos">Todas prioridades</option><option value="critica">Crítica</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select>
            </div>
          </div>
        </div>
        {loading ? <div className="p-12 text-center text-sm text-muted-foreground">Carregando fila de atendimento...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-12 text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted"><Filter className="h-5 w-5 text-muted-foreground" /></div><div className="font-medium">Nenhum chamado encontrado</div><p className="mt-1 max-w-sm text-xs text-muted-foreground">Ajuste os filtros ou abra um novo chamado para começar.</p></div> : <div className="divide-y divide-border/70">{filtered.map(t => <TicketRow key={t.id} ticket={t} onTransition={transition} />)}</div>}
      </Card>

      {open && <CreateTicketModal
        subject={subject}
        description={description}
        categoryId={categoryId}
        serviceId={serviceId}
        ticketPriority={ticketPriority}
        categories={categories}
        services={services}
        catalogLoading={catalogLoading}
        saving={saving}
        onSubjectChange={setSubject}
        onDescriptionChange={setDescription}
        onCategoryChange={setCategoryId}
        onServiceChange={setServiceId}
        onPriorityChange={setTicketPriority}
        onClose={closeCreateModal}
        onCreate={() => void create()}
      />}
    </div>
  </AppShell>;
}

function CreateTicketModal({ subject, description, categoryId, serviceId, ticketPriority, categories, services, catalogLoading, saving, onSubjectChange, onDescriptionChange, onCategoryChange, onServiceChange, onPriorityChange, onClose, onCreate }: {
  subject: string; description: string; categoryId: string; serviceId: string; ticketPriority: "baixa" | "media" | "alta" | "critica"; categories: CatalogItem[]; services: CatalogItem[]; catalogLoading: boolean; saving: boolean;
  onSubjectChange: (value: string) => void; onDescriptionChange: (value: string) => void; onCategoryChange: (value: string) => void; onServiceChange: (value: string) => void; onPriorityChange: (value: "baixa" | "media" | "alta" | "critica") => void; onClose: () => void; onCreate: () => void;
}) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="novo-chamado-title">
    <div className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-150">
      <Card className="overflow-hidden border-border/80 bg-background shadow-2xl">
        <div className="flex items-start justify-between border-b border-border/70 px-5 py-4 sm:px-6">
          <div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Central de suporte</div><h2 id="novo-chamado-title" className="mt-1 text-lg font-semibold">Abrir novo chamado</h2><p className="mt-1 text-xs text-muted-foreground">Registre a solicitação com contexto suficiente para o atendimento.</p></div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label="Fechar formulário"><X /></Button>
        </div>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assunto" required className="sm:col-span-2"><Input autoFocus placeholder="Ex.: Computador não conecta à rede" value={subject} onChange={e => onSubjectChange(e.target.value)} /></Field>
            <Field label="Categoria"><select value={categoryId} onChange={e => onCategoryChange(e.target.value)} disabled={catalogLoading} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"><option value="">{catalogLoading ? "Carregando..." : categories.length ? "Selecione uma categoria" : "Nenhuma categoria cadastrada"}</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="Serviço"><select value={serviceId} onChange={e => onServiceChange(e.target.value)} disabled={catalogLoading} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"><option value="">{catalogLoading ? "Carregando..." : services.length ? "Selecione um serviço" : "Nenhum serviço cadastrado"}</option>{services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="Prioridade" required><select value={ticketPriority} onChange={e => onPriorityChange(e.target.value as "baixa" | "media" | "alta" | "critica")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="critica">Crítica</option></select></Field>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground"><div className="font-medium text-foreground">SLA automático</div><p className="mt-1">O prazo será calculado conforme a prioridade e o calendário de atendimento configurado.</p></div>
            <Field label="Descrição" required className="sm:col-span-2"><Textarea placeholder="Descreva o problema, quando começou, o que já foi testado e outras informações úteis." value={description} onChange={e => onDescriptionChange(e.target.value)} rows={6} /></Field>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button><Button onClick={onCreate} disabled={!subject.trim() || !description.trim() || saving}>{saving ? "Abrindo..." : "Abrir chamado"}</Button></div>
      </Card>
    </div>
  </div>;
}

function Field({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) { return <label className={`block space-y-1.5 ${className}`}><span className="text-xs font-medium text-foreground">{label}{required && <span className="ml-1 text-destructive">*</span>}</span>{children}</label>; }

function QueueMetric({ label, value, icon: Icon, active, onClick }: { label: string; value: number | string; icon: typeof Inbox; active: boolean; onClick: () => void }) { return <button onClick={onClick} className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${active ? "border-primary/30 bg-primary/[0.045]" : "border-border/70 bg-card"}`}><div className="flex items-center justify-between"><Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} /><span className="text-xl font-bold">{value}</span></div><div className="mt-2 text-xs font-medium text-muted-foreground">{label}</div></button>; }

function TicketRow({ ticket, onTransition }: { ticket: TicketItem; onTransition: (id: string, status: "em_atendimento" | "resolvido" | "fechado") => void }) { const isLate = !!ticket.sla_resolution_at && new Date(ticket.sla_resolution_at).getTime() < Date.now() && !["resolvido", "fechado"].includes(ticket.status); return <div className="group flex flex-col gap-4 p-4 transition-colors hover:bg-muted/25 sm:px-5 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Ticket className="h-4 w-4" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold text-primary">#{ticket.ticket_number}</span><Badge variant="outline" className="text-[10px]">{priorityLabel[ticket.priority] ?? ticket.priority}</Badge>{isLate && <Badge variant="destructive" className="text-[10px]">SLA vencido</Badge>}</div><div className="mt-1 truncate text-sm font-semibold">{ticket.subject}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{ticket.created_at ? new Date(ticket.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Data não disponível"}</div></div></div><div className="flex items-center justify-between gap-3 lg:justify-end"><Badge variant={ticket.status === "resolvido" || ticket.status === "fechado" ? "secondary" : "outline"}>{statusLabel[ticket.status]}</Badge>{ticket.status === "novo" && <Button size="sm" onClick={() => onTransition(ticket.id, "em_atendimento")}>Iniciar</Button>}{ticket.status === "em_atendimento" && <Button size="sm" onClick={() => onTransition(ticket.id, "resolvido")}>Resolver</Button>}{ticket.status === "resolvido" && <Button size="sm" variant="outline" onClick={() => onTransition(ticket.id, "fechado")}>Fechar</Button>}</div></div>; }
