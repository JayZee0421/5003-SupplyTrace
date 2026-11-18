import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The dev and preview servers proxy API calls to the FastAPI backend.
// Set VITE_BACKEND_URL in .env.local to point at another backend origin.
// For a deployed build, set VITE_API_BASE to the backend origin before building.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const backend = env.VITE_BACKEND_URL || 'http://127.0.0.1:8001'
  const devPort = Number(env.VITE_DEV_PORT || 5173)
  const previewPort = Number(env.VITE_PREVIEW_PORT || 4173)
  const proxy = {
    '/api': { target: backend, changeOrigin: true },
    '/health': { target: backend, changeOrigin: true },
  }

  return {
    plugins: [react()],
    server: {
      port: devPort,
      proxy,
    },
    preview: {
      port: previewPort,
      proxy,
    },
  }
})
