/**
 * Icon generator for Desktop Clock.
 *
 * Renders a clean digital-clock mark (rounded dark panel, accent ring,
 * "12:00" style hands) directly to PNG using a tiny built-in rasteriser on top
 * of Node's zlib. No external dependencies, fully offline.
 *
 * Outputs: 16, 32, 48, 64, 128, 256, 512 px PNGs plus icon.ico.
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const OUT_DIR = path.resolve(__dirname, "..", "src-tauri", "icons");

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** Encode RGBA pixel data (Uint8Array, size*size*4) as a PNG buffer. */
function encodePng(rgba, size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Add filter byte 0 to the start of every scanline.
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy
      ? rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
      : Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Drawing (supersampled for smooth edges)
// ---------------------------------------------------------------------------

const BG_TOP = [26, 32, 46];
const BG_BOTTOM = [14, 17, 24];
const ACCENT = [95, 140, 255];
const ACCENT_2 = [143, 107, 255];
const FACE = [245, 247, 250];

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function renderIcon(size) {
  const SS = 4; // supersample factor
  const S = size * SS;
  const buf = Buffer.alloc(S * S * 4, 0);

  const put = (x, y, color, alpha) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    const a = alpha;
    const src = color;
    const dstA = buf[i + 3] / 255;
    const outA = a + dstA * (1 - a);
    if (outA <= 0) return;
    buf[i] = Math.round((src[0] * a + buf[i] * dstA * (1 - a)) / outA);
    buf[i + 1] = Math.round((src[1] * a + buf[i + 1] * dstA * (1 - a)) / outA);
    buf[i + 2] = Math.round((src[2] * a + buf[i + 2] * dstA * (1 - a)) / outA);
    buf[i + 3] = Math.round(outA * 255);
  };

  const cx = S / 2;
  const cy = S / 2;
  const radius = S * 0.44;
  const corner = S * 0.24;

  // Rounded-square panel with a vertical gradient and a soft drop shadow.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = Math.max(Math.abs(x - cx) - (radius - corner), 0);
      const dy = Math.max(Math.abs(y - cy) - (radius - corner), 0);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const inside = dist <= corner;

      // Shadow
      const sDist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (sDist < radius * 1.13) {
        const shadowA = Math.max(0, 1 - sDist / (radius * 1.13)) * 0.35;
        if (!inside) put(x, y, [0, 0, 0], shadowA);
      }

      if (inside) {
        const t = y / S;
        const col = mix(BG_TOP, BG_BOTTOM, t);
        // Anti-aliased edge
        const edge = Math.min(1, corner - dist + 1);
        put(x, y, col, edge);
      }
    }
  }

  // Accent ring
  const ringR = radius * 0.74;
  const ringW = Math.max(SS * 1.4, S * 0.035);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const ring = Math.abs(d - ringR);
      if (ring < ringW) {
        const a = 1 - ring / ringW;
        const t = (y - (cy - ringR)) / (2 * ringR);
        put(x, y, mix(ACCENT, ACCENT_2, Math.max(0, Math.min(1, t))), a);
      }
    }
  }

  // Clock hands: hour pointing up, minute pointing right.
  const hand = (angle, length, width, color) => {
    const steps = Math.ceil(length * 2);
    for (let s = 0; s <= steps; s++) {
      const r = (s / steps) * length;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      for (let oy = -width; oy <= width; oy++) {
        for (let ox = -width; ox <= width; ox++) {
          const d = Math.sqrt(ox * ox + oy * oy);
          if (d <= width) {
            put(Math.round(px + ox), Math.round(py + oy), color, 1 - d / width / 1.6);
          }
        }
      }
    }
  };

  const handLen = ringR * 0.72;
  hand(-Math.PI / 2, handLen * 0.62, S * 0.022, FACE); // hour
  hand(0, handLen, S * 0.018, FACE); // minute

  // Centre dot
  const dotR = S * 0.045;
  for (let y = -dotR; y <= dotR; y++) {
    for (let x = -dotR; x <= dotR; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= dotR) put(Math.round(cx + x), Math.round(cy + y), FACE, 1 - d / dotR / 1.4);
    }
  }

  // Downsample (box filter) to the target size.
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * S + (x * SS + sx)) * 4;
          const pa = buf[i + 3] / 255;
          r += buf[i] * pa;
          g += buf[i + 1] * pa;
          b += buf[i + 2] * pa;
          a += pa;
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / n) * 255);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// ICO container
// ---------------------------------------------------------------------------

function buildIco(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;

  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SIZES = [16, 32, 48, 64, 128, 256, 512];

fs.mkdirSync(OUT_DIR, { recursive: true });

const rendered = {};
for (const size of SIZES) {
  const px = renderIcon(size);
  const png = encodePng(px, size);
  rendered[size] = png;
  fs.writeFileSync(path.join(OUT_DIR, `${size}x${size}.png`), png);
}

// Tauri's default icon paths (128@2x is 256).
fs.writeFileSync(path.join(OUT_DIR, "icon.png"), rendered[512]);
fs.writeFileSync(path.join(OUT_DIR, "128x128@2x.png"), rendered[256]);
fs.writeFileSync(path.join(OUT_DIR, "icon.ico"), buildIco([
  { size: 16, data: rendered[16] },
  { size: 32, data: rendered[32] },
  { size: 48, data: rendered[48] },
  { size: 256, data: rendered[256] },
]));

// Windows Store logos used by the MSI bundler.
const storeSizes = [
  ["Square30x30Logo.png", 30],
  ["Square44x44Logo.png", 44],
  ["Square71x71Logo.png", 71],
  ["Square89x89Logo.png", 89],
  ["Square107x107Logo.png", 107],
  ["Square142x142Logo.png", 142],
  ["Square150x150Logo.png", 150],
  ["Square284x284Logo.png", 284],
  ["Square310x310Logo.png", 310],
  ["StoreLogo.png", 300],
];
for (const [name, size] of storeSizes) {
  fs.writeFileSync(path.join(OUT_DIR, name), encodePng(renderIcon(size), size));
}

console.log(`Generated ${SIZES.length} PNGs + icon.ico + Store logos in ${OUT_DIR}`);