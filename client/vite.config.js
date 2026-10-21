import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const frontendPort = Number.parseInt(env.FRONTEND_PORT || '5173', 10)
  const apiOrigin = env.API_ORIGIN || 'http://localhost:5000'

  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
  }
})
