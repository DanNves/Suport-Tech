import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  Download,
  RefreshCw,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listOperationalReportTickets } from "@/lib/supabase/repositories";
import { toast } from "sonner";

type Period = "7" | "30" | "90" | "365" | "all";

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  atribuido: "Atribuído",
  em_atendimento: "Em atendimento",
  aguardando_usuario: "Aguardando usuário",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

function toDateInput(date: Date) {
  return String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function startForPeriod(period: Period) {
  if (period === "all") return undefined;
  const date = new Date();
  date.setDate(date.getDate() - (Number(period) - 1));
  return toDateInput(date);
}

function endTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateInput(date);
}

function minutesBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
}

function formatMinutes(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value < 60) return Math.round(value) + " min";
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return hours + "h " + minutes + "min";
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function csvEscape(value: unknown) {
  return "\"" + String(value ?? "").replace(/"/g, "\"\"") + "\"";
}

export const Route = createFileRoute("/relatorios")({
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const [period, setPeriod] = useState<Period>("30");
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const rows = await listOperationalReportTickets(startForPeriod(period), endTomorrow());
      setTickets(rows ?? []);
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível carregar os relatórios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [period]);

  const metrics = useMemo(() => {
    const openStatuses = new Set(["novo", "atribuido", "em_atendimento", "aguardando_usuario"]);
    const open = tickets.filter((t) => openStatuses.has(t.status)).length;
    const resolved = tickets.filter((t) => t.status === "resolvido" || t.status === "fechado").length;
    const responseTimes = tickets.map((t) => minutesBetween(t.created_at, t.first_response_at)).filter((v): v is number => v !== null);
    const resolutionTimes = tickets.map((t) => minutesBetween(t.created_at, t.resolved_at ?? t.closed_at)).filter((v): v is number => v !== null);
    const slaBreaches = tickets.filter((t) => Boolean(t.sla_response_breached || t.sla_resolution_breached)).length;

    return {
      total: tickets.length,
      open,
      resolved,
      slaBreaches,
      avgResponse: responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : null,
      avgResolution: resolutionTimes.length ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : null,
      resolutionRate: tickets.length ? (resolved / tickets.length) * 100 : 0,
    };
  }, [tickets]);

  const statusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of tickets) counts.set(ticket.status, (counts.get(ticket.status) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([key, value]) => ({ key, label: STATUS_LABEL[key] ?? key, value }))
      .sort((a, b) => b.value - a.value);
  }, [tickets]);

  const priorityData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of tickets) counts.set(ticket.priority, (counts.get(ticket.priority) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([key, value]) => ({ key, label: PRIORITY_LABEL[key] ?? key, value }))
      .sort((a, b) => b.value - a.value);
  }, [tickets]);

  const departmentData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of tickets) {
      const name = ticket.departments?.name ?? "Sem setor";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [tickets]);

  const trendData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of tickets) {
      const date = new Date(ticket.created_at);
      const key = toDateInput(date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([key, value]) => ({
        label: new Date(key + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        value,
      }));
  }, [tickets]);

  const exportCsv = () => {
    if (!tickets.length) {
      toast.info("Não há chamados no período selecionado para exportar.");
      return;
    }
    const header = ["Chamado", "Assunto", "Status", "Prioridade", "Setor", "Criado em", "Primeira resposta", "Resolvido em", "SLA comprometido"];
    const rows = tickets.map((t) => [
      t.ticket_number,
      t.subject,
      STATUS_LABEL[t.status] ?? t.status,
      PRIORITY_LABEL[t.priority] ?? t.priority,
      t.departments?.name ?? "Sem setor",
      formatDate(t.created_at),
      formatDate(t.first_response_at),
      formatDate(t.resolved_at ?? t.closed_at),
      t.sla_response_breached || t.sla_resolution_breached ? "Sim" : "Não",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(";")).join("\\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "relatorio-suporttech-" + toDateInput(new Date()) + ".csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const maxTrend = Math.max.apply(null, [1].concat(trendData.map((item) => item.value)));
  const maxStatus = Math.max.apply(null, [1].concat(statusData.map((item) => item.value)));
  const maxPriority = Math.max.apply(null, [1].concat(priorityData.map((item) => item.value)));
  const maxDepartment = Math.max.apply(null, [1].concat(departmentData.map((item) => item.value)));

  const cards = [
    { label: "Chamados", value: metrics.total, icon: Ticket, note: "no período" },
    { label: "Em aberto", value: metrics.open, icon: Clock3, note: "aguardando atendimento" },
    { label: "Resolvidos", value: metrics.resolved, icon: TrendingUp, note: metrics.resolutionRate.toFixed(0) + "% do período" },
    { label: "SLA comprometido", value: metrics.slaBreaches, icon: AlertTriangle, note: "resposta ou resolução" },
    { label: "Tempo médio de resposta", value: formatMinutes(metrics.avgResponse), icon: Clock3, note: "primeira interação" },
  ];

  return (
    <AppShell title="Relatórios" subtitle="Acompanhe indicadores, produtividade e desempenho da operação.">
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold">Visão operacional</h2>
            <p className="text-sm text-muted-foreground">
              Indicadores calculados a partir dos chamados disponíveis para a equipe de atendimento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Últimos 12 meses</SelectItem>
                <SelectItem value="all">Todo o histórico</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Atualizar
            </Button>
            <Button onClick={exportCsv} disabled={loading || !tickets.length}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {cards.map(({ label, value, icon: Icon, note }) => (
            <Card key={label} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 text-2xl font-bold">{value}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{note}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div><h3 className="font-semibold">Chamados por dia</h3><p className="text-xs text-muted-foreground">Últimos 14 dias com movimentação no período.</p></div>
            </div>
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : trendData.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum chamado encontrado no período.</div>
            ) : (
              <div className="flex h-56 items-end gap-2 overflow-x-auto pt-5">
                {trendData.map((item) => (
                  <div key={item.label} className="flex min-w-[32px] flex-1 flex-col items-center gap-2">
                    <div className="text-[10px] text-muted-foreground">{item.value}</div>
                    <div className="w-full rounded-t-md bg-primary/70" style={{ height: Math.max(8, (item.value / maxTrend) * 150) + "px" }} />
                    <div className="text-[10px] text-muted-foreground">{item.label}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <Ticket className="h-5 w-5 text-primary" />
              <div><h3 className="font-semibold">Distribuição por status</h3><p className="text-xs text-muted-foreground">Situação atual dos chamados do período.</p></div>
            </div>
            {statusData.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Sem dados para exibir.</div>
            ) : (
              <div className="space-y-3">
                {statusData.map((item) => (
                  <div key={item.key}>
                    <div className="mb-1 flex justify-between text-xs"><span>{item.label}</span><span className="font-semibold">{item.value}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: (item.value / maxStatus) * 100 + "%" }} /></div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div><h3 className="font-semibold">Prioridades</h3><p className="text-xs text-muted-foreground">Distribuição de severidade dos chamados.</p></div>
            </div>
            {priorityData.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Sem dados para exibir.</div>
            ) : (
              <div className="space-y-3">
                {priorityData.map((item) => (
                  <div key={item.key}>
                    <div className="mb-1 flex justify-between text-xs"><span>{item.label}</span><span className="font-semibold">{item.value}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/80" style={{ width: (item.value / maxPriority) * 100 + "%" }} /></div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div><h3 className="font-semibold">Chamados por setor</h3><p className="text-xs text-muted-foreground">Principais áreas por volume de atendimento.</p></div>
            </div>
            {departmentData.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Sem dados para exibir.</div>
            ) : (
              <div className="space-y-3">
                {departmentData.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex justify-between text-xs"><span className="truncate pr-3">{item.label}</span><span className="font-semibold">{item.value}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/60" style={{ width: (item.value / maxDepartment) * 100 + "%" }} /></div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div><h3 className="font-semibold">Detalhamento</h3><p className="text-xs text-muted-foreground">Chamados mais recentes dentro do período selecionado.</p></div>
            <div className="text-xs text-muted-foreground">Tempo médio para resolução: <strong className="text-foreground">{formatMinutes(metrics.avgResolution)}</strong></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="p-3">Chamado</th><th className="p-3">Assunto</th><th className="p-3">Status</th><th className="p-3">Prioridade</th><th className="p-3">Setor</th><th className="p-3">Criado</th><th className="p-3">SLA</th></tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-center text-sm text-muted-foreground">Nenhum chamado no período.</td></tr>
                ) : (
                  tickets.slice(-20).reverse().map((ticket) => (
                    <tr key={ticket.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">#{ticket.ticket_number}</td>
                      <td className="max-w-[320px] truncate p-3">{ticket.subject}</td>
                      <td className="p-3">{STATUS_LABEL[ticket.status] ?? ticket.status}</td>
                      <td className="p-3">{PRIORITY_LABEL[ticket.priority] ?? ticket.priority}</td>
                      <td className="p-3">{ticket.departments?.name ?? "—"}</td>
                      <td className="p-3">{formatDate(ticket.created_at)}</td>
                      <td className="p-3">{ticket.sla_response_breached || ticket.sla_resolution_breached ? "Comprometido" : "Dentro do SLA"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
