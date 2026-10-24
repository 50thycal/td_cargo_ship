import { defineConfig } from 'vite';

// base './' keeps asset paths relative so the built bundle works when wrapped
// in a Capacitor iOS shell (file:// context) as well as any static host.
// Two pages: the classic game (index.html) and V2 (v2.html).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        v2: 'v2.html',
      },
    },
  },
  server: {
    host: true,
  },
});
