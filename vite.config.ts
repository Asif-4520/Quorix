import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  ?.TAURI_DEV_HOST;

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  build: {
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /[/\\]node_modules[/\\](react|react-dom|scheduler)[/\\]/,
            },
            { name: 'vendor-codemirror', test: /@codemirror|@lezer/ },
            { name: 'vendor-xyflow', test: /@xyflow|@dagrejs/ },
            { name: 'vendor-tanstack', test: /@tanstack/ },
            {
              name: 'vendor-ui',
              test: /[/\\]node_modules[/\\](lucide-react|sonner|sql-formatter|zustand|@tauri-apps)[/\\]/,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
}));
