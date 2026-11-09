import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En desarrollo el servidor de Vite hace proxy de /api al backend, de modo que el navegador
// siempre habla con un único origen (plan.md, "Despliegue"; research.md D-02).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
  build: { outDir: 'dist', sourcemap: true },
  test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'] },
});
