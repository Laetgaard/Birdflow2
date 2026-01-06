import { createClient } from "@supabase/supabase-js";

let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    const supabaseUrl = (window as any).__SUPABASE_URL__ || "";
    const supabaseAnonKey = (window as any).__SUPABASE_ANON_KEY__ || "";
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

export async function getTotalCreators(): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return 1247;
    }
    
    const { data, error } = await supabase
      .from("public_stats")
      .select("total_creators")
      .limit(1)
      .single();

    if (error || !data) {
      console.error("Error fetching stats:", error);
      return 1247;
    }

    return (data as { total_creators: number }).total_creators || 1247;
  } catch (err) {
    console.error("Error fetching stats:", err);
    return 1247;
  }
}
