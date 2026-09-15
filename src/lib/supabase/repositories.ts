import { supabase } from "./client";
import { normalizeSupportError } from "../error-handling";
import type { RealtimeChannel } from "@supabase/supabase-js";

const EXPECTED_SUPABASE_HOST = "afylrvytkpmetzmeosvb.supabase.co";

function throwRepositoryError(error: unknown, operation: string, fallback: string): never {
  throw normalizeSupportError(error, operation, fallback);
}

function assertSupportechEnvironment(operation: string) {
  const configuredUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  let host = "não configurado";
  try { if (configuredUrl) host = new URL(configuredUrl).host; } catch { host = "URL inválida"; }
  if (host !== EXPECTED_SUPABASE_HOST) {
    const error = new Error(`Projeto Supabase incorreto no ambiente do Supportech: ${host}`) as Error & { code: string; status?: number };
    error.code = "SUPABASE_PROJECT_MISMATCH";
    error.status = 503;
    throwRepositoryError(error, operation, "O ambiente do Supportech está apontando para o projeto Supabase incorreto.");
  }
}

async function assertAuthenticated(operation: string) {
  assertSupportechEnvironment(operation);
  const { data, error } = await supabase.auth.getSession();
  if (error) throwRepositoryError(error, `${operation}.session`, "Não foi possível validar sua sessão.");
  if (!data.session?.user) {
    const error = new Error("Sessão autenticada não encontrada para executar a operação.") as Error & { code: string; status?: number };
    error.code = "SESSION_MISSING";
    error.status = 401;
    throwRepositoryError(error, `${operation}.session`, "Sua sessão não está ativa. Entre novamente no sistema.");
  }
  return data.session;
}

export async function getActiveCategories() {
  const { data, error } = await supabase.from("ticket_categories").select("*").eq("is_active", true).order("name");
  if (error) throwRepositoryError(error, "catalog.categories.list", "Não foi possível carregar as categorias.");
  return data;
}

export async function getActiveServices() {
  const { data, error } = await supabase.from("service_catalog").select("*").eq("is_active", true).order("name");
  if (error) throwRepositoryError(error, "catalog.services.list", "Não foi possível carregar os serviços.");
  return data;
}

export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("profiles").select("*, roles(*), departments(*)").eq("id", user.id).single();
  if (error) throwRepositoryError(error, "profile.get_current", "Não foi possível carregar seu perfil de acesso.");
  return data;
}

export async function createTicket(input: { subject: string; description: string; categoryId?: string; serviceId?: string; assetId?: string; priority?: "baixa" | "media" | "alta" | "critica" }) {
  await assertAuthenticated("tickets.create");
  const { data, error } = await supabase.rpc("create_ticket" as never, { p_subject: input.subject, p_description: input.description, p_category_id: input.categoryId ?? null, p_service_id: input.serviceId ?? null, p_asset_id: input.assetId ?? null, p_priority: input.priority ?? null } as never);
  if (error) throwRepositoryError(error, "tickets.create", "Não foi possível abrir o chamado.");
  return data;
}

export async function listMyTickets() {
  await assertAuthenticated("tickets.list");
  const { data, error } = await supabase.rpc("get_my_tickets" as never);
  if (error) throwRepositoryError(error, "tickets.list", "Não foi possível carregar os chamados.");
  return data;
}

export async function getTicket(ticketId: string) {
  const { data, error } = await supabase.from("tickets").select("*").eq("id", ticketId).single();
  if (error) throwRepositoryError(error, "tickets.get", "Não foi possível carregar o chamado.");
  return data;
}

export async function getTicketDetails(ticketId: string) {
  const { data, error } = await supabase.rpc("get_ticket_details" as never, { p_ticket_id: ticketId } as never);
  if (error) throwRepositoryError(error, "tickets.details.get", "Não foi possível carregar os detalhes do chamado.");
  return data as never;
}

export async function getSupportStaff() {
  const { data, error } = await supabase.rpc("get_support_staff" as never);
  if (error) throwRepositoryError(error, "staff.list", "Não foi possível carregar os técnicos e atendentes.");
  return data;
}

export async function assignTicket(ticketId: string, assigneeId: string, note?: string) {
  const { data, error } = await supabase.rpc("assign_ticket" as never, { p_ticket_id: ticketId, p_assignee_id: assigneeId, p_note: note ?? null } as never);
  if (error) throwRepositoryError(error, "tickets.assign", "Não foi possível atribuir o chamado.");
  return data;
}

export async function updateTicket(input: { ticketId: string; subject?: string; description?: string; categoryId?: string | null; serviceId?: string | null; priority?: "baixa" | "media" | "alta" | "critica" | null }) {
  const { data, error } = await supabase.rpc("update_ticket" as never, { p_ticket_id: input.ticketId, p_subject: input.subject ?? null, p_description: input.description ?? null, p_category_id: input.categoryId ?? null, p_service_id: input.serviceId ?? null, p_priority: input.priority ?? null } as never);
  if (error) throwRepositoryError(error, "tickets.update", "Não foi possível atualizar o chamado.");
  return data;
}

export async function transitionTicket(ticketId: string, status: "novo" | "atribuido" | "em_atendimento" | "aguardando_usuario" | "resolvido" | "fechado") {
  const { data, error } = await supabase.rpc("transition_ticket" as never, { p_ticket_id: ticketId, p_to_status: status } as never);
  if (error) throwRepositoryError(error, "tickets.transition", "Não foi possível atualizar o status do chamado.");
  return data;
}

export async function addTicketComment(ticketId: string, body: string, internal = false) {
  const { data, error } = await supabase.rpc("add_ticket_comment" as never, { p_ticket_id: ticketId, p_body: body, p_is_internal: internal } as never);
  if (error) throwRepositoryError(error, "tickets.comments.create", "Não foi possível registrar o comentário.");
  return data;
}

export async function deleteTicketForTesting(ticketId: string) {
  await assertAuthenticated("tickets.delete_testing");
  const { data, error } = await supabase.rpc("delete_ticket_for_testing" as never, { p_ticket_id: ticketId } as never);
  if (error) throwRepositoryError(error, "tickets.delete_testing", "Não foi possível excluir o chamado de teste.");
  return data;
}

export function subscribeToTicketChanges(onChange: () => void): RealtimeChannel {
  return supabase.channel("supportech-tickets")
    .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "ticket_assignments" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "ticket_comments" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "ticket_history" }, onChange)
    .subscribe();
}
