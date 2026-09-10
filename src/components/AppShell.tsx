import { useState, type ReactNode } from "react";
import { Activity, Bell, BookOpen, Boxes, ChevronDown, CircleHelp, ClipboardList, Command, Gauge, LayoutDashboard, LifeBuoy, Menu, Monitor, MoreHorizontal, Search, Settings, ShieldCheck, Users, X } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RoutePath = "/" | "/chamados" | "/ativos" | "/usuarios" | "/conhecimento" | "/relatorios" | "/catalogo" | "/configuracoes";
type NavItem = { label: string; icon: typeof LayoutDashboard; href: RoutePath; badge?: string };
type AppShellProps = { children: ReactNode; title?: string; subtitle?: string };

const primaryNav: NavItem[] = [
  { label: "Visão geral", icon: LayoutDashboard, href: "/" },
  { label: "Chamados", icon: ClipboardList, href: "/chamados", badge: "12" },
  { label: "Ativos", icon: Monitor, href: "/ativos" },
  { label: "Usuários", icon: Users, href: "/usuarios" },
  { label: "Base de conhecimento", icon: BookOpen, href: "/conhecimento" },
];
const managementNav: NavItem[] = [
  { label: "Relatórios", icon: Gauge, href: "/relatorios" },
  { label: "Catálogo de serviços", icon: Boxes, href: "/catalogo" },
  { label: "Configurações", icon: Settings, href: "/configuracoes" },
];

export function AppShell({ children, title, subtitle }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const closeMobile = () => setSidebarOpen(false);
  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = item.href === "/" ? location.pathname === "/" : location.pathname.startsWith(item.href);
    return <Link key={item.href} to={item.href} onClick={closeMobile} className={cn("group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all", active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}><Icon className="h-[18px] w-[18px]" /><span className="flex-1 text-left">{item.label}</span>{item.badge && <Badge className={cn("border-0 px-1.5 py-0.5 text-[10px]", active ? "bg-white/15 text-white" : "bg-background/70 text-muted-foreground")}>{item.badge}</Badge>}</Link>;
  };
  return <div className="min-h-screen bg-background text-foreground">
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-border/80 bg-sidebar transition-transform duration-200 lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex h-20 shrink-0 items-center justify-between border-b border-sidebar-border px-5"><Link to="/" className="flex items-center gap-3" onClick={closeMobile}><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><LifeBuoy className="h-5 w-5" strokeWidth={2.2} /></div><div><div className="text-[15px] font-bold tracking-tight">SUPPORTECH</div><div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">IT Operations</div></div></Link><button className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent lg:hidden" onClick={closeMobile} aria-label="Fechar menu"><X className="h-5 w-5" /></button></div>
      <div className="flex-1 overflow-y-auto px-3 py-5"><div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</div><nav className="space-y-1">{primaryNav.map(renderNavItem)}</nav><div className="my-6 border-t border-sidebar-border" /><div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gestão</div><nav className="space-y-1">{managementNav.map(renderNavItem)}</nav></div>
      <div className="shrink-0 border-t border-sidebar-border p-3"><div className="rounded-xl bg-sidebar-accent/70 p-3"><div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-background text-primary shadow-sm"><ShieldCheck className="h-4 w-4" /></span><div className="text-xs font-semibold">Ambiente protegido</div></div><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Serviços operacionais</div></div></div>
    </aside>
    {sidebarOpen && <button className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] lg:hidden" onClick={closeMobile} aria-label="Fechar menu" />}
    <div className="min-h-screen lg:pl-[264px]"><header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><button className="rounded-lg border border-border p-2 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button><div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span>Supportech</span><span>/</span><span className="text-foreground">{title ?? "Visão geral"}</span></div></div><div className="flex items-center gap-2 sm:gap-3"><div className="relative hidden w-64 md:block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar" placeholder="Buscar no sistema..." className="h-10 rounded-xl border-border/80 bg-muted/40 pl-9 pr-12" /><kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground lg:block">⌘ K</kbd></div><Button variant="ghost" size="icon" className="relative rounded-xl" aria-label="Notificações"><Bell className="h-[18px] w-[18px]" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" /></Button><div className="hidden h-7 w-px bg-border sm:block" /><button className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-muted/70"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">DN</div><div className="hidden text-left sm:block"><div className="text-xs font-semibold">Daniel Neves</div><div className="text-[10px] text-muted-foreground">Administrador</div></div><ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" /></button></div></header><main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{title && <div className="mb-6"><h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>}{children}</main></div>
  </div>;
}
export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) { return <div className="mb-4 flex items-end justify-between gap-4"><div>{eyebrow && <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</div>}<h2 className="text-base font-semibold tracking-tight">{title}</h2></div>{action}</div>; }
export function StatusDot({ status = "online" }: { status?: "online" | "warning" | "offline" }) { return <span className={cn("h-2 w-2 rounded-full", status === "online" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : "bg-red-500")} />; }
export const QuickActionIcon = Command;
export const HelpIcon = CircleHelp;
export const ActivityIcon = Activity;
export const MoreIcon = MoreHorizontal;
