import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/catalogo")({ component: CatalogoPage });
function CatalogoPage() { return <AppShell title="Catálogo de serviços" subtitle="Organize serviços, categorias e ofertas de atendimento de TI."><Card className="flex min-h-[360px] flex-col items-center justify-center border-border/70 p-8 text-center shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Boxes className="h-6 w-6" /></div><h2 className="text-lg font-semibold">Catálogo de serviços</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">A base do catálogo está preparada para receber serviços e fluxos de atendimento.</p></Card></AppShell>; }
