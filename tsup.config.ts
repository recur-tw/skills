import { defineConfig } from 'tsup'

export default defineConfig([
  // Library
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
  },
  // CLI
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    banner: {
      js: '#!/usr/bin/env node',
    },
    shims: true,
  },
])
