import { Game } from './ui/game';

// iOS Safari ignores user-scalable=no and touch-action doesn't stop pinch
// zoom; the non-standard gesture events are the only reliable block.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

const app = document.getElementById('app');
if (!app) throw new Error('missing #app root');

new Game(app).start();
