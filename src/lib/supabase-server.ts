import { createClient } from '@supabase/supabase-js';
export const supabaseServer=createClient(
  process.env.SUPABASE_URL || 'https://invalid.local',
  process.env.SUPABASE_SECRET_KEY || 'invalid',
  {auth:{persistSession:false,autoRefreshToken:false}}
);
