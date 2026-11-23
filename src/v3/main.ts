import { Capacitor } from '@capacitor/core';
import { App } from './ui/app';

// iOS Safari ignores user-scalable=no; the non-standard gesture events are the
// only reliable way to stop pinch zoom from fighting the taps.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

const root = document.getElementById('app');
if (!root) throw new Error('missing #app root');

async function boot(el: HTMLElement): Promise<void> {
  // The iOS app: storage moves to Preferences before the game reads it.
  let app: App | null = null;
  let ready = (): void => undefined;
  if (Capacitor.isNativePlatform()) {
    const native = await import('./platform/native');
    await native.initNative(() => app?.background());
    ready = native.nativeReady;
  }
  app = new App(el);
  app.start();
  requestAnimationFrame(() => ready());
}

void boot(root);
