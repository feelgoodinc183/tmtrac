# TMTRAC Android app

The Android app (`my.tmtrac.app`) is a Capacitor app that opens the live site, https://tmtrac.my,
so its screens always match the website and it uses the same server. What the website cannot do
on a phone, the app does with Android's own features:

| | Chrome on Android | The app |
|---|---|---|
| Connect a T-Echo over Bluetooth | Web Bluetooth, while the page is open | Android Bluetooth (`@capacitor-community/bluetooth-le`) |
| Share the phone's GPS with the screen off | Stops when the phone locks | Keeps going (`@capacitor-community/background-geolocation`) |
| Relay a T-Echo with the screen off | Stops when the phone locks | Keeps going (`RelayService`, below) |

If the phone has no signal on first open, a "Can't reach TMTRAC" page offers to try again.

### How the native parts fit in

- `src/services/native/platform.ts` tells whether the page runs inside the app. Plugins are
  loaded only there, so browsers never download them.
- `src/services/native/nativeBluetooth.ts` gives the tracker code the same Web Bluetooth calls
  it uses in Chrome, carried out by the plugin. `meshtasticBleMqttService.ts` calls
  `getBluetooth()` and runs the same Meshtastic handshake, reconnects and reads either way.
  `tests/nativeBluetooth.test.ts` drives the real tracker service through it.
- `src/services/native/positionWatch.ts` replaces `navigator.geolocation.watchPosition` in the
  app. The plugin runs a foreground service with a "TMTRAC is sharing your position"
  notification while sharing is on.
- `src/services/native/relayKeepAlive.ts` starts `RelayService` (a foreground service with a
  "TMTRAC is relaying a tracker" notification and a wake lock) from the moment a tracker
  connects until it is disconnected on purpose or the reconnects give up.
  `android/app/src/main/java/my/tmtrac/app/` holds the service and its plugin.

### Things to know

- **Website changes reach the app by deploying the site.** The app loads tmtrac.my, so the
  JavaScript above only takes effect once the site is deployed to cPanel as usual. Native
  changes (`android/`) need a new APK.
- **The site must be served at exactly `https://tmtrac.my`** (or the `TMTRAC_APP_URL` the app was
  built with). Capacitor only connects the page to Android's Bluetooth and GPS for that origin; a
  redirect to `www.tmtrac.my` would leave the app without them.
- **Phone makers' battery savers** (Samsung, Xiaomi, Oppo, Huawei) can still stop background
  apps. On each skipper's phone set TMTRAC's battery use to "Unrestricted" and test with the
  phone locked in a pocket before race day.
- **Google Play** asks why the app uses foreground services. In Play Console, declare
  *location* (skippers share their boat's position during a race, shown by the notification) and
  *connected device* (relaying a Bluetooth LoRa tracker), each with a short video. The app does
  not ask for "Allow all the time" location: it only tracks while its notification is showing.

## Getting the APK

GitHub Actions builds the app on every push that touches `android/`, `mobile/`,
`capacitor.config.ts` or the packages, and on demand from **Actions > Android app > Run workflow**.
Download the `tmtrac-android` artifact from the run:

| File | Use |
|---|---|
| `tmtrac-<version>-debug.apk` | Install on test phones (allow "Install unknown apps") |
| `tmtrac-<version>-release.apk` | Signed release APK, when the keystore secrets are set |
| `tmtrac-<version>-release.aab` | Upload to Google Play (signed when the keystore secrets are set) |

## Signing for Google Play

Add these repository secrets (Settings > Secrets and variables > Actions):

- `TMTRAC_KEYSTORE_BASE64`: the upload keystore, from `base64 -w0 tmtrac-release.jks`
- `TMTRAC_KEYSTORE_PASSWORD`, `TMTRAC_KEY_ALIAS`, `TMTRAC_KEY_PASSWORD`

To make a new keystore:

```bash
keytool -genkeypair -v -keystore tmtrac-release.jks -alias tmtrac -keyalg RSA -keysize 2048 -validity 10000
```

Keep the keystore and its passwords out of the repository. `server.ts` publishes
`/.well-known/assetlinks.json` with one SHA-256 fingerprint; if the app is signed with a different
key (or by Play App Signing), add that key's fingerprint there.

## Building on your own computer

Needs Node 22, JDK 21 and the Android SDK (Android Studio installs it).

```bash
npm ci
```

```bash
npm run android:debug
```

The APK lands in `android/app/build/outputs/apk/debug/`. `npm run android:open` opens the project
in Android Studio. For release signing locally, create `android/keystore.properties` with
`storeFile`, `storePassword`, `keyAlias` and `keyPassword` (it is git-ignored).

To point a build at another server, such as a staging subdomain:

```bash
TMTRAC_APP_URL=https://staging.tmtrac.my npm run android:debug
```

## Version numbers

`versionName` is the `version` in `package.json`. `versionCode` is that version times 1000 plus
the CI run number (1.6.0, run 42 → 10600042), so every CI build can be uploaded to Play.

## Still to do

- **App icon.** The launcher icon and splash screen are Capacitor's placeholders.
