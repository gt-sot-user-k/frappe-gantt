import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

export default defineConfig({
  define: {
    __GANTT_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'node'
  }
})