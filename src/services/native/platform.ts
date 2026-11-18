// Whether this page runs inside the TMTRAC Android app rather than a browser.
//
// The app opens the live site; Capacitor injects `window.Capacitor` into it before the page's own
// scripts run. Plugins are imported only when this is true, so browsers never download them.

export function isNativeApp(): boolean {
  const cap = (globalThis as any).Capacitor;
  try {
    return !!cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() === true;
  } catch {
    return false;
  }
}

/** A native plugin's methods, through Capacitor's bridge. Only call inside the app. */
export async function nativePlugin<T>(name: string): Promise<T> {
  const { registerPlugin } = await import('@capacitor/core');
  return registerPlugin<T & object>(name) as T;
}
