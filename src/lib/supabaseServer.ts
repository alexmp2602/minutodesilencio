import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE;

export const supabaseServer = createClient(url, service ?? anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
