// Regenerates every app icon (PWA, favicon, Apple touch, Android launcher) from one design.
// Usage: node scripts/make-icons.mjs   (needs Chrome or Edge installed; renders headless)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]
const browser = BROWSERS.find(existsSync)
if (!browser) throw new Error('Install Chrome or Edge to render the icons')

// Heights of the sound bars; together they form a summit (the "apex").
const BARS = [96, 168, 252, 372, 252, 168, 96]
const STEP = 46
const BAR_W = 30

const bars = BARS.map((h, i) => {
  const x = 256 + (i - 3) * STEP - BAR_W / 2
  return `<rect x="${x}" y="${256 - h / 2}" width="${BAR_W}" height="${h}" rx="${BAR_W / 2}"/>`
}).join('')

/** shape: 'rounded' | 'full' | 'circle' | 'none' (transparent, glow only). scale: size of the mark. */
function svg({ shape, scale }) {
  const clip = {
    rounded: '<rect width="512" height="512" rx="116"/>',
    circle: '<circle cx="256" cy="256" r="256"/>',
    full: '<rect width="512" height="512"/>',
    none: '<rect width="512" height="512"/>',
  }[shape]
  const base = shape === 'none' ? '' : '<rect width="512" height="512" fill="url(#bg)"/>'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14103a"/><stop offset="1" stop-color="#05050f"/></linearGradient>
  <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#a5f3fc"/><stop offset="1" stop-color="#c084fc"/></linearGradient>
  <radialGradient id="g1" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#6366f1" stop-opacity=".95"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></radialGradient>
  <radialGradient id="g2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ec4899" stop-opacity=".85"/><stop offset="1" stop-color="#ec4899" stop-opacity="0"/></radialGradient>
  <radialGradient id="g3" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#22d3ee" stop-opacity=".8"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
  <clipPath id="clip">${clip}</clipPath>
</defs>
<g clip-path="url(#clip)">
  ${base}
  <circle cx="110" cy="420" r="260" fill="url(#g1)"/>
  <circle cx="430" cy="90" r="230" fill="url(#g2)"/>
  <circle cx="440" cy="440" r="170" fill="url(#g3)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <g fill="#7c3aed" opacity=".65" filter="url(#soft)">${bars}</g>
    <g fill="url(#bar)">${bars}</g>
    <circle cx="256" cy="${256 - BARS[3] / 2 - 34}" r="13" fill="#fff"/>
  </g>
</g>
</svg>`
}

const work = mkdtempSync(join(tmpdir(), 'apex-icons-'))
function render(variant, size, outPath) {
  const html = join(work, `${Math.random().toString(36).slice(2)}.html`)
  const png = join(work, 'out.png')
  writeFileSync(
    html,
    `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(variant)}`,
  )
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', `--window-size=${size},${size}`,
    `--screenshot=${png}`, `file:///${html.replace(/\\/g, '/')}`,
  ], { stdio: 'ignore' })
  mkdirSync(join(outPath, '..'), { recursive: true })
  execFileSync('powershell', ['-NoProfile', '-Command', `Copy-Item -Force '${png}' '${outPath}'`])
}

const root = new URL('..', import.meta.url).pathname.replace(/^\//, '')
const pub = (f) => join(root, 'public', f)
const res = (f) => join(root, 'android/app/src/main/res', f)

const MARK = 0.78
const ANY = { shape: 'rounded', scale: MARK }
const FULL = { shape: 'full', scale: 0.66 } // maskable / Apple: keep the mark inside the safe zone

render(ANY, 192, pub('icon-192.png'))
render(ANY, 512, pub('icon-512.png'))
render(FULL, 512, pub('icon-maskable-512.png'))
render(FULL, 180, pub('apple-touch-icon.png'))
writeFileSync(pub('favicon.svg'), svg(ANY).replace(/ width="512" height="512"/, ''))

const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, k] of Object.entries(DENSITY)) {
  // Adaptive foreground is 108dp with only the middle 66dp guaranteed visible.
  render({ shape: 'none', scale: 0.5 }, Math.round(108 * k), res(`mipmap-${d}/ic_launcher_foreground.png`))
  // Pre-Android-8 launchers use the flattened square and round icons (48dp).
  render({ shape: 'rounded', scale: MARK }, Math.round(48 * k), res(`mipmap-${d}/ic_launcher.png`))
  render({ shape: 'circle', scale: 0.7 }, Math.round(48 * k), res(`mipmap-${d}/ic_launcher_round.png`))
}

rmSync(work, { recursive: true, force: true })
console.log('Icons written.')
