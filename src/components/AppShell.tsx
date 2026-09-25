import { useEffect, useState, type ReactNode } from "react";
import { Activity, Bell, BookOpen, ChevronDown, CircleHelp, ClipboardList, Command, Gauge, LayoutDashboard, LifeBuoy, LogOut, Menu, Monitor, MoreHorizontal, Search, Settings, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { getMyNotifications, getMyPermissions, globalSearch, markAllNotificationsRead, markNotificationRead } from "@/lib/supabase/repositories";
import { hasPermission, permissionForRoute } from "@/lib/access-control";

type RoutePath = "/" | "/chamados" | "/ativos" | "/usuarios" | "/conhecimento" | "/relatorios" | "/catalogo" | "/gestao" | "/configuracoes" | "/perfil";
type NavItem = { label: string; icon: typeof LayoutDashboard; href: RoutePath };
type AppShellProps = { children: ReactNode; title?: string; subtitle?: string };

const primaryNav: NavItem[] = [
  { label: "Visão geral", icon: LayoutDashboard, href: "/" },
  { label: "Chamados", icon: ClipboardList, href: "/chamados" },
  { label: "Ativos", icon: Monitor, href: "/ativos" },
  { label: "Usuários", icon: Users, href: "/usuarios" },
  { label: "Base de conhecimento", icon: BookOpen, href: "/conhecimento" },
];
const managementNav: NavItem[] = [
  { label: "Relatórios", icon: Gauge, href: "/relatorios" },
    { label: "Gestão", icon: ShieldCheck, href: "/gestao" },
  { label: "Configurações", icon: Settings, href: "/configuracoes" },
];

export function AppShell({ children, title, subtitle }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [authChecking, setAuthChecking] = useState(supabaseConfigured);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any>({ tickets: [], assets: [], knowledge: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const closeMobile = () => setSidebarOpen(false);
  useEffect(() => {
    if (searchTerm.trim().length < 2) { setSearchResults({ tickets: [], assets: [], knowledge: [] }); setSearching(false); return; }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void globalSearch(searchTerm).then((results) => {
        if (active) setSearchResults(results);
      }).catch(() => {
        if (active) setSearchResults({ tickets: [], assets: [], knowledge: [] });
      }).finally(() => {
        if (active) setSearching(false);
      });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchTerm]);


  useEffect(() => {
    if (!supabaseConfigured) { setAuthChecking(false); return; }
    let active = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) { await navigate({ to: "/login", replace: true }); return; }
      setUserEmail(data.session.user.email ?? null);
      try {
        const [nextPermissions, nextNotifications] = await Promise.all([getMyPermissions(), getMyNotifications()]);
        setPermissions(nextPermissions);
        setNotifications(nextNotifications);
      } catch {
        setPermissions([]);
        setNotifications([]);
      }
      setAuthChecking(false);
    };
    void check();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) { void navigate({ to: "/login", replace: true }); return; }
      setUserEmail(session.user.email ?? null);
      void Promise.all([getMyPermissions(), getMyNotifications()]).then(([nextPermissions, nextNotifications]) => {
        setPermissions(nextPermissions);
        setNotifications(nextNotifications);
      }).catch(() => {
        setPermissions([]);
        setNotifications([]);
      });
      setAuthChecking(false);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [navigate]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    await navigate({ to: "/login", replace: true });
    setSigningOut(false);
  };

  if (authChecking) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const canShowRoute = (href: string) => hasPermission(permissions, permissionForRoute(href));
  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = item.href === "/" ? location.pathname === "/" : location.pathname.startsWith(item.href);
    return <Link key={item.href} to={item.href} preload="intent" onClick={closeMobile} className={cn("group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all", active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}><Icon className="h-[18px] w-[18px]" /><span className="flex-1 text-left">{item.label}</span></Link>;
  };

  return <div className="min-h-screen bg-background text-foreground">
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-border/80 bg-sidebar transition-transform duration-200 lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex h-20 shrink-0 items-center justify-between border-b border-sidebar-border px-5"><Link to="/" preload="intent" className="flex items-center gap-3" onClick={closeMobile}><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><LifeBuoy className="h-5 w-5" strokeWidth={2.2} /></div><div><div className="text-[15px] font-bold tracking-tight">SuportTech</div><div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">IT Operations</div></div></Link><button className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent lg:hidden" onClick={closeMobile} aria-label="Fechar menu"><X className="h-5 w-5" /></button></div>
      <div className="flex-1 overflow-y-auto px-3 py-5"><div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</div><nav className="space-y-1">{primaryNav.filter((item) => canShowRoute(item.href)).map(renderNavItem)}</nav><div className="my-6 border-t border-sidebar-border" /><div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gestão</div><nav className="space-y-1">{managementNav.filter((item) => canShowRoute(item.href)).map(renderNavItem)}</nav></div>
      <div className="shrink-0 border-t border-sidebar-border p-3"><div className="rounded-xl bg-sidebar-accent/70 p-3"><div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-background text-primary shadow-sm"><ShieldCheck className="h-4 w-4" /></span><div className="text-xs font-semibold">Ambiente protegido</div></div><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Serviços operacionais</div></div></div>
    </aside>
    {sidebarOpen && <button className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] lg:hidden" onClick={closeMobile} aria-label="Fechar menu" />}
    <div className="min-h-screen lg:pl-[264px]"><header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><button className="rounded-lg border border-border p-2 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button><div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span>SuportTech</span><span>/</span><span className="text-foreground">{title ?? "Visão geral"}</span></div></div><div className="flex items-center gap-2 sm:gap-3"><div className="relative hidden w-72 md:block">
  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  <Input aria-label="Buscar" value={searchTerm} onFocus={() => setSearchOpen(true)} onChange={(e) => { setSearchTerm(e.target.value); setSearchOpen(true); }} placeholder="Buscar chamados, ativos..." className="h-10 rounded-xl border-border/80 bg-muted/40 pl-9 pr-12" />
  <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground lg:block">⌘ K</kbd>
  {searchOpen && searchTerm.trim().length >= 2 && <div className="absolute right-0 top-full z-50 mt-2 w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-background shadow-xl">
    {searching ? <div className="p-5 text-center text-sm text-muted-foreground">Buscando...</div> :
    (searchResults.tickets.length + searchResults.assets.length + searchResults.knowledge.length) === 0 ? <div className="p-5 text-center text-sm text-muted-foreground">Nenhum resultado encontrado.</div> :
    <div className="max-h-[420px] overflow-y-auto">
      {searchResults.tickets.length > 0 && <div className="p-2"><div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Chamados</div>{searchResults.tickets.map((item:any)=><button key={item.id} type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted" onClick={() => { setSearchOpen(false); setSearchTerm(""); void navigate({ to: "/chamados" }); }}><div className="text-sm font-medium">#{item.ticket_number} — {item.subject}</div><div className="text-[11px] text-muted-foreground">{item.status} · {item.priority}</div></button>)}</div>}
      {searchResults.assets.length > 0 && <div className="border-t p-2"><div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ativos</div>{searchResults.assets.map((item:any)=><button key={item.id} type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted" onClick={() => { setSearchOpen(false); setSearchTerm(""); void navigate({ to: "/ativos" }); }}><div className="text-sm font-medium">{item.asset_tag} — {item.name}</div><div className="text-[11px] text-muted-foreground">{item.asset_type} · {item.status}</div></button>)}</div>}
      {searchResults.knowledge.length > 0 && <div className="border-t p-2"><div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Conhecimento</div>{searchResults.knowledge.map((item:any)=><button key={item.id} type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted" onClick={() => { setSearchOpen(false); setSearchTerm(""); void navigate({ to: "/conhecimento" }); }}><div className="text-sm font-medium">{item.title}</div><div className="text-[11px] text-muted-foreground">{item.category ?? "Artigo"}</div></button>)}</div>}
    </div>}
  </div>}
</div><div className="relative">
  <Button variant="ghost" size="icon" className="relative rounded-xl" aria-label="Notificações" onClick={() => { setNotificationsOpen(v => !v); setUserMenuOpen(false); }}>
    <Bell className="h-[18px] w-[18px]" />
    {notifications.some((n) => !n.is_read) && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />}
  </Button>
  {notificationsOpen && <div className="absolute right-0 top-full z-50 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-background shadow-xl">
    <div className="flex items-center justify-between border-b p-3">
      <div><div className="text-sm font-semibold">Notificações</div><div className="text-[11px] text-muted-foreground">{notifications.filter(n => !n.is_read).length} não lida(s)</div></div>
      <Button variant="ghost" size="sm" onClick={() => { void markAllNotificationsRead().then(() => setNotifications(current => current.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))).catch(() => undefined)); }}>Marcar todas</Button>
    </div>
    <div className="max-h-[420px] overflow-y-auto">
      {notifications.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação.</div> :
        notifications.slice(0, 20).map((n) => <button key={n.id} type="button" className={cn("w-full border-b px-4 py-3 text-left hover:bg-muted/40", !n.is_read && "bg-primary/5")} onClick={() => {
          if (!n.is_read) void markNotificationRead(n.id).then(() => setNotifications(current => current.map(item => item.id === n.id ? { ...item, is_read: true, read_at: new Date().toISOString() } : item))).catch(() => undefined);
          setNotificationsOpen(false);
          if (n.ticket_id) void navigate({ to: "/chamados" });
        }}>
          <div className="text-sm font-medium">{n.title}</div>
          {n.message && <div className="mt-1 text-xs leading-5 text-muted-foreground">{n.message}</div>}
          <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
        </button>)
      }
    </div>
  </div>}
</div><div className="hidden h-7 w-px bg-border sm:block" /><div className="relative"><button className="group flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-muted/70" onClick={() => setUserMenuOpen(v => !v)} aria-expanded={userMenuOpen} aria-haspopup="menu" aria-label="Abrir menu do usuário"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{userEmail?.slice(0, 2).toUpperCase() ?? "ST"}</div><div className="hidden text-left sm:block"><div className="max-w-40 truncate text-xs font-semibold">{userEmail ?? "Usuário"}</div><div className="text-[10px] text-muted-foreground">Minha conta</div></div><ChevronDown className={cn("hidden h-4 w-4 text-muted-foreground transition-transform sm:block", userMenuOpen && "rotate-180")} /></button>{userMenuOpen && <><button className="fixed inset-0 z-40 cursor-default" onClick={() => setUserMenuOpen(false)} aria-label="Fechar menu do usuário" /><div role="menu" className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-background p-1.5 shadow-lg"><button role="menuitem" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted" onClick={() => { setUserMenuOpen(false); void navigate({ to: "/perfil" }); }}><UserRound className="h-4 w-4 text-muted-foreground" /><span>Perfil</span></button><button role="menuitem" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50" onClick={() => void signOut()} disabled={signingOut}><LogOut className="h-4 w-4" /><span>{signingOut ? "Saindo..." : "Sair"}</span></button></div></>}</div></div></header><main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{title && <div className="mb-6"><h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>}{children}</main></div>
  </div>;
}
export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) { return <div className="mb-4 flex items-end justify-between gap-4"><div>{eyebrow && <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</div>}<h2 className="text-base font-semibold tracking-tight">{title}</h2></div>{action}</div>; }
export function StatusDot({ status = "online" }: { status?: "online" | "warning" | "offline" }) { return <span className={cn("h-2 w-2 rounded-full", status === "online" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : "bg-red-500")} />; }
export const QuickActionIcon = Command;
export const HelpIcon = CircleHelp;
export const ActivityIcon = Activity;
export const MoreIcon = MoreHorizontal;
