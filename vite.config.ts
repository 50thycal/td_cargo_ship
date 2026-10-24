import { defineConfig } from 'vite';

// base './' keeps asset paths relative so the built bundle works when wrapped
// in a Capacitor iOS shell (file:// context) as well as any static host.
// Two pages: the classic game (index.html) and V2 (v2.html).
export default defineConfig({
  base: './',
  // Stamped into V2 playtest logs so a log says which build produced it.
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16)) },
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
