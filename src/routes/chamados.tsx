import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Plus, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTicket, listMyTickets, transitionTicket } from "@/lib/supabase/repositories";

export const Route = createFileRoute("/chamados")({ component: ChamadosPage });

function ChamadosPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setTickets((await listMyTickets()) as any[]); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar os chamados."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (!subject.trim() || !description.trim()) return;
    try { setError(null); await createTicket({ subject: subject.trim(), description: description.trim() }); setSubject(""); setDescription(""); setOpen(false); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível abrir o chamado."); }
  };

  const transition = async (id: string, status: "em_atendimento" | "resolvido" | "fechado") => {
    try { setError(null); await transitionTicket(id, status); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível atualizar o chamado."); }
  };

  return <AppShell title="Chamados" subtitle="Gerencie solicitações, prioridades e atendimentos de suporte."><div className="space-y-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Central de chamados</h2><p className="text-sm text-muted-foreground">Abertura e acompanhamento conectados ao Supabase.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button><Button onClick={() => setOpen(!open)}><Plus className="mr-2 h-4 w-4" />Novo chamado</Button></div></div>{error && <Card className="flex items-center gap-2 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</Card>}{open && <Card className="space-y-3 p-5"><Input placeholder="Assunto" value={subject} onChange={e => setSubject(e.target.value)} /><Textarea placeholder="Descreva o problema ou solicitação" value={description} onChange={e => setDescription(e.target.value)} /><Button onClick={() => void create()} disabled={!subject.trim() || !description.trim()}>Abrir chamado</Button></Card>}{loading ? <Card className="p-8 text-center text-sm text-muted-foreground">Carregando chamados...</Card> : <div className="grid gap-3">{tickets.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum chamado encontrado.</Card> : tickets.map(t => <Card key={t.id} className="p-4"><div className="flex items-center justify-between gap-4"><div><span className="text-xs font-semibold text-primary">#{t.ticket_number}</span><h3 className="font-semibold">{t.subject}</h3><p className="text-sm text-muted-foreground">{t.status} · {t.priority}</p></div>{t.status === "novo" && <Button size="sm" onClick={() => void transition(t.id, "em_atendimento")}>Iniciar atendimento</Button>}{t.status === "em_atendimento" && <Button size="sm" onClick={() => void transition(t.id, "resolvido")}>Marcar resolvido</Button>}{t.status === "resolvido" && <Button size="sm" variant="outline" onClick={() => void transition(t.id, "fechado")}>Fechar</Button>}</div></Card>)}</div>}</div></AppShell>;
}
