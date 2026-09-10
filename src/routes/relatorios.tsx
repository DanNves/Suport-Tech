import { createFileRoute } from "@tanstack/react-router";
import { Gauge } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/relatorios")({ component: RelatoriosPage });
function RelatoriosPage() { return <AppShell title="Relatórios" subtitle="Acompanhe indicadores, produtividade e desempenho da operação."><Card className="flex min-h-[360px] flex-col items-center justify-center border-border/70 p-8 text-center shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Gauge className="h-6 w-6" /></div><h2 className="text-lg font-semibold">Relatórios operacionais</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Os indicadores e relatórios detalhados serão construídos após a consolidação dos dados de chamados.</p></Card></AppShell>; }
