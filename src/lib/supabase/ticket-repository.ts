import { supabase } from "./client";

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
