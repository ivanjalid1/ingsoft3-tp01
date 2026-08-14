import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, el dev server hace de proxy: /api/productos sale del
    // navegador al puerto 5173 y Vite lo reenvía al backend en el 3000.
    // Es lo mismo que hace nginx en producción, así que el código del
    // frontend no cambia entre dev y prod.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true }
    }
  },
  test: { environment: 'jsdom', globals: true, setupFiles: './tests/setup.js' }
});
