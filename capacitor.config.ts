import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Android app is a native shell around the live site: it loads https://apex-voice-app.netlify.app, so sign-in
 * cookies stay same-origin and every web deploy reaches the app without a new APK. The shell adds what a browser
 * cannot do: a foreground service that keeps the microphone alive when the screen is off.
 */
const config: CapacitorConfig = {
  appId: 'com.brandigail.apexvoice',
  appName: 'Apex Voice',
  webDir: 'dist',
  server: {
    url: 'https://apex-voice-app.netlify.app',
    androidScheme: 'https',
    // Shown instead of Chrome's error page when the phone has no connection (public/app-offline.html).
    errorPath: 'app-offline.html',
  },
  android: {
    backgroundColor: '#07060f',
    allowMixedContent: false,
  },
}

export default config
