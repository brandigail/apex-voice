import { Capacitor, registerPlugin } from '@capacitor/core'

interface ApexListeningPlugin {
  start: () => Promise<{ running: boolean }>
  stop: () => Promise<{ running: boolean }>
}

/** Implemented in android/ (ListeningService). It only exists inside the Android app, never in a browser. */
const Native = registerPlugin<ApexListeningPlugin>('ApexListening')

export const isAndroidApp = Capacitor.getPlatform() === 'android'

/** Asks Android to keep the microphone alive with the screen off. Returns false in a browser or if Android refuses. */
export async function startBackgroundListening(): Promise<boolean> {
  if (!isAndroidApp) return false
  try {
    return (await Native.start()).running
  } catch {
    return false
  }
}

export async function stopBackgroundListening(): Promise<void> {
  if (!isAndroidApp) return
  try {
    await Native.stop()
  } catch {
    // nothing to stop
  }
}
