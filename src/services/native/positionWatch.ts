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
            onError(
              err.code === 'NOT_AUTHORIZED'
                ? positionError(1, err.message || 'Location permission denied.')
                : positionError(2, err.message || 'Device GPS position unavailable.')
            );
            return;
          }
          if (!loc) return;
          onPosition({
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
      if (!stopped) onError(positionError(2, err?.message || 'Could not start GPS.'));
    });

  return () => {
    stopped = true;
    if (watcherId && plugin) void plugin.removeWatcher({ id: watcherId }).catch(() => undefined);
  };
}
