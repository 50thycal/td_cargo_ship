// Which build this is. `__STORE__` is a compile-time constant (vite.config.ts,
// `vite build --mode store`): the App Store build. Everything else (Vercel,
// dev, tests, TestFlight playtest builds) is the playtest flavour.
//
// The store flavour has no playtest notes or ratings, no log upload, no
// developer mode and no links off the app; Settings gains the version,
// credits, privacy policy and a progress reset; chapters 2–4 need the
// full-game unlock.

export const STORE: boolean = __STORE__;

/** The app's version (package.json), stamped by Vite. */
export const VERSION: string = __VERSION__;

/** The privacy policy page (app_farm's legal site). */
export const PRIVACY_URL = 'https://app-farm-legal.vercel.app/straitwatch/privacy';
