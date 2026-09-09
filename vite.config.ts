import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  // Railway can expose plain SUPABASE_* variables. Vite client code cannot
  // read process.env directly, so inject the safe public values at build time.
  // Keep VITE_* as a backwards-compatible fallback for local development.
  const env = process.env;
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const authEmail = env.SUPABASE_AUTH_EMAIL || env.VITE_SUPABASE_AUTH_EMAIL || 'admin@ifc.academy';

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': projectRoot } },
    define: {
      __IFC_SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __IFC_SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(supabaseKey),
      __IFC_SUPABASE_AUTH_EMAIL__: JSON.stringify(authEmail),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: { ignored: ['**/src-tauri/**'] },
    },
  };
});
