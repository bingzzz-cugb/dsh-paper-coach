import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const stubPath = resolve(__dirname, 'tests/dsh-tools-shim.ts')

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-tools': stubPath,
    },
  },
  test: {
    environment: 'node',
  },
})
