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
