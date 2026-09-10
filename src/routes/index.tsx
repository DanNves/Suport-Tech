import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Cpu,
  HardDrive,
  LifeBuoy,
  MoreHorizontal,
  Plus,
  Server,
  Ticket,
  TrendingDown,
  TrendingUp,
  Wifi,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { AppShell, SectionHeader, StatusDot } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const tickets = [
  { id: "#SUP-1048", title: "Computador não inicia", requester: "Mariana Santos", category: "Hardware", priority: "Alta", status: "Em atendimento", time: "08:42" },
  { id: "#SUP-1047", title: "Acesso ao ERP indisponível", requester: "Carlos Lima", category: "Sistemas", priority: "Urgente", status: "Aberto", time: "08:17" },
  { id: "#SUP-1046", title: "Configuração de impressora", requester: "Ana Paula", category: "Periféricos", priority: "Média", status: "Aguardando", time: "Ontem" },
  { id: "#SUP-1045", title: "Queda de conexão no setor financeiro", requester: "Rafael Souza", category: "Redes", priority: "Alta", status: "Resolvido", time: "Ontem" },
];

function Dashboard() {
  const [range, setRange] = useState("Hoje");

  return (
    <AppShell title="Visão geral" subtitle="Acompanhe a operação de suporte e a saúde do ambiente de TI.">
      <div className="mb-7 flex flex-col gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 sm:flex"><LifeBuoy className="h-6 w-6" /></div>
          <div><div className="mb-1 text-xs font-medium text-primary-foreground/70">Bom dia, Daniel</div><h2 className="text-xl font-semibold tracking-tight">A operação está sob controle.</h2><p className="mt-1 max-w-xl text-sm text-primary-foreground/70">12 chamados precisam de atenção e nenhum serviço crítico apresenta indisponibilidade.</p></div>
        </div>
        <Button className="w-full bg-white text-primary shadow-none hover:bg-white/90 lg:w-auto"><Plus /> Novo chamado</Button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Chamados abertos" value="12" delta="8%" trend="up" icon={Ticket} note="vs. período anterior" />
        <MetricCard label="Em atendimento" value="7" delta="3%" trend="down" icon={Clock3} note="tempo médio 32 min" />
        <MetricCard label="Resolvidos hoje" value="24" delta="12%" trend="up" icon={CheckCircle2} note="92% dentro do SLA" />
        <MetricCard label="SLA em risco" value="3" delta="2" trend="down" icon={Zap} note="requerem atenção" danger />
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-6">
            <SectionHeader eyebrow="Operação" title="Chamados recentes" action={<Button variant="ghost" size="sm" className="hidden sm:inline-flex">Ver todos <ArrowUpRight /></Button>} />
          </div>
          <div className="divide-y divide-border/70">
            {tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)}
          </div>
          <div className="border-t border-border/70 p-3 sm:hidden"><Button variant="outline" className="w-full">Ver todos os chamados <ArrowUpRight /></Button></div>
        </Card>

        <Card className="border-border/70 bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Performance</div><h2 className="mt-1 text-base font-semibold">Atendimentos</h2></div><div className="flex rounded-lg bg-muted p-0.5">{["Hoje", "7 dias", "30 dias"].map((item) => <button key={item} onClick={() => setRange(item)} className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${range === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>{item}</button>)}</div></div>
          <div className="mb-6 flex items-end justify-between"><div><div className="text-3xl font-bold tracking-tight">91,4%</div><div className="mt-1 flex items-center gap-1 text-xs text-emerald-600"><TrendingUp className="h-3.5 w-3.5" /> 6,2% <span className="text-muted-foreground">no período</span></div></div><div className="text-right text-[10px] text-muted-foreground">Satisfação média<br /><strong className="text-foreground">4,8 / 5</strong></div></div>
          <div className="flex h-36 items-end gap-2 border-b border-border/70 px-1">
            {[46, 62, 54, 78, 68, 84, 72, 96, 74, 88, 80, 100, 91, 86].map((height, index) => <div key={index} className="group flex flex-1 items-end"><div className="w-full rounded-t-md bg-primary/15 transition-all group-hover:bg-primary/30" style={{ height: `${height}%` }} /></div>)}
          </div>
          <div className="mt-3 flex justify-between text-[10px] text-muted-foreground"><span>08h</span><span>12h</span><span>16h</span><span>Agora</span></div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/70 p-5 shadow-sm sm:p-6"><SectionHeader eyebrow="Infraestrutura" title="Saúde do ambiente" /><div className="space-y-4"><HealthItem icon={Server} label="Servidores" value="18 / 18" status="online" /><HealthItem icon={Wifi} label="Rede principal" value="Estável" status="online" /><HealthItem icon={Cpu} label="Monitoramento" value="Zabbix" status="online" /><HealthItem icon={HardDrive} label="Armazenamento" value="68% utilizado" status="warning" /></div></Card>
        <Card className="border-border/70 p-5 shadow-sm sm:p-6"><SectionHeader eyebrow="SLA" title="Chamados por prioridade" /><div className="space-y-4"><PriorityBar label="Urgente" count={2} percent={12} /><PriorityBar label="Alta" count={5} percent={42} /><PriorityBar label="Média" count={4} percent={34} /><PriorityBar label="Baixa" count={1} percent={12} /></div></Card>
        <Card className="border-border/70 p-5 shadow-sm sm:p-6"><SectionHeader eyebrow="Equipe" title="Técnicos em atividade" /><div className="space-y-3"><Technician initials="AM" name="André Martins" role="Infraestrutura" status="Em atendimento" /><Technician initials="JC" name="João Costa" role="Service Desk" status="Disponível" /><Technician initials="BS" name="Beatriz Silva" role="Sistemas" status="Disponível" /></div><Button variant="outline" size="sm" className="mt-4 w-full">Ver equipe</Button></Card>
      </div>
    </AppShell>
  );
}

