import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = (window as any).__SUPABASE_URL__ || "";
    const supabaseAnonKey = (window as any).__SUPABASE_ANON_KEY__ || "";
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase not configured");
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  
  return supabaseInstance;
}
