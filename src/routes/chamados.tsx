import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/chamados")({ component: ChamadosPage });

function ChamadosPage() {
  return <AppShell title="Chamados" subtitle="Gerencie solicitações, prioridades e atendimentos de suporte."><Card className="flex min-h-[360px] flex-col items-center justify-center border-border/70 p-8 text-center shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="h-6 w-6" /></div><h2 className="text-lg font-semibold">Central de chamados</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">A estrutura da operação está pronta. O gerenciamento completo de chamados será construído na Fase 2.</p></Card></AppShell>;
}
