import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getTicket, getTicketComments, getTicketHistory, addTicketComment } from "@/lib/supabase/repositories";

export const Route = createFileRoute("/chamados/$ticketId")({ component: TicketDetailPage });

function TicketDetailPage() {
  const { ticketId } = Route.useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [current, currentHistory, currentComments] = await Promise.all([getTicket(ticketId), getTicketHistory(ticketId), getTicketComments(ticketId)]);
      setTicket(current); setHistory(currentHistory ?? []); setComments(currentComments ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar o chamado."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [ticketId]);

  const sendComment = async () => {
    if (!comment.trim()) return;
    try { await addTicketComment(ticketId, comment.trim()); setComment(""); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível enviar o comentário."); }
  };

  return <AppShell title={ticket ? `Chamado #${ticket.ticket_number}` : "Detalhes do chamado"} subtitle="Acompanhamento, histórico e comunicação do atendimento."><div className="space-y-5"><Link to="/chamados" className="inline-flex items-center text-sm font-medium text-primary hover:underline"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para chamados</Link>{error && <Card className="p-4 text-sm text-destructive">{error}</Card>}{loading ? <Card className="p-8 text-center text-sm text-muted-foreground">Carregando chamado...</Card> : ticket && <><Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-xs font-semibold text-primary">#{ticket.ticket_number}</span><h2 className="mt-1 text-xl font-semibold">{ticket.subject}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description}</p></div><div className="rounded-lg bg-muted px-3 py-2 text-sm"><strong>{ticket.status}</strong><span className="mx-2">·</span>{ticket.priority}</div></div></Card><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><Card className="p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Histórico</h3><Button size="icon" variant="ghost" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div><div className="space-y-4">{history.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p> : history.map(item => <div key={item.id} className="border-l-2 border-primary/20 pl-4"><p className="text-sm font-medium">{item.event_type ?? item.action ?? "Atualização"}</p><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</p></div>)}</div></Card><Card className="p-5"><h3 className="mb-4 flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" />Comentários</h3><div className="mb-4 space-y-3">{comments.map(item => <div key={item.id} className="rounded-lg bg-muted/50 p-3"><p className="text-sm whitespace-pre-wrap">{item.body}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</p></div>)}{comments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>}</div><div className="space-y-2"><Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Adicionar comentário..." onKeyDown={e => { if (e.key === "Enter") void sendComment(); }} /><Button className="w-full" onClick={() => void sendComment()} disabled={!comment.trim()}>Enviar comentário</Button></div></Card></div></>}</div></AppShell>;
}
