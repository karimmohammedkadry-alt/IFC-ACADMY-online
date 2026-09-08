import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const env = (globalThis as any).process?.env ?? {};
  return ({
  // Railway variables intentionally use plain SUPABASE_* names. Vite does not expose
  // unprefixed variables to browser code, so we inject only the public values at build time.
  define: {
    __IFC_SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL || ''),
    __IFC_SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY || ''),
    __IFC_SUPABASE_AUTH_EMAIL__: JSON.stringify(env.SUPABASE_AUTH_EMAIL || 'admin@ifc.academy'),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
  server: {
    hmr: env.DISABLE_HMR !== 'true',
    watch: { ignored: ['**/src-tauri/**'] },
  },
  });
});