function MetricCard({ label, value, delta, trend, icon: Icon, note, danger }: { label: string; value: string; delta: string; trend: "up" | "down"; icon: typeof Ticket; note: string; danger?: boolean }) {
  const positive = trend === "down";
  return <Card className="border-border/70 p-5 shadow-sm transition-shadow hover:shadow-md"><div className="flex items-start justify-between"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${danger ? "bg-amber-500/10 text-amber-600" : "bg-primary/8 text-primary"}`}><Icon className="h-[18px] w-[18px]" /></div><button className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button></div><div className="mt-5 text-2xl font-bold tracking-tight">{value}</div><div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div><div className="mt-4 flex items-center gap-2 text-[10px]"><span className={`inline-flex items-center gap-1 font-semibold ${danger ? "text-amber-600" : positive ? "text-emerald-600" : "text-blue-600"}`}>{positive ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}{delta}</span><span className="text-muted-foreground">{note}</span></div></Card>;
}

function TicketRow({ ticket }: { ticket: (typeof tickets)[number] }) {
  const statusClass = ticket.status === "Resolvido" ? "bg-emerald-500/10 text-emerald-700" : ticket.status === "Aberto" ? "bg-blue-500/10 text-blue-700" : ticket.status === "Aguardando" ? "bg-amber-500/10 text-amber-700" : "bg-primary/10 text-primary";
  const priorityClass = ticket.priority === "Urgente" ? "text-red-600" : ticket.priority === "Alta" ? "text-orange-600" : "text-muted-foreground";
  return <div className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:px-6"><div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex"><Ticket className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[10px] font-semibold text-muted-foreground">{ticket.id}</span><span className={`text-[10px] font-semibold ${priorityClass}`}>{ticket.priority}</span></div><div className="mt-1 truncate text-sm font-medium">{ticket.title}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">{ticket.requester} · {ticket.category}</div></div><div className="hidden text-right sm:block"><Badge className={`border-0 ${statusClass}`}>{ticket.status}</Badge><div className="mt-1 text-[10px] text-muted-foreground">{ticket.time}</div></div><button className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button></div>;
}

function HealthItem({ icon: Icon, label, value, status }: { icon: typeof Server; label: string; value: string; status: "online" | "warning" }) { return <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0 flex-1"><div className="text-xs font-medium">{label}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{value}</div></div><StatusDot status={status} /></div>; }
function PriorityBar({ label, count, percent }: { label: string; count: number; percent: number }) { return <div><div className="mb-1.5 flex justify-between text-[11px]"><span className="font-medium">{label}</span><span className="text-muted-foreground">{count} chamados</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div></div>; }
function Technician({ initials, name, role, status }: { initials: string; name: string; role: string; status: string }) { return <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{initials}</div><div className="min-w-0 flex-1"><div className="text-xs font-semibold">{name}</div><div className="text-[10px] text-muted-foreground">{role}</div></div><div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><StatusDot status={status === "Disponível" ? "online" : "warning"} />{status}</div></div>; }
