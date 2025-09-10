import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts'

export default defineConfig({
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
