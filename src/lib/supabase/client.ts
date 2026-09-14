import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.warn("Supabase: VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY não configuradas. O preview continuará carregando, mas operações de dados ficarão indisponíveis até configurar o ambiente.");
}

// O cliente recebe valores sintaticamente válidos mesmo durante o preview sem .env,
// evitando que o createClient lance uma exceção no carregamento do bundle.
export const supabase = createClient<Database>(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "preview-placeholder-key",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

export { isConfigured as supabaseConfigured };
