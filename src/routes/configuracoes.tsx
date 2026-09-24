import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Database,
  Globe2,
  Palette,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getAppSettings, getMyProfile, updateAppSetting } from "@/lib/supabase/repositories";
import { toast } from "sonner";

type TabKey = "geral" | "aparencia" | "notificacoes" | "chamados" | "seguranca";
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
  branding: {
    primaryColor: "#3333c5",
    primaryDark: "#232388",
    primaryLight: "#6b6bd6",
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
  tickets: {
    defaultPriority: "media",
    requireCategory: false,
    allowRequesterClose: false,
  },
};

const tabs: { key: TabKey; label: string; icon: typeof Globe2 }[] = [
  { key: "geral", label: "Geral", icon: Globe2 },
  { key: "aparencia", label: "Aparência", icon: Palette },
  { key: "notificacoes", label: "Notificações", icon: Bell },
  { key: "chamados", label: "Chamados", icon: Ticket },
  { key: "seguranca", label: "Segurança", icon: ShieldCheck },
];

function cloneDefaults() {
  return JSON.parse(JSON.stringify(defaults)) as SettingsMap;
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

  const load = async () => {
    try {
      setLoading(true);
      const [rows, profile] = await Promise.all([getAppSettings(), getMyProfile()]);
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
      setDirty(false);
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
      for (const key of ["system", "branding", "preferences", "notifications", "tickets"]) {
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
        subtitle="Administre preferências, identidade visual e regras operacionais do SuportTech."
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
      subtitle="Administre preferências, identidade visual e regras operacionais do SuportTech."
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

            {tab === "aparencia" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold">Identidade visual</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cores-base utilizadas como referência visual do ambiente.
                  </p>
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  {[
                    ["primaryColor", "Cor principal"],
                    ["primaryDark", "Cor escura"],
                    ["primaryLight", "Cor clara"],
                  ].map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={settings.branding?.[key] ?? "#3333c5"}
                          onChange={(e) => update("branding", key, e.target.value)}
                          disabled={!canManage}
                          className="h-10 w-14 cursor-pointer p-1"
                        />
                        <Input
                          value={settings.branding?.[key] ?? ""}
                          onChange={(e) => update("branding", key, e.target.value)}
                          disabled={!canManage}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border p-5">
                  <div className="mb-4 text-sm font-medium">Pré-visualização</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                      style={{ backgroundColor: settings.branding?.primaryColor }}
                    >
                      ST
                    </div>
                    <Button style={{ backgroundColor: settings.branding?.primaryColor }}>
                      Ação principal
                    </Button>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: settings.branding?.primaryDark }}
                    >
                      SuportTech
                    </span>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-medium"
                      style={{ backgroundColor: settings.branding?.primaryLight }}
                    >
                      Apoio
                    </span>
                  </div>
                </div>
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
                {dirty
                  ? "Há alterações não salvas."
                  : updatedAt
                    ? \`Última atualização: \${new Date(updatedAt).toLocaleString("pt-BR")}\`
                    : "Configurações carregadas."}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={restoreDefaults}
                  disabled={!canManage || saving}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Restaurar padrão
                </Button>
                <Button onClick={() => void save()} disabled={!canManage || !dirty || saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar configurações"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
