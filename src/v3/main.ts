import { App } from './ui/app';

// iOS Safari ignores user-scalable=no; the non-standard gesture events are the
// only reliable way to stop pinch zoom from fighting the taps.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

const root = document.getElementById('app');
if (!root) throw new Error('missing #app root');
new App(root).start();
