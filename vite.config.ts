import { defineConfig } from 'vite';

// base './' keeps asset paths relative so the built bundle works when wrapped
// in a Capacitor iOS shell (file:// context) as well as any static host.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  server: {
    host: true,
  },
});
