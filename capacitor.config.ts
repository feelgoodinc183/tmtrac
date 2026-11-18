import type { CapacitorConfig } from '@capacitor/cli';

// The Android app opens the live TMTRAC site, so it always matches the website and talks to the
// same server (its /api routes and WebSocket are same-origin there). To point a build at another
// server, such as a staging subdomain, set TMTRAC_APP_URL before `npx cap sync android`.
const appUrl = process.env.TMTRAC_APP_URL || 'https://tmtrac.my';
const appHost = new URL(appUrl).hostname;

const config: CapacitorConfig = {
  appId: 'my.tmtrac.app',
  appName: 'TMTRAC',
  // Shown only when the site cannot be loaded (no signal on first open).
  webDir: 'mobile/www',
  server: {
    url: appUrl,
    errorPath: 'offline.html',
    allowNavigation: [appHost, `*.${appHost}`],
    cleartext: appUrl.startsWith('http://'),
  },
  android: {
    // The site sends its own User-Agent check for "Android"; this keeps it and marks the app.
    appendUserAgent: 'TMTRAC-Android',
  },
};

export default config;
