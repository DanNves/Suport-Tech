import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/configuracoes")({ component: ConfiguracoesPage });
function ConfiguracoesPage() { return <AppShell title="Configurações" subtitle="Personalize o ambiente, preferências e regras do Supportech."><Card className="flex min-h-[360px] flex-col items-center justify-center border-border/70 p-8 text-center shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Settings className="h-6 w-6" /></div><h2 className="text-lg font-semibold">Configurações do sistema</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">As configurações administrativas serão habilitadas conforme os módulos do sistema forem implementados.</p></Card></AppShell>; }
