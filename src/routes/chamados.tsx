import { createFileRoute } from "@tanstack/react-router";
import { TicketCenter } from "@/components/TicketCenter";

export const Route = createFileRoute("/chamados")({ component: TicketCenter });
