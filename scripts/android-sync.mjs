// Copies the app shell into the Android project (`npx cap sync android`), first recording which
// site the app opens so the offline page's "Try again" button goes back to it.
// Usage: TMTRAC_APP_URL=https://staging.tmtrac.my node scripts/android-sync.mjs
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const appUrl = process.env.TMTRAC_APP_URL || 'https://tmtrac.my';
new URL(appUrl); // fails early on a typo
writeFileSync('mobile/www/app-url.js', `window.TMTRAC_URL = ${JSON.stringify(appUrl)};\n`);
execSync('npx cap sync android', { stdio: 'inherit', env: { ...process.env, TMTRAC_APP_URL: appUrl } });
