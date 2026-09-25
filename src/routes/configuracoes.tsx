import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Database,
  Globe2,
  Mail,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getAccessMatrix, getAppSettings, getMyProfile, getPermissions, testAuthEmailAdmin, testTicketEmailAdmin, updateAppSetting, updateRolePermissionsAdmin } from "@/lib/supabase/repositories";
import { toast } from "sonner";

type TabKey = "geral" | "email" | "notificacoes" | "chamados" | "acessos" | "seguranca";
type SettingsMap = Record<string, Record<string, any>>;

const defaults: SettingsMap = {
  system: {
    name: "SuportTech",
    version: "0.1.0",
    supportEmail: "",
    timezone: "America/Bahia",
    language: "pt-BR",
    maintenanceMode: false,
  },
  preferences: {
    language: "pt-BR",
    timezone: "America/Bahia",
    dateFormat: "DD/MM/YYYY",
  },
  notifications: {
    emailNewTicket: true,
    emailAssignment: true,
    emailResolution: true,
    emailAccess: true,
  },
  email: {
    enabled: true,
    provider: "resend",
    fromName: "SuportTech",
    fromEmail: "",
    replyTo: "",
    ticketNew: true,
    ticketAssignment: true,
    ticketResolution: true,
    ticketComment: true,
    ticketStatusChange: true,
  },
  tickets: {
    defaultPriority: "media",
    requireCategory: false,
    allowRequesterClose: false,
  },
};

const tabs: { key: TabKey; label: string; icon: typeof Globe2 }[] = [
  { key: "geral", label: "Geral", icon: Globe2 },
  { key: "email", label: "E-mail", icon: Mail },
  { key: "notificacoes", label: "Notificações", icon: Bell },
  { key: "chamados", label: "Chamados", icon: Ticket },
  { key: "acessos", label: "Acessos", icon: Users },
  { key: "seguranca", label: "Segurança", icon: ShieldCheck },
];

function cloneDefaults() {
  return JSON.parse(JSON.stringify(defaults)) as SettingsMap;
}

function buildAccessDraft(matrix: any[]) {
  const draft: Record<string, string[]> = {};
  for (const row of matrix ?? []) {
    const roleKey = row?.roles?.key;
    const permissionKey = row?.permissions?.key;
    if (!roleKey || !permissionKey) continue;
    draft[roleKey] = draft[roleKey] ?? [];
    draft[roleKey].push(permissionKey);
  }
  return draft;
}

function mergeSettings(rows: any[]) {
  const merged = cloneDefaults();
  for (const row of rows) {
    if (row?.key && row?.value && typeof row.value === "object" && !Array.isArray(row.value)) {
      merged[row.key] = { ...(merged[row.key] ?? {}), ...row.value };
    }
  }
  return merged;
}

