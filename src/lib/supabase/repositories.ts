import { supabase } from "./client";
import { normalizeSupportError } from "../error-handling";
import type { RealtimeChannel } from "@supabase/supabase-js";
const EXPECTED_SUPABASE_HOST = "afylrvytkpmetzmeosvb.supabase.co";
function toIsoDate(value?: string | null): string | null { if (!value) return null; const v = value.trim(); if (!v) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (br) return `${br[3]}-${br[2]}-${br[1]}`; if (/^\d{4}$/.test(v)) return `${v}-12-31`; const e = Object.assign(new Error(`Data inválida: ${v}`), { code: "INVALID_DATE" }); throw normalizeSupportError(e, "assets.date", `A data "${v}" é inválida. Use o formato dia/mês/ano.`); }
function throwRepositoryError(error: unknown, operation: string, fallback: string): never { throw normalizeSupportError(error, operation, fallback); }
async function assertAuthenticated(operation: string) { const configuredUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined; let host = "não configurado"; try { if (configuredUrl) host = new URL(configuredUrl).host; } catch { host = "URL inválida"; } if (host !== EXPECTED_SUPABASE_HOST) { const e = Object.assign(new Error(`Projeto Supabase incorreto no ambiente do SuportTech: ${host}`), { code: "SUPABASE_PROJECT_MISMATCH", status: 503 }); throwRepositoryError(e, operation, "O ambiente do SuportTech está apontando para o projeto Supabase incorreto."); } const { data, error } = await supabase.auth.getSession(); if (error) throwRepositoryError(error, `${operation}.session`, "Não foi possível validar sua sessão."); if (!data.session?.user) { const e = Object.assign(new Error("Sessão autenticada não encontrada."), { code: "SESSION_MISSING", status: 401 }); throwRepositoryError(e, `${operation}.session`, "Sua sessão não está ativa. Entre novamente no sistema."); } return data.session; }
export async function getActiveCategories() { const { data, error } = await supabase.from("ticket_categories").select("*").eq("is_active", true).order("name"); if (error) throwRepositoryError(error, "catalog.categories.list", "Não foi possível carregar as categorias."); return data; }
export async function getActiveServices() { const { data, error } = await supabase.from("service_catalog").select("*").eq("is_active", true).order("name"); if (error) throwRepositoryError(error, "catalog.services.list", "Não foi possível carregar os serviços."); return data; }
export async function getActiveDepartments() { const { data, error } = await supabase.from("departments").select("id,name,code").eq("is_active", true).order("name"); if (error) throwRepositoryError(error, "catalog.departments.list", "Não foi possível carregar os setores."); return data; }
export async function getMyProfile() { const { data: { user } } = await supabase.auth.getUser(); if (!user) return null; const { data, error } = await supabase.from("profiles").select("*,roles(*),departments(*)").eq("id", user.id).single(); if (error) throwRepositoryError(error, "profile.get_current", "Não foi possível carregar seu perfil de acesso."); return data as any; }
export async function listProfiles() { await assertAuthenticated("users.list"); const { data, error } = await supabase.from("profiles").select("id,full_name,email,job_title,phone,is_active,last_seen_at,created_at,role_id,department_id,roles(key,name),departments(name,code)").order("full_name"); if (error) throwRepositoryError(error, "users.list", "Não foi possível carregar os usuários."); return data as any[]; }
export async function createUserAdmin(input: { fullName: string; email: string; jobTitle?: string; phone?: string; roleId: string; departmentId?: string | null }) { await assertAuthenticated("users.create"); const { data, error } = await supabase.functions.invoke("admin-create-user", { body: input }); if (error) throwRepositoryError(error, "users.create", "Não foi possível cadastrar o usuário."); if ((data as any)?.error) { const e = Object.assign(new Error((data as any).error), { code: (data as any).code ?? "USER_CREATE_FAILED" }); throwRepositoryError(e, "users.create", "Não foi possível cadastrar o usuário."); } return data; }
export async function resetUserPasswordAdmin(userId: string) {
  await assertAuthenticated("users.password.reset");
  const { data, error } = await supabase.functions.invoke("admin-reset-user-password", { body: { userId } });
  if (error) throwRepositoryError(error, "users.password.reset", "Não foi possível enviar o link de redefinição.");
  if ((data as any)?.error) {
    const e = Object.assign(new Error((data as any).error), { code: (data as any).code ?? "PASSWORD_RESET_FAILED" });
    throwRepositoryError(e, "users.password.reset", "Não foi possível enviar o link de redefinição.");
  }
  return data;
}

