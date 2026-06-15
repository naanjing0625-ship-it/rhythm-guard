import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

/**
 * 单文件 WebGL HTML5 构建
 * 输出: release/RhythmGuard.html（所有 JS/CSS/数据内联，可双击运行）
 */
export default defineConfig({
  base: './',
  plugins: [
    viteSingleFile({
      removeViteModuleLoader: true,
      useRecommendedBuildConfig: true,
    }),
  ],
  build: {
    outDir: 'release',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, 'index.standalone.html'),
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: false },
    },
  },
});
