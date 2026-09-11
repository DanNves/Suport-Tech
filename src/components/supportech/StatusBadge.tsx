import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ticketPriorityLabels, ticketStatusLabels, type TicketPriority, type TicketStatus } from "@/lib/supportech";

const statusStyles: Record<TicketStatus, string> = {
  novo: "bg-blue-50 text-blue-700 border-blue-200",
  atribuido: "bg-violet-50 text-violet-700 border-violet-200",
  em_atendimento: "bg-indigo-50 text-indigo-700 border-indigo-200",
  aguardando_usuario: "bg-amber-50 text-amber-700 border-amber-200",
  resolvido: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fechado: "bg-slate-100 text-slate-700 border-slate-200",
};

const priorityStyles: Record<TicketPriority, string> = {
  baixa: "bg-slate-50 text-slate-600 border-slate-200",
  media: "bg-blue-50 text-blue-700 border-blue-200",
  alta: "bg-orange-50 text-orange-700 border-orange-200",
  critica: "bg-red-50 text-red-700 border-red-200",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant="outline" className={cn("rounded-full font-medium", statusStyles[status])}>{ticketStatusLabels[status]}</Badge>;
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge variant="outline" className={cn("rounded-full font-medium", priorityStyles[priority])}>{ticketPriorityLabels[priority]}</Badge>;
}
