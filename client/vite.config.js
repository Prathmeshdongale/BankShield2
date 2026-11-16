import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    // __API_BASE_URL__ is a plain global — not intercepted by Vite's env handling.
    // Always set to the Render URL in production builds.
    // In dev: empty string → api.js falls back to '/api' (Vite proxy).
    __API_BASE_URL__: JSON.stringify(
      process.env.VITE_API_URL ||
      (mode === 'production' ? 'https://bankshield-api-5m3j.onrender.com/api' : '')
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    // Recharts (~400 kB min+gz) lands in the Dashboard chunk; suppress noisy warning.
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
}))
