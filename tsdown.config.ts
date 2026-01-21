import { defineConfig } from 'tsdown'

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
    outputOptions: {
      banner: '#!/usr/bin/env node\n',
    },
  },
])
