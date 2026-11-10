// リンクカード用の画像（1200x630）を作る：node scripts/make-og.mjs
// ファビコンのドット絵と、5x7 の簡単な文字だけで描く（画像ライブラリは使わない）
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1200;
const H = 630;
const GLYPHS = {
  F: "11111 10000 10000 11110 10000 10000 10000",
  O: "01110 10001 10001 10001 10001 10001 01110",
  D: "11110 10001 10001 10001 10001 10001 11110",
  I: "01110 00100 00100 00100 00100 00100 01110",
  E: "11111 10000 10000 11110 10000 10000 11111",
  Q: "01110 10001 10001 10001 10101 10010 01101",
  U: "10001 10001 10001 10001 10001 10001 01110",
  S: "01111 10000 10000 01110 00001 00001 11110",
  T: "11111 00100 00100 00100 00100 00100 00100",
  Y: "10001 10001 01010 00100 00100 00100 00100",
  R: "11110 10001 10001 11110 10100 10010 10001",
  N: "10001 11001 10101 10011 10001 10001 10001",
  V: "10001 10001 10001 10001 10001 01010 00100",
  J: "00111 00010 00010 00010 00010 10010 01100",
  M: "10001 11011 10101 10101 10001 10001 10001",
  "!": "00100 00100 00100 00100 00100 00000 00100",
  "'": "00100 00100 01000 00000 00000 00000 00000",
  " ": "00000 00000 00000 00000 00000 00000 00000",
};

function canvas() {
  const px = Buffer.alloc(W * H * 3);
  const rect = (x, y, w, h, [r, g, b]) => {
    for (let j = Math.max(0, y); j < Math.min(H, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) {
        const o = (j * W + i) * 3;
        px[o] = r;
        px[o + 1] = g;
        px[o + 2] = b;
      }
  };
  const textWidth = (t, s) => t.length * 6 * s - s;
  const text = (t, x, y, s, color) => {
    [...t].forEach((ch, n) => {
      const rows = GLYPHS[ch].split(" ");
      rows.forEach((row, j) => [...row].forEach((c, i) => c === "1" && rect(x + (n * 6 + i) * s, y + j * s, s, s, color)));
    });
  };
  return { px, rect, text, textWidth };
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function sprite(c, x0, y0, scale) {
  const svg = readFileSync("packages/client/public/favicon.svg", "utf8");
  for (const m of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(#[0-9a-f]{6})"/g))
    c.rect(x0 + +m[1] * scale, y0 + +m[2] * scale, +m[3] * scale, +m[4] * scale, hex(m[5]));
}

function crc32(buf) {
  let c;
  const table = (crc32.t ??= Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function png(px) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function make(file, invite) {
  const c = canvas();
  const INK = hex("#f2f2f2");
  const GOLD = hex("#ffd23c");
  c.rect(0, 0, W, H, hex("#000000"));
  c.rect(24, 24, W - 48, H - 48, hex("#e8e8f0")); // 白い枠
  c.rect(30, 30, W - 60, H - 60, hex("#0b0f2c")); // 紺の地
  sprite(c, 84, (H - 384) / 2, 24);
  const x = 560;
  const s = 14;
  const top = invite ? 110 : 190;
  c.text("FOODIE", x, top, s, INK);
  c.text("QUEST", x, top + 7 * s + 28, s, GOLD);
  if (invite) {
    const t = "YOU'RE INVITED!";
    const ts = 6;
    const by = top + 14 * s + 28 + 60;
    c.rect(x - 16, by - 18, c.textWidth(t, ts) + 32, 7 * ts + 36, GOLD);
    c.text(t, x, by, ts, hex("#1a1200"));
  }
  writeFileSync(file, png(c.px));
  console.log("wrote", file);
}

make("packages/client/public/og-default.png", false);
make("packages/client/public/og-invite.png", true);
