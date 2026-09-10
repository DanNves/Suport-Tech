import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/usuarios")({ component: UsuariosPage });
function UsuariosPage() { return <AppShell title="Usuários" subtitle="Gerencie solicitantes, técnicos e perfis de acesso."><Card className="flex min-h-[360px] flex-col items-center justify-center border-border/70 p-8 text-center shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="h-6 w-6" /></div><h2 className="text-lg font-semibold">Gestão de usuários</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">A gestão de usuários e permissões será conectada à autenticação nas próximas fases.</p></Card></AppShell>; }
