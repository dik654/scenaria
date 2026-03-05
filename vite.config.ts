import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'd3', 'yjs'],
    exclude: ['@blocksuite/store', '@blocksuite/presets', '@blocksuite/blocks'],
  },
  server: {
    port: 3000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
