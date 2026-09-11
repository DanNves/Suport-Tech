export const supportechConfig = {
  brand: {
    primary: "#3333c5",
    primaryLight: "#6b6bd6",
    primaryDark: "#232388",
  },
  modules: {
    dashboard: { label: "Visão geral", path: "/" },
    tickets: { label: "Chamados", path: "/chamados" },
    assets: { label: "Ativos", path: "/ativos" },
    users: { label: "Usuários", path: "/usuarios" },
    knowledge: { label: "Base de conhecimento", path: "/conhecimento" },
    reports: { label: "Relatórios", path: "/relatorios" },
    catalog: { label: "Catálogo de serviços", path: "/catalogo" },
    settings: { label: "Configurações", path: "/configuracoes" },
  },
  roles: ["admin", "manager", "technician", "agent", "requester", "auditor"] as const,
} as const;

export type SupportechRole = (typeof supportechConfig.roles)[number];
