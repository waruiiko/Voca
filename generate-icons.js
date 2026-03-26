/**
 * 生成扩展图标 PNG 文件 (16x16, 48x48, 128x128)
 * 运行: node generate-icons.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ── CRC32 ──────────────────────────────────────────────────────────
const crcTable = [];
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable.push(c >>> 0);
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = (crcTable[(c ^ b) & 0xFF] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG 编码 ───────────────────────────────────────────────────────
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const tb = Buffer.from(type);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([len, tb, data, cr]);
}
function makePNG(w, h, rgba) {
  const row = w * 4;
  const raw = Buffer.alloc(h * (row + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (row + 1)] = 0; // filter: None
    rgba.copy(raw, y * (row + 1) + 1, y * row, (y + 1) * row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 绘图工具 ───────────────────────────────────────────────────────
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function generateIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const R = Math.round(size * 0.22); // 圆角半径

  // 渐变色：靛蓝 #3949AB → 深靛 #1A237E
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // 圆角裁切
      let inside = true;
      if (x < R && y < R) {
        const dx = R - x - 0.5, dy = R - y - 0.5;
        inside = dx * dx + dy * dy <= R * R;
      } else if (x >= size - R && y < R) {
        const dx = x - (size - R) + 0.5, dy = R - y - 0.5;
        inside = dx * dx + dy * dy <= R * R;
      } else if (x < R && y >= size - R) {
        const dx = R - x - 0.5, dy = y - (size - R) + 0.5;
        inside = dx * dx + dy * dy <= R * R;
      } else if (x >= size - R && y >= size - R) {
        const dx = x - (size - R) + 0.5, dy = y - (size - R) + 0.5;
        inside = dx * dx + dy * dy <= R * R;
      }

      if (!inside) { buf[i + 3] = 0; continue; }

      // 渐变背景
      const t = y / size;
      buf[i]     = lerp(57,  26, t);   // R: #3949AB → #1A237E
      buf[i + 1] = lerp(73,  35, t);   // G
      buf[i + 2] = lerp(171, 126, t);  // B
      buf[i + 3] = 255;
    }
  }

  // 叠加白色像素（带 alpha 混合）
  function px(x, y, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    if (buf[i + 3] === 0) return;
    const fa = a / 255;
    buf[i]     = lerp(buf[i],     255, fa);
    buf[i + 1] = lerp(buf[i + 1], 255, fa);
    buf[i + 2] = lerp(buf[i + 2], 255, fa);
  }

  function fillRect(x0, y0, x1, y1, a = 255) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        px(x, y, a);
  }

  function fillCircle(cx, cy, r, a = 255) {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(x, y, a);
  }

  // ── "E" 字母 ─────────────────────────────────────────────────────
  const pad  = Math.round(size * 0.20);
  const lx   = pad;
  const ly   = pad;
  const lw   = Math.round(size * 0.52);
  const lh   = size - pad * 2;
  const sw   = Math.max(2, Math.round(size * 0.115)); // 笔画粗细
  const mw   = Math.round(lw * 0.76);                 // 中横稍短

  // 竖笔（左）
  fillRect(lx, ly, lx + sw, ly + lh);
  // 上横
  fillRect(lx, ly, lx + lw, ly + sw);
  // 中横
  const my = ly + Math.round((lh - sw) / 2);
  fillRect(lx, my, lx + mw, my + sw);
  // 下横
  fillRect(lx, ly + lh - sw, lx + lw, ly + lh);

  if (size >= 48) {
    // ── 右上角星点装饰 ────────────────────────────────────────────
    // 大星
    const s1x = Math.round(size * 0.76), s1y = Math.round(size * 0.20);
    const s1r = Math.max(2, Math.round(size * 0.055));
    fillCircle(s1x, s1y, s1r);

    // 小星（右下斜）
    const s2x = Math.round(size * 0.84), s2y = Math.round(size * 0.33);
    const s2r = Math.max(1, Math.round(size * 0.030));
    fillCircle(s2x, s2y, s2r, 180);

    // 微星（左上）
    const s3x = Math.round(size * 0.68), s3y = Math.round(size * 0.13);
    const s3r = Math.max(1, Math.round(size * 0.022));
    fillCircle(s3x, s3y, s3r, 150);

    // ── "E" 下方短波浪线（语言象征）────────────────────────────────
    if (size >= 128) {
      const wy = ly + lh + Math.round(size * 0.06);
      const wlen = lw;
      const amp = Math.max(1, Math.round(size * 0.025));
      const ww  = Math.max(1, Math.round(size * 0.03));
      for (let wx = lx; wx < lx + wlen; wx++) {
        const phase = (wx - lx) / wlen * Math.PI * 3;
        const wy2 = wy + Math.round(Math.sin(phase) * amp);
        fillRect(wx, wy2, wx, wy2 + ww, 200);
      }
    }
  }

  return buf;
}

// ── 输出 ────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const rgba = generateIcon(size);
  const png  = makePNG(size, size, rgba);
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✓ icon-${size}.png (${png.length} bytes)`);
}
console.log('完成！');
