import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { precachePlugin } from './src/pwa/precachePlugin'

export default defineConfig({
  base: './',
  plugins: [react(), precachePlugin()],
  build: {
    rollupOptions: {
      // The service worker is a second entry, emitted as /sw.js (not hashed: the browser looks for it at a fixed address).
      input: { index: 'index.html', sw: 'src/pwa/sw.ts' },
      output: { entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js') },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
})
