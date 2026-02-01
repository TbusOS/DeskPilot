import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'vlm/index': 'src/vlm/index.ts',
    'adapters/index': 'src/adapters/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    '@anthropic-ai/sdk',
    'openai',
    '@nut-tree/nut-js',
    '@computer-use/nut-js',
    'jimp',
  ],
  noExternal: [],
  treeshake: true,
  minify: false,
  target: 'node18',
  outDir: 'dist',
});
