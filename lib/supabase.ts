import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

export type ProductRow = {
  id: string;
  name: string;
  supermarkets: string[] | null;
  is_bought: boolean;
  bought_at: string | null;
  created_at: string;
};

export type SupermarketRow = {
  id: string;
  name: string;
  created_at: string;
};

export type TemplateRow = {
  id: string;
  name: string;
  supermarkets: string[] | null;
  purchase_log: string[] | null;
  created_at: string;
};
