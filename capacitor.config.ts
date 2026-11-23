import type { CapacitorConfig } from '@capacitor/cli';

// The iOS app (App Store build). `npm run ios:sync` builds the store flavour
// into dist/ and copies it into ios/. See docs/APP_STORE_HANDOFF.md.
const config: CapacitorConfig = {
  appId: 'com.appfarm.straitwatch',
  appName: 'Straitwatch',
  webDir: 'dist',
  // Everything is bundled: no server URL, no remote content.
  ios: {
    contentInset: 'never',
    backgroundColor: '#070d12',
    // No link previews or text-selection menus in a game.
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#070d12',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: true,
    },
  },
};

export default config;
