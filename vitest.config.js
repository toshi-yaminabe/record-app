import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.js', 'app/api/**/*.js'],
      exclude: [
        'lib/prisma.js',
        'lib/gemini.js',
        'lib/supabase.js',
        'lib/rate-limit.js',
        'lib/logger.js',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
