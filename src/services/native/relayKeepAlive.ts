// Inside the Android app: while a tracker is connected over Bluetooth, run a foreground service
// (android/app/src/main/java/my/tmtrac/app/RelayService.java) so Android keeps the app, the
// Bluetooth link and the server connection alive with the screen off. It stops when the tracker
// is disconnected on purpose or the connection is given up.

import { meshtasticService } from '../meshtasticBleMqttService';
import { isNativeApp, nativePlugin } from './platform';

interface RelayPlugin {
  start(options: { text: string }): Promise<void>;
  stop(): Promise<void>;
}

let started = false;

export function keepRelayAliveInBackground() {
  if (started || !isNativeApp()) return;
  started = true;

  let running = false;
  const plugin = nativePlugin<RelayPlugin>('TmtracRelay');

  meshtasticService.onBleStatusChange((status) => {
    // Keep running through automatic reconnects; stop once nobody is trying any more. Started
    // only once per connection: Android does not let an app start the service from the background.
    const wanted = status.state === 'connecting' || status.state === 'configuring' || status.state === 'connected' || status.state === 'reconnecting';
    if (wanted && !running) {
      running = true;
      const name = status.deviceName || 'the tracker';
      void plugin
        .then((p) => p.start({ text: `Passing ${name} positions to the race server.` }))
        .catch((err) => console.warn('[relay] could not start background service', err));
    } else if (!wanted && running) {
      running = false;
      void plugin.then((p) => p.stop()).catch(() => undefined);
    }
  });
}
