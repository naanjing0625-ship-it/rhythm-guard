import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Rhythm Guard',
        short_name: 'RhythmGuard',
        description: '音乐节奏 × 合成塔防',
        theme_color: '#1a0a2e',
        background_color: '#0d0618',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,wav,mp3,ogg}'],
      },
    }),
  ],
  server: { port: 5173, open: true },
});
