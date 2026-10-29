import type { CapacitorConfig } from '@capacitor/cli';
// Provisional application ID. Confirm ownership before first public release.
const config: CapacitorConfig = {
  appId: 'site.freegameplay.app', appName: 'FreeGameplay', webDir: 'dist',
  server: { androidScheme: 'https' },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};
export default config;