export async function updateProfileAdmin(input: { id: string; fullName?: string; email?: string | null; jobTitle?: string | null; phone?: string | null; roleId?: string; departmentId?: string | null; isActive?: boolean }) {
  await assertAuthenticated("users.update");
  const { data, error } = await supabase.functions.invoke("admin-update-user", { body: input });
  if (error) throwRepositoryError(error, "users.update", "Não foi possível atualizar o usuário.");
  if ((data as any)?.error) {
    const e = Object.assign(new Error((data as any).error), { code: (data as any).code ?? "USER_UPDATE_FAILED" });
    throwRepositoryError(e, "users.update", "Não foi possível atualizar o usuário.");
  }
  return (data as any)?.profile;
}
const RESEND_FRIENDLY: Record<string, string> = {
  NOT_ELIGIBLE: "Não foi possível localizar uma conta de autenticação válida para este usuário.",
  INVITE_NOT_ELIGIBLE: "O acesso não pode ser reenviado para esta conta.",
  AUTH_EMAIL_RATE_LIMITED: "Limite de envio de e-mails atingido. Aguarde alguns minutos e tente novamente.",
  RATE_LIMITED: "Um acesso já foi reenviado há poucos instantes. Aguarde para tentar novamente.",
  ACCESS_RESEND_FAILED: "Não foi possível reenviar o acesso por e-mail. Verifique a configuração de e-mail do projeto.",
};
export async function resendUserInviteAdmin(userId: string) {
  await assertAuthenticated("users.invite.resend");
  const { data, error } = await supabase.functions.invoke("admin-create-user", { body: { action: "resend_invite", userId } });
  let payload: any = data;
  if (error) {
    try { payload = await (error as any)?.context?.json?.(); } catch { payload = null; }
    if (!payload?.error) throwRepositoryError(error, "users.invite.resend", "Não foi possível reenviar o acesso.");
  }
  if (payload?.error) {
    const code = String(payload.code ?? "INVITE_RESEND_FAILED");
    throw Object.assign(new Error(RESEND_FRIENDLY[code] ?? payload.error), { code });
  }
  return payload;
}

export async function listAuditLog(filters?: { action?: string; entityType?: string; limit?: number }) {
  await assertAuthenticated("audit.list");
  let query = (supabase.from("audit_log") as any).select("id,actor_id,action,entity_type,entity_id,metadata,created_at").order("created_at", { ascending: false }).limit(Math.min(filters?.limit ?? 100, 200));
  if (filters?.action) query = query.eq("action", filters.action);
  if (filters?.entityType) query = query.eq("entity_type", filters.entityType);
  const { data, error } = await query;
  if (error) throwRepositoryError(error, "audit.list", "Não foi possível carregar a auditoria.");
  const rows = (data ?? []) as any[];
  const actorIds = Array.from(new Set(rows.map(r => r.actor_id).filter(Boolean)));
  let actors: Record<string, string> = {};
  if (actorIds.length > 0) {
    const { data: profiles } = await (supabase.from("profiles") as any).select("id,full_name,email").in("id", actorIds);
    actors = Object.fromEntries(((profiles ?? []) as any[]).map(p => [p.id, p.full_name ?? p.email ?? "—"]));
  }
  return rows.map(r => ({ ...r, actor_name: r.actor_id ? (actors[r.actor_id] ?? "Usuário removido") : "Sistema" }));
}

