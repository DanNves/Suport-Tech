import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/conhecimento")({ component: ConhecimentoPage });
function ConhecimentoPage() { return <AppShell title="Base de conhecimento" subtitle="Centralize procedimentos, soluções e documentação técnica."><Card className="flex min-h-[360px] flex-col items-center justify-center border-border/70 p-8 text-center shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="h-6 w-6" /></div><h2 className="text-lg font-semibold">Base de conhecimento</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">A estrutura está preparada para artigos, procedimentos e soluções reutilizáveis.</p></Card></AppShell>; }
