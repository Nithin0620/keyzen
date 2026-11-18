import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    sourcemap: true,
    external: ['@napi-rs/keyring'],
    banner: { js: '#!/usr/bin/env node' },
  },
]);
