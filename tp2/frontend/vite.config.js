import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // En dev, las llamadas a /api se proxean al backend local (dotnet run → :8080).
    // En producción (contenedor) el mismo rol lo cumple el proxy_pass de nginx.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
