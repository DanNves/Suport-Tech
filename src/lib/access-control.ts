export type AppRole = "admin" | "manager" | "technician" | "agent" | "requester" | "auditor";

export const routePermission: Record<string, string> = {
  "/": "dashboard.view",
  "/chamados": "tickets.view",
  "/ativos": "assets.view",
  "/usuarios": "users.view",
  "/conhecimento": "knowledge.view",
  "/relatorios": "reports.view",
  "/gestao": "users.view",
  "/configuracoes": "settings.manage",
  "/catalogo": "settings.manage",
  "/perfil": "dashboard.view",
};

export function hasPermission(permissions: string[], required?: string | null) {
  return !required || permissions.includes(required);
}

export function permissionForRoute(pathname: string) {
  if (pathname.startsWith("/chamados/")) return "tickets.view";
  const exact = routePermission[pathname];
  if (exact) return exact;
  return null;
}