export async function listAllDepartments() { await assertAuthenticated("management.departments.list"); const { data, error } = await supabase.from("departments").select("id,name,code,description,is_active,created_at,updated_at").order("name"); if (error) throwRepositoryError(error, "management.departments.list", "Não foi possível carregar os setores."); return data as any[]; }
export async function createDepartment(input: { name: string; code: string; description?: string }) { await assertAuthenticated("management.departments.create"); const payload = { name: input.name.trim(), code: input.code.trim().toUpperCase(), description: input.description?.trim() || null, is_active: true }; const { data, error } = await (supabase.from("departments") as any).insert(payload).select().single(); if (error) throwRepositoryError(error, "management.departments.create", "Não foi possível cadastrar o setor."); return data; }
export async function updateDepartment(input: { id: string; name: string; code: string; description?: string; isActive: boolean }) { await assertAuthenticated("management.departments.update"); const payload = { name: input.name.trim(), code: input.code.trim().toUpperCase(), description: input.description?.trim() || null, is_active: input.isActive }; const { data, error } = await (supabase.from("departments") as any).update(payload).eq("id", input.id).select().single(); if (error) throwRepositoryError(error, "management.departments.update", "Não foi possível atualizar o setor."); return data; }
export async function getAppSettings() {
  await assertAuthenticated("settings.list");
  const { data, error } = await supabase
    .from("app_settings")
    .select("key,value,description,updated_at")
    .order("key");
  if (error) throwRepositoryError(error, "settings.list", "Não foi possível carregar as configurações.");
  return (data ?? []) as any[];
}

export async function updateAppSetting(key: string, value: Record<string, unknown>) {
  await assertAuthenticated("settings.update");
  const { data, error } = await supabase.functions.invoke("admin-update-settings", {
    body: { key, value },
  });
  if (error) throwRepositoryError(error, "settings.update", "Não foi possível salvar a configuração.");
  if ((data as any)?.error) {
    const e = Object.assign(new Error((data as any).error), {
      code: (data as any).code ?? "SETTINGS_UPDATE_FAILED",
    });
    throwRepositoryError(e, "settings.update", "Não foi possível salvar a configuração.");
  }
  return (data as any)?.setting;
}

