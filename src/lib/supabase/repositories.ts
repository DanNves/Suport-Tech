import { supabase } from "./client";

export async function getActiveCategories() {
  const { data, error } = await supabase.from("ticket_categories").select("*").eq("is_active", true).order("name");
  if (error) throw error;
  return data;
}

export async function getActiveServices() {
  const { data, error } = await supabase.from("service_catalog").select("*").eq("is_active", true).order("name");
  if (error) throw error;
  return data;
}

export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("profiles").select("*, roles(*), departments(*)").eq("id", user.id).single();
  if (error) throw error;
  return data;
}

export async function createTicket(input: { subject: string; description: string; categoryId?: string; serviceId?: string; assetId?: string; priority?: "baixa" | "media" | "alta" | "critica" }) {
  const { data, error } = await supabase.rpc("create_ticket", { p_subject: input.subject, p_description: input.description, p_category_id: input.categoryId ?? null, p_service_id: input.serviceId ?? null, p_asset_id: input.assetId ?? null, p_priority: input.priority ?? null });
  if (error) throw error;
  return data;
}

export async function listMyTickets() {
  const { data, error } = await supabase.from("tickets").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getTicket(ticketId: string) {
  const { data, error } = await supabase.from("tickets").select("*").eq("id", ticketId).single();
  if (error) throw error;
  return data;
}

export async function getTicketHistory(ticketId: string) {
  const { data, error } = await supabase.from("ticket_history").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTicketComments(ticketId: string) {
  const { data, error } = await supabase.from("ticket_comments").select("*").eq("ticket_id", ticketId).eq("is_internal", false).order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function transitionTicket(ticketId: string, status: "novo" | "atribuido" | "em_atendimento" | "aguardando_usuario" | "resolvido" | "fechado") {
  const { data, error } = await supabase.rpc("transition_ticket", { p_ticket_id: ticketId, p_to_status: status });
  if (error) throw error;
  return data;
}

export async function addTicketComment(ticketId: string, body: string, internal = false) {
  const { data, error } = await supabase.rpc("add_ticket_comment", { p_ticket_id: ticketId, p_body: body, p_is_internal: internal });
  if (error) throw error;
  return data;
}
