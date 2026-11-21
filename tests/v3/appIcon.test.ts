import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// The home-screen icon (iPhone "Add to Home Screen" reads apple-touch-icon;
// Android and desktop read the web manifest).
describe('app icon', () => {
  for (const page of ['index.html', 'v3.html']) {
    it(`${page} links the touch icon, favicon and manifest`, () => {
      const html = readFileSync(page, 'utf8');
      expect(html).toContain('rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png"');
      expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
      expect(html).toContain('name="apple-mobile-web-app-title" content="Straitwatch"');
    });
  }
  it('every icon file the pages and manifest name is shipped', () => {
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(m.start_url).toBe('/v3.html');
    const files = ['/icons/apple-touch-icon.png', '/icons/favicon-32.png', ...m.icons.map((i: { src: string }) => i.src)];
    for (const f of files) expect(existsSync(`public${f}`), f).toBe(true);
  });
});