export async function getRoles() { await assertAuthenticated("users.roles.list"); const { data, error } = await supabase.from("roles").select("id,key,name,description,is_active").eq("is_active", true).order("name"); if (error) throwRepositoryError(error, "users.roles.list", "Não foi possível carregar os perfis de acesso."); return data; }
export async function listAssets() { await assertAuthenticated("assets.list"); const { data, error } = await supabase.from("assets").select("id,asset_tag,name,asset_type,manufacturer,model,serial_number,status,location,notes,warranty_until,department_id,assigned_user_id,created_at,updated_at,departments(name,code),profiles!assets_assigned_user_id_fkey(id,full_name,email)").order("created_at", { ascending: false }); if (error) throwRepositoryError(error, "assets.list", "Não foi possível carregar os ativos."); return data as any[]; }
export async function listTicketAssets() {
  await assertAuthenticated("assets.ticket_list");
  const { data, error } = await supabase
    .from("assets")
    .select("id,asset_tag,name,asset_type,status,department_id")
    .neq("status", "baixado")
    .order("asset_tag");
  if (error) throwRepositoryError(error, "assets.ticket_list", "Não foi possível carregar os ativos para o chamado.");
  return data as any[];
}
export async function createAsset(input: { name: string; assetType: string; manufacturer?: string; model?: string; serialNumber?: string; departmentId?: string; assignedUserId?: string; status: "ativo" | "em_manutencao" | "inativo" | "baixado"; location?: string; notes?: string; warrantyUntil?: string }) {
  await assertAuthenticated("assets.create");
  const payload = {
    name: input.name.trim(),
    asset_type: input.assetType.trim(),
    manufacturer: input.manufacturer?.trim() || null,
    model: input.model?.trim() || null,
    serial_number: input.serialNumber?.trim() || null,
    department_id: input.departmentId || null,
    assigned_user_id: input.assignedUserId || null,
    status: input.status,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    warranty_until: toIsoDate(input.warrantyUntil),
  };
  const { data, error } = await (supabase.from("assets") as any)
    .insert(payload)
    .select()
    .single();
  if (!error) return data;
  throwRepositoryError(error, "assets.create", "Não foi possível cadastrar o ativo.");
}
export async function updateAsset(input: { id: string; name: string; assetType: string; manufacturer?: string; model?: string; serialNumber?: string; departmentId?: string; assignedUserId?: string; status: "ativo" | "em_manutencao" | "inativo" | "baixado"; location?: string; notes?: string; warrantyUntil?: string }) {
  await assertAuthenticated("assets.update");
  const { data, error } = await (supabase.rpc as any)("update_asset_v2", {
    p_id: input.id,
    p_name: input.name,
    p_asset_type: input.assetType,
    p_manufacturer: input.manufacturer || null,
    p_model: input.model || null,
    p_serial_number: input.serialNumber || null,
    p_department_id: input.departmentId || null,
    p_assigned_user_id: input.assignedUserId || null,
    p_status: input.status,
    p_location: input.location || null,
    p_notes: input.notes || null,
    p_warranty_until: toIsoDate(input.warrantyUntil),
  });
  if (error) throwRepositoryError(error, "assets.update", "Não foi possível atualizar o ativo.");
  return data;
}
export async function deleteAsset(id: string) { await assertAuthenticated("assets.delete"); const { data, error } = await (supabase.rpc as any)("delete_asset", { p_id: id }); if (error) throwRepositoryError(error, "assets.delete", "Não foi possível excluir o ativo."); return data; }
export async function createTicket(input: { subject: string; description: string; categoryId?: string; serviceId?: string; assetId?: string; departmentId: string; priority?: "baixa" | "media" | "alta" | "critica" }) { await assertAuthenticated("tickets.create"); const { data, error } = await (supabase.rpc as any)("create_ticket", { p_subject: input.subject, p_description: input.description, p_category_id: input.categoryId ?? null, p_service_id: input.serviceId ?? null, p_asset_id: input.assetId ?? null, p_priority: input.priority ?? null, p_department_id: input.departmentId }); if (error) throwRepositoryError(error, "tickets.create", "Não foi possível abrir o chamado."); return data; }
export async function listOperationalReportTickets(startDate?: string, endDate?: string) {
  await assertAuthenticated("reports.tickets.list");
  let query = (supabase.from("tickets") as any)
    .select("id,ticket_number,subject,status,priority,created_at,first_response_at,resolved_at,closed_at,response_due_at,resolution_due_at,sla_response_breached,sla_resolution_breached,department_id,departments(name,code)")
    .order("created_at", { ascending: true })
    .limit(5000);
  if (startDate) query = query.gte("created_at", `${startDate}T00:00:00-03:00`);
  if (endDate) query = query.lt("created_at", `${endDate}T00:00:00-03:00`);
  const { data, error } = await query;
  if (error) throwRepositoryError(error, "reports.tickets.list", "Não foi possível carregar os dados dos relatórios.");
  return (data ?? []) as any[];
}

