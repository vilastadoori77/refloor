import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

// WEB-003 invariant: the browser only ever talks to the Inventory Service.
// In dev, /api is proxied to the service on :4100 so the middleware URL never
// reaches the browser. In Azure the service URL is injected at build/deploy.
//
// NOTE: `react()` is cast to PluginOption purely to reconcile a duplicate-vite
// type skew in this workspace (root has vite 5.x, this package declares vite 6.x,
// so @vitejs/plugin-react's Plugin type is resolved against a different vite copy
// than defineConfig's). Behavior is unchanged; a clean single-version install
// makes the cast a no-op.
export default defineConfig({
  plugins: [react() as PluginOption],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.SERVICE_URL ?? 'http://localhost:4100',
        changeOrigin: true,
      },
    },
  },
});
