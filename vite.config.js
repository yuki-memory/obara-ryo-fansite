import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        discography: resolve(__dirname, 'pages/discography.html'),
        discographyDetail: resolve(__dirname, 'pages/discography-detail.html'),
        video: resolve(__dirname, 'pages/video.html'),
        history: resolve(__dirname, 'pages/history.html'),
      },
    },
  },
});