export async function listMyTickets() { await assertAuthenticated("tickets.list"); const { data, error } = await (supabase.rpc as any)("get_my_tickets"); if (error) throwRepositoryError(error, "tickets.list", "Não foi possível carregar os chamados."); return data; }
export async function getTicket(ticketId: string) { const { data, error } = await supabase.from("tickets").select("*").eq("id", ticketId).single(); if (error) throwRepositoryError(error, "tickets.get", "Não foi possível carregar o chamado."); return data; }
export async function getTicketDetails(ticketId: string) { const { data, error } = await (supabase.rpc as any)("get_ticket_details", { p_ticket_id: ticketId }); if (error) throwRepositoryError(error, "tickets.details.get", "Não foi possível carregar os detalhes do chamado."); return data; }
export async function getSupportStaff() { const profile = await getMyProfile(); const roles = profile?.roles as { key?: string } | { key?: string }[] | null | undefined; const roleKey = Array.isArray(roles) ? roles[0]?.key : roles?.key; if (!roleKey || roleKey === "requester") return []; const { data, error } = await (supabase.rpc as any)("get_support_staff"); if (error) throwRepositoryError(error, "staff.list", "Não foi possível carregar os técnicos e atendentes."); return data; }
export async function assignTicket(ticketId: string, assigneeId: string, note?: string) { const { data, error } = await (supabase.rpc as any)("assign_ticket", { p_ticket_id: ticketId, p_assignee_id: assigneeId, p_note: note ?? null }); if (error) throwRepositoryError(error, "tickets.assign", "Não foi possível atribuir o chamado."); return data; }
export async function updateTicket(input: { ticketId: string; subject?: string; description?: string; categoryId?: string | null; serviceId?: string | null; priority?: "baixa" | "media" | "alta" | "critica" | null }) { const { data, error } = await (supabase.rpc as any)("update_ticket", { p_ticket_id: input.ticketId, p_subject: input.subject ?? null, p_description: input.description ?? null, p_category_id: input.categoryId ?? null, p_service_id: input.serviceId ?? null, p_priority: input.priority ?? null }); if (error) throwRepositoryError(error, "tickets.update", "Não foi possível atualizar o chamado."); return data; }
export async function transitionTicket(ticketId: string, status: "novo" | "atribuido" | "em_atendimento" | "aguardando_usuario" | "resolvido" | "fechado") { const { data, error } = await (supabase.rpc as any)("transition_ticket", { p_ticket_id: ticketId, p_to_status: status }); if (error) throwRepositoryError(error, "tickets.transition", "Não foi possível atualizar o status do chamado."); return data; }
export async function addTicketComment(ticketId: string, body: string, internal = false) { const { data, error } = await (supabase.rpc as any)("add_ticket_comment", { p_ticket_id: ticketId, p_body: body, p_is_internal: internal }); if (error) throwRepositoryError(error, "tickets.comments.create", "Não foi possível registrar o comentário."); return data; }
export async function getTicketComments(ticketId: string) { const { data, error } = await (supabase.from("ticket_comments") as any).select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false }); if (error) throwRepositoryError(error, "tickets.comments.list", "Não foi possível carregar os comentários."); return data; }
export async function getTicketHistory(ticketId: string) { const { data, error } = await (supabase.from("ticket_history") as any).select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false }); if (error) throwRepositoryError(error, "tickets.history.list", "Não foi possível carregar o histórico."); return data; }
export async function deleteTicketForTesting(ticketId: string) { await assertAuthenticated("tickets.delete_testing"); const { data, error } = await (supabase.rpc as any)("delete_ticket_for_testing", { p_ticket_id: ticketId }); if (error) throwRepositoryError(error, "tickets.delete_testing", "Não foi possível excluir o chamado de teste."); return data; }
export function subscribeToTicketChanges(onChange: () => void, onError?: (message: string) => void): RealtimeChannel { const channel = supabase.channel(`supportech-tickets-${crypto.randomUUID()}`); channel.on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, onChange).on("postgres_changes", { event: "*", schema: "public", table: "ticket_assignments" }, onChange).on("postgres_changes", { event: "*", schema: "public", table: "ticket_comments" }, onChange).on("postgres_changes", { event: "*", schema: "public", table: "ticket_history" }, onChange).subscribe(status => { if (status === "CHANNEL_ERROR") onError?.("A atualização em tempo real do atendimento encontrou um erro de conexão."); if (status === "TIMED_OUT") onError?.("A atualização em tempo real demorou para conectar."); }); return channel; }
