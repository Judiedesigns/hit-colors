import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        demos: 'demos/index.html',
        text: 'demos/text/index.html',
        matrix: 'demos/matrix/index.html',
      },
    },
  },
});
