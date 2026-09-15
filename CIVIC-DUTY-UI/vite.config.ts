import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    proxy: {
      // Dev proxy → the real Express backend (ts-node src/server.ts). Override
      // with VITE_API_PROXY=http://host:port if the backend runs elsewhere.
      '/api': process.env.VITE_API_PROXY || 'http://localhost:3001',
    },
  },
})
