import { defineConfig } from 'vite';

// base './' keeps asset paths relative so the built bundle works when wrapped
// in a Capacitor iOS shell (file:// context) as well as any static host.
// Three pages: the classic game (index.html), V2 (v2.html) and V3 (v3.html).
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
        v3: 'v3.html',
      },
    },
  },
  server: {
    host: true,
  },
});
