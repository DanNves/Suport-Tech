import { createFileRoute } from "@tanstack/react-router";
import { Monitor } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/ativos")({ component: AtivosPage });
function AtivosPage() { return <AppShell title="Ativos" subtitle="Organize equipamentos, infraestrutura e inventário de TI."><Card className="flex min-h-[360px] flex-col items-center justify-center border-border/70 p-8 text-center shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Monitor className="h-6 w-6" /></div><h2 className="text-lg font-semibold">Inventário de ativos</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">A estrutura visual está pronta. O inventário será desenvolvido em uma etapa própria.</p></Card></AppShell>; }
