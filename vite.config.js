import { resolve } from 'path';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  define: {
    __GANTT_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    dts()
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'Gantt',
      formats: ['es', 'umd', 'cjs'],
      fileName: (format) => {
        if (format === 'cjs') return 'index.js';
        return `gantt.${format}.js`;
      },
    },
    rollupOptions: {
      output: {
        assetFileNames: 'gantt[extname]',
        interop: 'auto',
      }
    },
  },
  server: {
    watch: {
      include: ['dist/**', 'src/**'],
    },
  },
});
