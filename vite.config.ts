import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// base './' keeps asset paths relative so the built bundle works when wrapped
// in a Capacitor iOS shell (capacitor://localhost) as well as any static host.
//
// Two flavours (src/v3/platform/flavor.ts):
// - playtest (default `vite build`): three pages, the classic game
//   (index.html), V2 (v2.html) and V3 (v3.html). This is the Vercel build.
// - store (`vite build --mode store`, `npm run build:store`): the App Store
//   bundle. V3 alone, emitted as dist/index.html, with no playtest notes, log
//   upload or developer mode, and no code that talks to a server.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Store build: v3.html becomes the bundle's only page, index.html, and is
 *  marked so a preflight can tell which flavour it holds. */
function storePage(): Plugin {
  return {
    name: 'straitwatch-store-page',
    enforce: 'post',
    transformIndexHtml: (html) =>
      html
        .replace('<title>Straitwatch V3</title>', '<title>Straitwatch</title>')
        .replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <meta name="app-flavor" content="store" />'),
    generateBundle(_, bundle) {
      const page = bundle['v3.html'];
      if (page) {
        page.fileName = 'index.html';
        delete bundle['v3.html'];
        bundle['index.html'] = page;
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const store = mode === 'store';
  return {
    base: './',
    define: {
      // Stamped into playtest logs so a log says which build produced it.
      __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16)),
      __STORE__: JSON.stringify(store),
      __VERSION__: JSON.stringify(pkg.version),
    },
    plugins: store ? [storePage()] : [],
    resolve: {
      // The store bundle keeps playtest logs nowhere and sends them nowhere:
      // the upload module is swapped for one that does nothing.
      alias: store ? [{ find: /^(\.\.?\/)+(.*\/)?platform\/playlogStore$/, replacement: new URL('./src/v3/platform/playlogStore.store.ts', import.meta.url).pathname }] : [],
    },
    build: {
      target: 'es2022',
      outDir: 'dist',
      rollupOptions: {
        input: (store ? { v3: 'v3.html' } : { main: 'index.html', v2: 'v2.html', v3: 'v3.html' }) as Record<string, string>,
      },
    },
    server: {
      host: true,
    },
  };
});
