import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Filter, Inbox, Plus, RefreshCw, Search, Ticket, Timer, X } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createTicket, listMyTickets, transitionTicket } from "@/lib/supabase/repositories";

export const Route = createFileRoute("/chamados")({ component: ChamadosPage });

type TicketStatus = "novo" | "em_atendimento" | "resolvido" | "fechado";
type TicketItem = { id: string; ticket_number: number | string; subject: string; description?: string; status: TicketStatus; priority: string; created_at?: string; sla_resolution_at?: string | null };

const statusLabel: Record<TicketStatus, string> = { novo: "Novo", em_atendimento: "Em atendimento", resolvido: "Resolvido", fechado: "Fechado" };
const priorityLabel: Record<string, string> = { critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa" };

function ChamadosPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | TicketStatus>("todos");
  const [priority, setPriority] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setTickets((await listMyTickets()) as TicketItem[]); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar os chamados."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => tickets.filter((t) => {
    const text = `${t.ticket_number} ${t.subject}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (status === "todos" || t.status === status) && (priority === "todos" || t.priority === priority);
  }), [tickets, query, status, priority]);

  const create = async () => {
    if (!subject.trim() || !description.trim() || saving) return;
    setSaving(true); setError(null);
    try { await createTicket({ subject: subject.trim(), description: description.trim() }); setSubject(""); setDescription(""); setOpen(false); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível abrir o chamado."); }
    finally { setSaving(false); }
  };

  const transition = async (id: string, next: "em_atendimento" | "resolvido" | "fechado") => {
    try { setError(null); await transitionTicket(id, next); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível atualizar o chamado."); }
  };

  const metrics = {
    total: tickets.length,
    open: tickets.filter((t) => ["novo", "em_atendimento"].includes(t.status)).length,
    progress: tickets.filter((t) => t.status === "em_atendimento").length,
    resolved: tickets.filter((t) => ["resolvido", "fechado"].includes(t.status)).length,
  };

  return <AppShell title="Chamados" subtitle="Gerencie solicitações, prioridades e atendimentos de suporte.">
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4"><div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 sm:flex"><Ticket className="h-5 w-5" /></div><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-foreground/65">Central de suporte</div><h2 className="mt-1 text-xl font-semibold tracking-tight">Acompanhe sua operação.</h2><p className="mt-1 text-sm text-primary-foreground/70">Abertura, atendimento e acompanhamento em um único fluxo.</p></div></div>
        <Button onClick={() => setOpen((v) => !v)} className="w-full bg-white text-primary shadow-none hover:bg-white/90 lg:w-auto"><Plus /> Novo chamado</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total" value={loading ? "—" : metrics.total} icon={Inbox} />
        <Metric label="Em aberto" value={loading ? "—" : metrics.open} icon={Timer} />
        <Metric label="Em atendimento" value={loading ? "—" : metrics.progress} icon={Clock3} />
        <Metric label="Resolvidos" value={loading ? "—" : metrics.resolved} icon={CheckCircle2} />
      </div>

      {open && <Card className="border-primary/20 p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">Abrir novo chamado</h3><p className="text-xs text-muted-foreground">O SLA será calculado automaticamente após o envio.</p></div><Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar formulário"><X /></Button></div><div className="grid gap-3"><Input placeholder="Assunto do chamado" value={subject} onChange={(e) => setSubject(e.target.value)} /><Textarea placeholder="Descreva o problema ou solicitação com o máximo de contexto possível." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} /><div className="flex justify-end"><Button onClick={() => void create()} disabled={!subject.trim() || !description.trim() || saving}>{saving ? "Abrindo..." : "Abrir chamado"}</Button></div></div></Card>}

      {error && <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div className="flex-1"><div className="font-medium">Não foi possível concluir a operação</div><div className="mt-0.5 text-destructive/80">{error}</div></div><Button variant="ghost" size="sm" onClick={() => void load()} className="text-destructive hover:text-destructive">Tentar novamente</Button></Card>}

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <div className="border-b border-border/70 p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fila de atendimento</div><h2 className="mt-1 text-base font-semibold">Todos os chamados</h2></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar chamado..." className="h-9 w-full pl-9 sm:w-56" /></div><select value={status} onChange={(e) => setStatus(e.target.value as "todos" | TicketStatus)} className="h-9 rounded-md border border-input bg-background px-3 text-xs"><option value="todos">Todos os status</option><option value="novo">Novo</option><option value="em_atendimento">Em atendimento</option><option value="resolvido">Resolvido</option><option value="fechado">Fechado</option></select><select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-xs"><option value="todos">Todas prioridades</option><option value="critica">Crítica</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Atualizar</Button></div></div></div>
        {loading ? <div className="p-12 text-center text-sm text-muted-foreground">Carregando chamados...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-12 text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted"><Filter className="h-5 w-5 text-muted-foreground" /></div><div className="font-medium">Nenhum chamado encontrado</div><p className="mt-1 max-w-sm text-xs text-muted-foreground">Ajuste os filtros ou abra um novo chamado para começar o atendimento.</p></div> : <div className="divide-y divide-border/70">{filtered.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onTransition={transition} />)}</div>}
      </Card>
    </div>
  </AppShell>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Inbox }) { return <Card className="border-border/70 p-5 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/8 text-primary"><Icon className="h-[18px] w-[18px]" /></div><div className="mt-5 text-2xl font-bold tracking-tight">{value}</div><div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div></Card>; }

function TicketRow({ ticket, onTransition }: { ticket: TicketItem; onTransition: (id: string, status: "em_atendimento" | "resolvido" | "fechado") => void }) {
  const isLate = !!ticket.sla_resolution_at && new Date(ticket.sla_resolution_at).getTime() < Date.now() && !["resolvido", "fechado"].includes(ticket.status);
  return <div className="group flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-muted/30 sm:px-5 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Ticket className="h-4 w-4" /></div><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[10px] font-semibold text-primary">#{ticket.ticket_number}</span><Badge variant="outline" className="text-[10px]">{priorityLabel[ticket.priority] ?? ticket.priority}</Badge>{isLate && <Badge variant="destructive" className="text-[10px]">SLA vencido</Badge>}</div><div className="mt-1 truncate text-sm font-medium">{ticket.subject}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{ticket.created_at ? new Date(ticket.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Data não disponível"}</div></div></div><div className="flex items-center justify-between gap-3 lg:justify-end"><Badge variant={ticket.status === "resolvido" || ticket.status === "fechado" ? "secondary" : "outline"}>{statusLabel[ticket.status]}</Badge>{ticket.status === "novo" && <Button size="sm" onClick={() => onTransition(ticket.id, "em_atendimento")}>Iniciar</Button>}{ticket.status === "em_atendimento" && <Button size="sm" onClick={() => onTransition(ticket.id, "resolvido")}>Resolver</Button>}{ticket.status === "resolvido" && <Button size="sm" variant="outline" onClick={() => onTransition(ticket.id, "fechado")}>Fechar</Button>}</div></div>;
}
