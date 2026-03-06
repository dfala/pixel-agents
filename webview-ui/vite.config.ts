import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
  },
  base: './',
  server: {
    proxy: {
      '/assets': {
        target: 'http://localhost:4800',
      },
    },
  },
})