export const Route = createFileRoute("/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const [settings, setSettings] = useState<SettingsMap>(cloneDefaults);
  const [tab, setTab] = useState<TabKey>("geral");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [accessRows, setAccessRows] = useState<any[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<any[]>([]);
  const [accessDraft, setAccessDraft] = useState<Record<string, string[]>>({});
  const [accessDirty, setAccessDirty] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [ticketEmailTesting, setTicketEmailTesting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [rows, profile, matrix, permissions] = await Promise.all([getAppSettings(), getMyProfile(), getAccessMatrix(), getPermissions()]);
      setSettings(mergeSettings(rows ?? []));
      const role = profile?.roles as any;
      const key = Array.isArray(role) ? role[0]?.key : role?.key;
      setCanManage(key === "admin");
      const latest = (rows ?? [])
        .map((row: any) => row?.updated_at)
        .filter(Boolean)
        .sort()
        .at(-1);
      setUpdatedAt(latest ?? null);
      setAccessRows(matrix ?? []);
      setPermissionCatalog(permissions ?? []);
      setAccessDraft(buildAccessDraft(matrix ?? []));
      setDirty(false);
      setAccessDirty(false);
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível carregar as configurações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const update = (group: string, key: string, value: any) => {
    setSettings((current) => ({
      ...current,
      [group]: { ...(current[group] ?? {}), [key]: value },
    }));
    setDirty(true);
  };

  const save = async () => {
    if (!canManage || saving) return;
    setSaving(true);
    try {
      for (const key of ["system", "preferences", "notifications", "tickets", "email"]) {
        await updateAppSetting(key, settings[key] ?? {});
      }
      toast.success("Configurações salvas com sucesso.");
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  const updatePermission = (roleKey: string, permissionKey: string, checked: boolean) => {
    if (roleKey === "admin") return;
    setAccessDraft((current) => {
      const currentKeys = new Set(current[roleKey] ?? []);
      if (checked) currentKeys.add(permissionKey); else currentKeys.delete(permissionKey);
      return { ...current, [roleKey]: Array.from(currentKeys) };
    });
    setAccessDirty(true);
  };

  const saveAccess = async () => {
    if (!canManage || accessSaving || !accessDirty) return;
    setAccessSaving(true);
    try {
      const roleIds = new Map<string, string>();
      for (const row of accessRows) if (row?.roles?.key && row?.roles?.id) roleIds.set(row.roles.key, row.roles.id);
      const roleKeys = Array.from(new Set(accessRows.map((row) => row?.roles?.key).filter(Boolean))).filter((key) => key !== "admin");
      for (const roleKey of roleKeys) {
        const roleId = roleIds.get(roleKey);
        if (roleId) await updateRolePermissionsAdmin(roleId, accessDraft[roleKey] ?? []);
      }
      toast.success("Permissões dos perfis atualizadas com sucesso.");
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível salvar as permissões.");
    } finally {
      setAccessSaving(false);
    }
  };

  const restoreDefaults = () => {
    if (!canManage) return;
    if (!window.confirm("Restaurar as configurações administrativas para os valores padrão?")) return;
    setSettings(cloneDefaults());
    setDirty(true);
  };

  const summary = useMemo(
    () => ({
      language: settings.preferences?.language ?? "pt-BR",
      timezone: settings.preferences?.timezone ?? "America/Bahia",
      version: settings.system?.version ?? "0.1.0",
    }),
    [settings],
  );

  if (loading) {
    return (
      <AppShell
        title="Configurações"
        subtitle="Administre o funcionamento, notificações, chamados e acessos do SuportTech."
      >
        <Card className="flex min-h-[420px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando configurações...
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Configurações"
      subtitle="Administre o funcionamento, notificações, chamados e acessos do SuportTech."
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Sistema</div>
                <div className="font-semibold">{settings.system?.name ?? "SuportTech"}</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Idioma / fuso</div>
                <div className="font-semibold">
                  {summary.language} · {summary.timezone}
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Versão</div>
                <div className="font-semibold">{summary.version}</div>
              </div>
            </div>
          </Card>
        </div>

        {!canManage && (
          <Card className="border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
            Você pode consultar estas configurações, mas somente administradores podem alterar os valores.
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="border-b p-2">
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={[
                    "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
                    tab === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {tab === "geral" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold">Informações do ambiente</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dados básicos utilizados pela operação do SuportTech.
                  </p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <Label>Nome do sistema</Label>
                    <Input
                      className="mt-1.5"
                      value={settings.system?.name ?? ""}
                      onChange={(e) => update("system", "name", e.target.value)}
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <Label>Versão</Label>
                    <Input
                      className="mt-1.5"
                      value={settings.system?.version ?? ""}
                      onChange={(e) => update("system", "version", e.target.value)}
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <Label>E-mail de suporte</Label>
                    <Input
                      className="mt-1.5"
                      type="email"
                      placeholder="suporte@empresa.com"
                      value={settings.system?.supportEmail ?? ""}
                      onChange={(e) => update("system", "supportEmail", e.target.value)}
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <Label>Idioma</Label>
                    <Select
                      value={settings.preferences?.language}
                      onValueChange={(value) => {
                        update("preferences", "language", value);
                        update("system", "language", value);
                      }}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                        <SelectItem value="en-US">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fuso horário</Label>
                    <Select
                      value={settings.preferences?.timezone}
                      onValueChange={(value) => {
                        update("preferences", "timezone", value);
                        update("system", "timezone", value);
                      }}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Bahia">América/Bahia</SelectItem>
                        <SelectItem value="America/Sao_Paulo">América/São Paulo</SelectItem>
                        <SelectItem value="America/Fortaleza">América/Fortaleza</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Formato de data</Label>
                    <Select
                      value={settings.preferences?.dateFormat}
                      onValueChange={(value) => update("preferences", "dateFormat", value)}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/AAAA</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/AAAA</SelectItem>
                        <SelectItem value="YYYY-MM-DD">AAAA-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                  <div>
                    <div className="text-sm font-medium">Modo de manutenção</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Sinaliza que o ambiente está em manutenção. A aplicação continua acessível para administração.
                    </div>
                  </div>
                  <Switch
                    checked={Boolean(settings.system?.maintenanceMode)}
                    onCheckedChange={(value) => update("system", "maintenanceMode", value)}
                    disabled={!canManage}
                  />
                </div>
              </section>
            )}

            {tab === "email" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold">E-mail do sistema</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Teste o mesmo fluxo de e-mail usado para recuperação de senha e ativação de acesso.
                  </p>
                </div>
                <Card className="border-primary/15 bg-primary/5 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Mail className="h-5 w-5" /></div>
                      <div>
                        <div className="text-sm font-semibold">Teste de entrega</div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          O teste envia uma mensagem de recuperação para o e-mail do administrador que está conectado.
                          Se o envio falhar por limite ou SMTP, a mensagem retornará o motivo técnico.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      disabled={!canManage || emailTesting}
                      onClick={() => {
                        setEmailTesting(true);
                        void testAuthEmailAdmin()
                          .then((result: any) => toast.success(result?.message ?? "E-mail de teste enviado."))
                          .catch((error: any) => toast.error(error?.message ?? "Não foi possível testar o envio de e-mail."))
                          .finally(() => setEmailTesting(false));
                      }}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {emailTesting ? "Enviando..." : "Enviar e-mail de teste"}
                    </Button>
                  </div>
                </Card>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <div className="text-sm font-semibold">Convites e recuperação</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Os convites de novos usuários e links de redefinição passam pelo Supabase Auth e utilizam o endereço de retorno seguro do SuportTech.
                    </p>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm font-semibold">SMTP de produção</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Para enviar para qualquer endereço, o projeto precisa de um SMTP personalizado configurado no Supabase Auth.
                    </p>
                  </Card>
                </div>
                <Card className="border-primary/15 bg-primary/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">E-mail de chamados</div>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                        Configure o remetente e quais eventos do atendimento devem gerar e-mails. A chave do Resend fica somente nos secrets da Edge Function do Supabase.
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${settings.email?.fromEmail ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {settings.email?.fromEmail ? "Remetente configurado" : "Aguardando remetente"}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Nome do remetente</Label>
                      <Input className="mt-1.5" value={settings.email?.fromName ?? ""} onChange={(e) => update("email", "fromName", e.target.value)} disabled={!canManage} placeholder="SuportTech" />
                    </div>
                    <div>
                      <Label>E-mail do remetente</Label>
                      <Input className="mt-1.5" type="email" value={settings.email?.fromEmail ?? ""} onChange={(e) => update("email", "fromEmail", e.target.value)} disabled={!canManage} placeholder="suporte@empresa.com" />
                    </div>
                    <div>
                      <Label>Responder para (opcional)</Label>
                      <Input className="mt-1.5" type="email" value={settings.email?.replyTo ?? ""} onChange={(e) => update("email", "replyTo", e.target.value)} disabled={!canManage} placeholder="suporte@empresa.com" />
                    </div>
                  </div>
                  <div className="mt-5 rounded-xl border bg-background p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium">Ativar e-mail de chamados</div>
                        <div className="mt-1 text-xs text-muted-foreground">O envio depende da configuração do provedor Resend no ambiente do Supabase.</div>
                      </div>
                      <Switch checked={Boolean(settings.email?.enabled)} onCheckedChange={(value) => update("email", "enabled", value)} disabled={!canManage} />
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[
                        ["ticketNew", "Novo chamado", "Avisar a equipe de suporte quando um novo chamado for aberto."],
                        ["ticketAssignment", "Atribuição", "Avisar o responsável quando o chamado for atribuído."],
                        ["ticketResolution", "Resolução", "Avisar o solicitante quando o chamado for resolvido."],
                        ["ticketStatusChange", "Mudança de status", "Avisar o solicitante nas demais mudanças de status."],
                        ["ticketComment", "Nova comunicação", "Avisar a outra parte quando houver mensagem pública no chamado."],
                      ].map(([key, title, description]) => (
                        <div key={key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                          <div>
                            <div className="text-sm font-medium">{title}</div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>
                          </div>
                          <Switch checked={Boolean(settings.email?.[key])} onCheckedChange={(value) => update("email", key, value)} disabled={!canManage || !settings.email?.enabled} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium">Teste do canal de chamados</div>
                      <div className="mt-1 text-xs text-muted-foreground">Envia uma mensagem de teste somente para o e-mail do administrador conectado.</div>
                    </div>
                    <Button
                      variant="outline"
                      disabled={!canManage || ticketEmailTesting}
                      onClick={() => {
                        setTicketEmailTesting(true);
                        void testTicketEmailAdmin()
                          .then((result: any) => toast.success(result?.message ?? "E-mail de teste enviado."))
                          .catch((error: any) => toast.error(error?.message ?? "Não foi possível testar o e-mail de chamados."))
                          .finally(() => setTicketEmailTesting(false));
                      }}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {ticketEmailTesting ? "Enviando..." : "Testar e-mail de chamados"}
                    </Button>
                  </div>
                </Card>

                {!canManage && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Apenas administradores ativos podem executar o teste de envio.
                  </div>
                )}
              </section>
            )}

            {tab === "notificacoes" && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Notificações</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Preferências gerais para eventos que poderão gerar avisos por e-mail.
                  </p>
                </div>
                {[
                  ["emailNewTicket", "Novo chamado", "Notificar a equipe quando um novo chamado for aberto."],
                  ["emailAssignment", "Atribuição", "Notificar o responsável quando um chamado for atribuído."],
                  ["emailResolution", "Resolução", "Notificar o solicitante quando o chamado for resolvido."],
                  ["emailAccess", "Acesso de usuário", "Permitir mensagens relacionadas a convite, ativação e recuperação de acesso."],
                ].map(([key, title, description]) => (
                  <div key={key} className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div>
                      <div className="text-sm font-medium">{title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
                    </div>
                    <Switch
                      checked={Boolean(settings.notifications?.[key])}
                      onCheckedChange={(value) => update("notifications", key, value)}
                      disabled={!canManage}
                    />
                  </div>
                ))}
              </section>
            )}

            {tab === "chamados" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold">Regras de chamados</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Defina comportamentos padrão para abertura e encerramento.
                  </p>
                </div>
                <div className="md:w-1/2">
                  <Label>Prioridade padrão</Label>
                  <Select
                    value={settings.tickets?.defaultPriority}
                    onValueChange={(value) => update("tickets", "defaultPriority", value)}
                    disabled={!canManage}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div>
                      <div className="text-sm font-medium">Exigir categoria</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Impede abertura de chamado sem categoria definida.
                      </div>
                    </div>
                    <Switch
                      checked={Boolean(settings.tickets?.requireCategory)}
                      onCheckedChange={(value) => update("tickets", "requireCategory", value)}
                      disabled={!canManage}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div>
                      <div className="text-sm font-medium">Permitir encerramento pelo solicitante</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Permite que o solicitante encerre o próprio chamado após a resolução.
                      </div>
                    </div>
                    <Switch
                      checked={Boolean(settings.tickets?.allowRequesterClose)}
                      onCheckedChange={(value) => update("tickets", "allowRequesterClose", value)}
                      disabled={!canManage}
                    />
                  </div>
                </div>
              </section>
            )}

            {tab === "acessos" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold">Perfis e permissões</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Defina quais recursos cada perfil pode acessar. O administrador permanece protegido com acesso total.
                  </p>
                </div>
                <div className="space-y-4">
                  {Array.from(new Set(accessRows.map((row) => row?.roles?.key).filter(Boolean))).map((roleKey) => {
                    const role = accessRows.find((row) => row?.roles?.key === roleKey)?.roles;
                    const selected = new Set(accessDraft[roleKey] ?? []);
                    const protectedRole = roleKey === "admin";
                    return (
                      <Card key={roleKey} className="overflow-hidden">
                        <div className="flex items-center justify-between border-b p-4">
                          <div>
                            <div className="font-medium">{role?.name ?? roleKey}</div>
                            <div className="text-xs text-muted-foreground">{role?.description ?? "Perfil de acesso"}</div>
                          </div>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">{selected.size} permissões</span>
                        </div>
                        <div className="grid gap-2 p-4 md:grid-cols-2">
                          {permissionCatalog.map((permission) => (
                            <label key={permission.key} className={`flex items-start gap-3 rounded-lg border p-3 ${protectedRole ? "opacity-70" : "hover:bg-muted/30"}`}>
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 accent-primary"
                                checked={selected.has(permission.key)}
                                disabled={protectedRole || !canManage}
                                onChange={(event) => updatePermission(roleKey, permission.key, event.target.checked)}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium">{permission.name}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">{permission.description ?? permission.key}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
                <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
                  As permissões controlam a navegação e a proteção das rotas. A segurança dos dados continua sendo aplicada pelo Supabase.
                </div>
              </section>
            )}

            {tab === "seguranca" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold">Segurança e autenticação</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Informações e limites administrativos relacionados ao acesso.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <div className="text-sm font-semibold">Autenticação centralizada</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Usuários, convites e recuperação de senha são tratados pelo Supabase Auth.
                        </div>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <div className="text-sm font-semibold">Controle administrativo</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Apenas administradores ativos alteram configurações neste ambiente.
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <strong>Controles do provedor:</strong> URL do site, SMTP, templates de e-mail,
                  MFA e proteção contra senhas comprometidas são administrados no Supabase Auth.
                </div>
              </section>
            )}

            <div className="mt-8 flex flex-col justify-between gap-3 border-t pt-5 sm:flex-row sm:items-center">
              <div className="text-xs text-muted-foreground">
                {tab === "acessos"
                  ? accessDirty ? "Há alterações de permissões não salvas." : "Permissões carregadas."
                  : dirty
                    ? "Há alterações não salvas."
                    : updatedAt
                      ? `Última atualização: ${new Date(updatedAt).toLocaleString("pt-BR")}`
                      : "Configurações carregadas."}
              </div>
              <div className="flex gap-2">
                {tab === "acessos" ? (
                  <Button onClick={() => void saveAccess()} disabled={!canManage || !accessDirty || accessSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {accessSaving ? "Salvando..." : "Salvar permissões"}
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={restoreDefaults} disabled={!canManage || saving}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Restaurar padrão
                    </Button>
                    <Button onClick={() => void save()} disabled={!canManage || !dirty || saving}>
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? "Salvando..." : "Salvar configurações"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
