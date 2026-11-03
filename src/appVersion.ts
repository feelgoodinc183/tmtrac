declare const __APP_VERSION__: string;

/** The app version from package.json, injected at build time by vite.config.ts. */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
