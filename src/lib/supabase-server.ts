import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || supabaseSecretKey;

if (!supabaseUrl) throw new Error('SUPABASE_URL is required on the server.');
if (!supabaseSecretKey) throw new Error('SUPABASE_SECRET_KEY is required on the server.');

// Server-only client. The secret key must NEVER be exposed to the browser.
export const supabaseServer = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Separate auth client: uses the publishable key when available and never persists a browser session.
export const supabaseAuth = createClient(supabaseUrl, supabasePublishableKey!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
