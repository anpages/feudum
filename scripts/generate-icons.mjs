#!/usr/bin/env node
/**
 * Generates PNG icons for the Feudum PWA.
 * Uses only Node.js built-in modules (zlib) — no external deps.
 *
 * Castle design:
 *   - Parchment warm background (#f5e6c8)
 *   - Dark-ink castle silhouette (#2c1810)
 *   - Gold windows/accents (#c9a227)
 */
import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'

// ── PNG encoder ───────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const tb   = Buffer.from(type, 'ascii')
  const len  = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0)
  const comb = Buffer.concat([tb, data])
  const crc  = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(comb), 0)
  return Buffer.concat([len, tb, data, crc])
}

function encodePNG(w, h, rgb) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10])
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = ihdr[11] = ihdr[12] = 0

  // one filter-byte (0=None) per row + RGB
  const rowBytes = 1 + w * 3
  const raw = Buffer.allocUnsafe(h * rowBytes)
  for (let y = 0; y < h; y++) {
    raw[y * rowBytes] = 0
    for (let x = 0; x < w; x++) {
      const pi = (y * w + x) * 3
      const ri = y * rowBytes + 1 + x * 3
      raw[ri]     = rgb[pi]
      raw[ri + 1] = rgb[pi + 1]
      raw[ri + 2] = rgb[pi + 2]
    }
  }
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Icon renderer ─────────────────────────────────────────────────────────────

const BG     = [0xf5, 0xe6, 0xc8]   // parchment warm
const CASTLE = [0x2c, 0x18, 0x10]   // dark ink
const GOLD   = [0xc9, 0xa2, 0x27]   // gold accent

function drawCastle(size) {
  const px = new Uint8Array(size * size * 3)
  // fill background
  for (let i = 0; i < size * size; i++) {
    px[i*3]=BG[0]; px[i*3+1]=BG[1]; px[i*3+2]=BG[2]
  }

  const set = (x, y, col) => {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 3
    px[i]=col[0]; px[i+1]=col[1]; px[i+2]=col[2]
  }

  const fill = (x, y, w, h, col) => {
    for (let dy = 0; dy < Math.round(h); dy++)
      for (let dx = 0; dx < Math.round(w); dx++)
        set(Math.round(x)+dx, Math.round(y)+dy, col)
  }

  // All coordinates are in 512-unit space, scaled to `size`
  const s = size / 512

  // Main wall
  fill(64*s, 288*s, 384*s, 164*s, CASTLE)
  // Left tower
  fill(48*s, 168*s, 120*s, 284*s, CASTLE)
  // Right tower
  fill(344*s, 168*s, 120*s, 284*s, CASTLE)
  // Center tower (taller)
  fill(188*s, 104*s, 136*s, 348*s, CASTLE)

  // Battlements — draw castle parts first, then cut crenels as BG

  // Left tower crenels (2 gaps, 3 merlons in 120px: M=32 C=28 M=32)
  fill((48+32)*s, 142*s, 28*s, 34*s, BG)  // crenel center

  // Right tower crenels
  fill((344+32)*s, 142*s, 28*s, 34*s, BG)

  // Center tower crenels (2 gaps in 136px: M=40 C=28 M=40)
  fill((188+36)*s, 78*s, 28*s, 34*s, BG)   // crenel 1
  fill((188+72)*s, 78*s, 28*s, 34*s, BG)   // crenel 2 (slight off to keep 2)

  // Gate arch in main wall
  fill(212*s, 336*s, 88*s, 116*s, BG)

  // Arrow-slit windows (narrow vertical) — gold
  fill(96*s,  224*s, 28*s, 48*s, GOLD)   // left tower window
  fill(388*s, 224*s, 28*s, 48*s, GOLD)   // right tower window
  fill(240*s, 164*s, 32*s, 56*s, GOLD)   // center tower window

  // Gold ring border
  const border = Math.max(2, Math.round(6*s))
  for (let i = 0; i < border; i++) {
    for (let x = i; x < size-i; x++) {
      set(x, i, GOLD); set(x, size-1-i, GOLD)
    }
    for (let y = i; y < size-i; y++) {
      set(i, y, GOLD); set(size-1-i, y, GOLD)
    }
  }

  return px
}

// ── Generate files ────────────────────────────────────────────────────────────

mkdirSync('public/icons', { recursive: true })

const ICONS = [
  { size: 512, path: 'public/icons/icon-512.png'     },
  { size: 192, path: 'public/icons/icon-192.png'     },
  { size: 180, path: 'public/apple-touch-icon.png'   },
  { size: 96,  path: 'public/icons/icon-96.png'      },
]

for (const { size, path } of ICONS) {
  const px  = drawCastle(size)
  const png = encodePNG(size, size, px)
  writeFileSync(path, png)
  console.log(`✓ ${path} (${size}×${size})`)
}
