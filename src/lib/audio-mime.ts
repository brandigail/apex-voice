// Shared by the client and the Netlify Functions. Keep this file free of DOM and Node APIs.

/** File extension for a recorded mime type, so the transcriber can sniff the container format. */
export function extensionForMime(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase()
  if (base === 'audio/mp4' || base === 'audio/x-m4a') return 'm4a'
  if (base === 'audio/ogg') return 'ogg'
  if (base === 'audio/mpeg') return 'mp3'
  if (base === 'audio/wav' || base === 'audio/x-wav') return 'wav'
  return 'webm'
}
