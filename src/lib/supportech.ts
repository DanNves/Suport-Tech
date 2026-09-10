export const appModules = {
  dashboard: { label: "Visão geral", path: "/" },
  tickets: { label: "Chamados", path: "/chamados" },
  assets: { label: "Ativos", path: "/ativos" },
  users: { label: "Usuários", path: "/usuarios" },
  knowledge: { label: "Base de conhecimento", path: "/conhecimento" },
  reports: { label: "Relatórios", path: "/relatorios" },
  catalog: { label: "Catálogo de serviços", path: "/catalogo" },
  settings: { label: "Configurações", path: "/configuracoes" },
} as const;

export const ticketStatuses = [
  "novo",
  "atribuido",
  "em_atendimento",
  "aguardando_usuario",
  "resolvido",
  "fechado",
] as const;

export const ticketPriorities = ["baixa", "media", "alta", "critica"] as const;

export const userRoles = ["solicitante", "tecnico", "gestor", "administrador"] as const;

export type TicketStatus = (typeof ticketStatuses)[number];
export type TicketPriority = (typeof ticketPriorities)[number];
export type UserRole = (typeof userRoles)[number];

export interface TicketModel {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterId: string;
  assigneeId?: string;
  categoryId: string;
  serviceId?: string;
  assetId?: string;
  departmentId: string;
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  resolvedAt?: string;
  closedAt?: string;
}

export interface SupportUserModel {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string;
  active: boolean;
}

export interface TicketCategoryModel {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface ServiceModel {
  id: string;
  name: string;
  categoryId: string;
  description?: string;
  defaultPriority: TicketPriority;
  active: boolean;
}

export interface AssetModel {
  id: string;
  assetTag: string;
  name: string;
  type: string;
  serialNumber?: string;
  userId?: string;
  departmentId?: string;
  status: "ativo" | "manutencao" | "inativo" | "baixado";
}

export interface DepartmentModel {
  id: string;
  name: string;
  managerId?: string;
  active: boolean;
}

/**
 * Centraliza regras de apresentação. As regras de negócio definitivas
 * serão conectadas ao backend na etapa funcional do domínio de chamados.
 */
export const ticketStatusLabels: Record<TicketStatus, string> = {
  novo: "Novo",
  atribuido: "Atribuído",
  em_atendimento: "Em atendimento",
  aguardando_usuario: "Aguardando usuário",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const ticketPriorityLabels: Record<TicketPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};
