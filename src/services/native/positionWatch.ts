// Watching this device's GPS position.
//
// In a browser this is navigator.geolocation.watchPosition, which stops once the page is in the
// background. Inside the Android app it uses @capacitor-community/background-geolocation, which
// keeps a foreground service (with its notification) running, so a skipper's phone keeps sending
// positions with the screen off or another app open.

import { isNativeApp, nativePlugin } from './platform';

export interface DevicePosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    /** m/s */
    speed: number | null;
    /** degrees from true north */
    heading: number | null;
  };
  timestamp: number;
}

export interface DevicePositionError {
  code: number;
  message: string;
  PERMISSION_DENIED: 1;
  POSITION_UNAVAILABLE: 2;
  TIMEOUT: 3;
}

interface NativeLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  bearing: number | null;
  speed: number | null;
  time: number | null;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (position?: NativeLocation, error?: { code?: string; message?: string }) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}

function positionError(code: 1 | 2 | 3, message: string): DevicePositionError {
  return { code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
}

/** While the background plugin delivers fixes, the web view's own fixes are not used */
export const NATIVE_PREFERRED_MS = 5_000;
/** An error from one source is shown once nothing has come in for this long */
export const ERROR_AFTER_MS = 20_000;

type Source = 'native' | 'web';

/**
 * Inside the app, positions come from two places at once:
 * - the background plugin, which keeps working with the screen off, but needs Google Play
 *   services and refuses to start when the phone allows only "approximate" location;
 * - the web view's own GPS, which works on any phone and with approximate location, but only
 *   while the app is on screen.
 * The plugin's fixes are used whenever they are coming in; otherwise the web view's. An error is
 * passed on only when both sources have failed, or one has and nothing has arrived for a while,
 * so a plugin refusal does not hide a working GPS.
 */
export function createPositionMerger(
  onPosition: (pos: DevicePosition) => void,
  onError: (err: DevicePositionError) => void,
  now: () => number = Date.now
) {
  const startedAt = now();
  let lastFixAt = 0;
  let lastNativeFixAt = 0;
  const errors: Partial<Record<Source, DevicePositionError>> = {};

  const fix = (source: Source, pos: DevicePosition) => {
    const t = now();
    if (source === 'web' && lastNativeFixAt && t - lastNativeFixAt < NATIVE_PREFERRED_MS) return;
    if (source === 'native') lastNativeFixAt = t;
    lastFixAt = t;
    delete errors.native;
    delete errors.web;
    onPosition(pos);
  };

  const error = (source: Source, err: DevicePositionError) => {
    errors[source] = err;
    const quietFor = now() - (lastFixAt || startedAt);
    const bothFailed = !!errors.native && !!errors.web;
    if (!bothFailed && quietFor < ERROR_AFTER_MS) return;
    // The web view accepts approximate location, so its answer about permission is the true one
    onError(errors.web ?? err);
  };

  return { fix, error };
}

/** Starts watching; returns a function that stops it. */
export function watchDevicePosition(
  onPosition: (pos: DevicePosition) => void,
  onError: (err: DevicePositionError) => void,
  options: PositionOptions
): () => void {
  if (!isNativeApp()) {
    const id = navigator.geolocation.watchPosition(onPosition, onError as PositionErrorCallback, options);
    return () => navigator.geolocation.clearWatch(id);
  }

  let stopped = false;
  let watcherId: string | null = null;
  let plugin: BackgroundGeolocationPlugin | null = null;
  const merger = createPositionMerger(
    (pos) => !stopped && onPosition(pos),
    (err) => !stopped && onError(err)
  );

  // The web view's GPS: works on every phone while the app is on screen
  let webWatchId: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    webWatchId = navigator.geolocation.watchPosition(
      (pos) => merger.fix('web', pos),
      (err) => merger.error('web', positionError(err.code as 1 | 2 | 3, err.message)),
      options
    );
  }

  // The background plugin: keeps going with the screen off (foreground service + notification)
  nativePlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')
    .then((p) => {
      plugin = p;
      return p.addWatcher(
        {
          backgroundTitle: 'TMTRAC is sharing your position',
          backgroundMessage: 'Your boat stays on the race map while the phone is locked. Stop sharing in the app to turn this off.',
          requestPermissions: true,
          stale: false,
          distanceFilter: 0,
        },
        (loc, err) => {
          if (stopped) return;
          if (err) {
            const message = err.message || '';
            // "Location services disabled." also comes as NOT_AUTHORIZED: that is the phone's
            // Location switch, not the app's permission
            merger.error(
              'native',
              err.code === 'NOT_AUTHORIZED' && !/disabled/i.test(message)
                ? positionError(1, message || 'Location permission denied.')
                : positionError(2, message || 'Device GPS position unavailable.')
            );
            return;
          }
          if (!loc) return;
          merger.fix('native', {
            coords: {
              latitude: loc.latitude,
              longitude: loc.longitude,
              accuracy: loc.accuracy,
              altitude: loc.altitude,
              speed: loc.speed,
              heading: loc.bearing,
            },
            timestamp: loc.time || Date.now(),
          });
        }
      );
    })
    .then((id) => {
      watcherId = id;
      if (stopped) void plugin?.removeWatcher({ id });
    })
    .catch((err) => {
      if (!stopped) merger.error('native', positionError(2, err?.message || 'Could not start background GPS.'));
    });

  return () => {
    stopped = true;
    if (webWatchId !== null) navigator.geolocation.clearWatch(webWatchId);
    if (watcherId && plugin) void plugin.removeWatcher({ id: watcherId }).catch(() => undefined);
  };
}
