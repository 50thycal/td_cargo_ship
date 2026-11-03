// The iOS app's side of the platform: loaded only when Capacitor reports a
// native platform (main.ts imports it dynamically, so the web builds never
// run any of it). It moves storage to Preferences, then wires haptics, the
// full-game purchase, Game Center, pause-on-background and the splash screen.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { flushStore, initNativeStore } from './store';
import { setHapticBackend } from './haptics';
import { PRODUCT_ID, setPurchaseBackend } from './unlock';
import { setGameCenterBackend, type GameCenterBackend } from './gamecenter';

/** ios/App/App/GameCenterPlugin.swift */
interface GameCenterPlugin {
  authenticate(): Promise<{ authenticated: boolean }>;
  submitScore(o: { leaderboardId: string; score: number }): Promise<void>;
  reportAchievement(o: { id: string; percent: number }): Promise<void>;
  showDashboard(): Promise<void>;
}
const GameCenter = registerPlugin<GameCenterPlugin>('GameCenter');

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Before the game is built: storage first (the game reads it at once). */
export async function initNative(onBackground: () => void): Promise<void> {
  await initNativeStore(Preferences);
  StatusBar.hide().catch(() => undefined);

  setHapticBackend({
    impact: (style) => void Haptics.impact({ style: style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => undefined),
    success: () => void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined),
  });

  // Pause and save the moment the app leaves the foreground.
  void CapApp.addListener('pause', () => {
    onBackground();
    void flushStore();
  });

  const hasProduct = async (): Promise<boolean> => {
    const { purchases } = await NativePurchases.getPurchases({ onlyCurrentEntitlements: true });
    return purchases.some((t) => t.productIdentifier === PRODUCT_ID);
  };
  setPurchaseBackend({
    price: async () => {
      const { product } = await NativePurchases.getProduct({ productIdentifier: PRODUCT_ID, productType: PURCHASE_TYPE.INAPP });
      return product?.priceString ?? null;
    },
    buy: async () => {
      const t = await NativePurchases.purchaseProduct({ productIdentifier: PRODUCT_ID, productType: PURCHASE_TYPE.INAPP, quantity: 1 });
      return t.productIdentifier === PRODUCT_ID || (await hasProduct());
    },
    restore: async () => {
      await NativePurchases.restorePurchases();
      return hasProduct();
    },
    owned: async () => {
      try {
        return await hasProduct();
      } catch {
        return null;
      }
    },
  });

  const gc: GameCenterBackend = {
    authenticate: async () => (await GameCenter.authenticate()).authenticated,
    submitScore: (leaderboardId, score) => GameCenter.submitScore({ leaderboardId, score }),
    reportAchievement: (id, percent) => GameCenter.reportAchievement({ id, percent }),
    showDashboard: () => GameCenter.showDashboard(),
  };
  // Sign-in shows Apple's own banner/sheet; don't hold the launch for it.
  void setGameCenterBackend(gc);
}

/** After the first frame is up. */
export function nativeReady(): void {
  SplashScreen.hide().catch(() => undefined);
}
