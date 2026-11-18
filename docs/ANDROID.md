# TMTRAC Android app

The Android app (`my.tmtrac.app`) is a Capacitor shell that opens the live site, https://tmtrac.my,
so it always matches the website and uses the same server. Phone GPS works in the app once the
skipper allows location. If the phone has no signal on first open, a "Can't reach TMTRAC" page
offers to try again.

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

## Not in the app yet

- **Bluetooth relay of a T-Echo.** The app's web view has no Web Bluetooth, so relaying a
  Meshtastic tracker still needs Chrome on Android or a laptop. The rebuild plan
  (`docs/REBUILD_PLAN.md`, phase 4) adds native Bluetooth through a Capacitor plugin.
- **Tracking with the screen off.** GPS sharing stops when the app is in the background; this
  needs a foreground service (also phase 4).
- **App icon.** The launcher icon and splash screen are Capacitor's placeholders.
