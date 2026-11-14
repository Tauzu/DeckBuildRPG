// ステージの背景（進軍ルートの後ろに敷く横長のドット絵）。外部の素材は使わず、図形を組み合わせてここで描く。
// 種類は stages.json の backdrop で選ぶ（新しいステージは、既存の種類を使い回すか、ここに足す）

export const BACKDROP_W = 160;
export const BACKDROP_H = 36;

type Grid = (string | null)[][];

/** 毎回同じ絵になるように、決まった種から作る乱数 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Canvas {
  readonly g: Grid = Array.from({ length: BACKDROP_H }, () => Array<string | null>(BACKDROP_W).fill(null));
  constructor(readonly r: () => number) {}

  px(x: number, y: number, c: string) {
    if (x >= 0 && x < BACKDROP_W && y >= 0 && y < BACKDROP_H) this.g[y]![x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  /** 空：上から色の帯を重ね、帯の境目は市松模様でぼかす */
  sky(colors: string[]) {
    const band = BACKDROP_H / colors.length;
    for (let y = 0; y < BACKDROP_H; y++) {
      const k = Math.min(colors.length - 1, Math.floor(y / band));
      for (let x = 0; x < BACKDROP_W; x++) {
        const edge = k + 1 < colors.length && y === Math.floor((k + 1) * band) - 1 && (x + y) % 2 === 0;
        this.px(x, y, edge ? colors[k + 1]! : colors[k]!);
      }
    }
  }
  /** 起伏のある稜線から下を塗る */
  ridge(base: number, amp: number, c: string, step = 0.5) {
    let h = base;
    for (let x = 0; x < BACKDROP_W; x++) {
      h += (this.r() - 0.5) * 2 * step;
      h = Math.max(base - amp, Math.min(base + amp, h));
      for (let y = Math.round(h); y < BACKDROP_H; y++) this.px(x, y, c);
    }
  }
  /** 三角の山（頂に雪） */
  peak(cx: number, top: number, slope: number, c: string, snow?: string) {
    for (let y = top; y < BACKDROP_H; y++) {
      const half = Math.floor((y - top) * slope);
      for (let x = cx - half; x <= cx + half; x++) this.px(x, y, snow && y < top + 3 ? snow : c);
    }
  }
  /** 針葉樹 */
  pine(x: number, ground: number, h: number, c: string, trunk: string) {
    this.px(x, ground - 1, trunk);
    for (let i = 0; i < h; i++) {
      const half = Math.floor(i / 2);
      this.rect(x - half, ground - h - 1 + i, half * 2 + 1, 1, c);
    }
  }
  /** 丸い木 */
  bush(x: number, ground: number, rad: number, c: string, trunk: string) {
    this.rect(x, ground - 2, 1, 2, trunk);
    for (let j = -rad; j <= rad; j++)
      for (let i = -rad; i <= rad; i++) if (i * i + j * j <= rad * rad + 1) this.px(x + i, ground - 2 - rad + j, c);
  }
  /** 葉のない木 */
  deadTree(x: number, ground: number, h: number, c: string) {
    this.rect(x, ground - h, 1, h, c);
    for (let i = 2; i < h - 1; i += 2) {
      const d = i % 4 === 0 ? 1 : -1;
      this.px(x + d, ground - i, c);
      this.px(x + d * 2, ground - i - 1, c);
    }
  }
  disc(cx: number, cy: number, rad: number, c: string) {
    for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) if (i * i + j * j <= rad * rad) this.px(cx + i, cy + j, c);
  }
  stars(n: number, maxY: number, c: string) {
    for (let i = 0; i < n; i++) this.px(Math.floor(this.r() * BACKDROP_W), Math.floor(this.r() * maxY), c);
  }
  /** 上半分にまばらに点を打つ（雲・霧・火の粉） */
  speckle(y0: number, y1: number, density: number, c: string) {
    for (let y = y0; y < y1; y++) for (let x = 0; x < BACKDROP_W; x++) if (this.r() < density) this.px(x, y, c);
  }
  cloud(x: number, y: number, w: number, c: string) {
    this.rect(x + 2, y, w - 4, 1, c);
    this.rect(x, y + 1, w, 2, c);
  }
}

type Scene = (c: Canvas) => void;

const SCENES: Record<string, Scene> = {
  /** 村はずれの森：夕方の森 */
  forest: (c) => {
    c.sky(["#1b2a4a", "#2c3e63", "#4a5578", "#6e5a6e"]);
    c.ridge(20, 2, "#1f3a2a", 0.6);
    for (let x = 2; x < BACKDROP_W; x += 5 + Math.floor(c.r() * 4)) c.pine(x, 26, 8 + Math.floor(c.r() * 6), "#173322", "#0f1f15");
    c.ridge(28, 1, "#20401f", 0.3);
    for (let x = 4; x < BACKDROP_W; x += 9 + Math.floor(c.r() * 6)) c.bush(x, 32, 2 + Math.floor(c.r() * 2), "#2b5a2a", "#3a2a1a");
    c.speckle(30, 36, 0.04, "#d8c060");
  },
  /** 古い街道：昼の丘と道 */
  road: (c) => {
    c.sky(["#2a4a7a", "#3a64a0", "#5a86c0", "#80a8d0"]);
    for (let i = 0; i < 4; i++) c.cloud(10 + i * 40 + Math.floor(c.r() * 10), 6 + Math.floor(c.r() * 5), 10 + Math.floor(c.r() * 8), "#c8d8ea");
    c.ridge(18, 3, "#4a6a5a", 0.5);
    c.ridge(23, 2, "#3e6a34", 0.4);
    for (let x = 6; x < BACKDROP_W; x += 14 + Math.floor(c.r() * 10)) c.bush(x, 25, 2, "#2e5a28", "#3a2a1a");
    c.rect(0, 27, BACKDROP_W, 9, "#3e6a34");
    // 道
    c.rect(0, 29, BACKDROP_W, 4, "#8a6a42");
    c.speckle(29, 33, 0.08, "#a88a5a");
    c.speckle(33, 36, 0.06, "#5a8a40");
    // 柵
    for (let x = 3; x < BACKDROP_W; x += 6) c.rect(x, 25, 1, 3, "#6a4a2a");
    c.rect(0, 26, BACKDROP_W, 1, "#6a4a2a");
  },
  /** 忘れられた墓地：月夜 */
  graveyard: (c) => {
    c.sky(["#0c0a1e", "#16122e", "#221a40", "#2e2450"]);
    c.stars(40, 16, "#c8c0e8");
    c.disc(130, 10, 4, "#e8e0b0");
    c.disc(132, 9, 3, "#16122e");
    c.ridge(22, 2, "#1a1630", 0.5);
    for (let x = 8; x < BACKDROP_W; x += 22 + Math.floor(c.r() * 12)) c.deadTree(x, 28, 9 + Math.floor(c.r() * 4), "#0a0814");
    c.rect(0, 28, BACKDROP_W, 8, "#1e1a2e");
    for (let x = 3; x < BACKDROP_W; x += 7 + Math.floor(c.r() * 6)) {
      if (c.r() < 0.4) {
        c.rect(x + 1, 24, 1, 5, "#6a6680");
        c.rect(x, 25, 3, 1, "#6a6680");
      } else {
        c.rect(x, 25, 3, 4, "#5a5670");
        c.rect(x + 1, 24, 1, 1, "#5a5670");
      }
    }
    // 霧
    for (let y = 30; y < 34; y++) for (let x = 0; x < BACKDROP_W; x++) if ((x + y * 3) % 5 === 0 || c.r() < 0.12) c.px(x, y, "#3a3458");
  },
  /** 山の砦：雪山と城壁 */
  mountain: (c) => {
    c.sky(["#141a2e", "#1c2440", "#263052", "#323e64"]);
    c.peak(25, 8, 1.6, "#5a6684", "#dce4f0");
    c.peak(70, 5, 1.4, "#66728e", "#eef2fa");
    c.peak(118, 8, 1.5, "#5a6684", "#dce4f0");
    c.peak(150, 11, 1.7, "#4e5a78", "#dce4f0");
    c.ridge(22, 2, "#3a3e52", 0.6);
    // 城壁と塔
    c.rect(50, 18, 44, 8, "#5a5a66");
    for (let x = 50; x < 94; x += 2) c.px(x, 17, "#5a5a66");
    c.rect(56, 12, 6, 14, "#64646e");
    c.rect(82, 10, 7, 16, "#64646e");
    for (const [tx, ty, tw] of [[56, 12, 6], [82, 10, 7]] as const) for (let x = tx; x < tx + tw; x += 2) c.px(x, ty - 1, "#64646e");
    c.rect(58, 15, 2, 2, "#1a1a24");
    c.rect(85, 13, 2, 2, "#1a1a24");
    c.rect(70, 21, 4, 5, "#1a1a24");
    c.ridge(28, 1, "#2a2e3c", 0.4);
    c.speckle(0, 20, 0.01, "#e8eef8");
  },
  /** 魔竜の巣：火山と溶岩 */
  volcano: (c) => {
    c.sky(["#120406", "#2a080a", "#4a0e0c", "#6a1a10"]);
    c.speckle(0, 24, 0.012, "#f0902a");
    c.peak(80, 9, 2.2, "#2a1414");
    c.rect(76, 9, 9, 2, "#f0902a");
    c.rect(78, 7, 5, 2, "#ffd23c");
    for (let y = 11; y < 26; y++) {
      c.px(80 + Math.round(Math.sin(y / 2) * 2), y, "#e0502a");
      c.px(76 - Math.floor((y - 11) * 0.9), y, y % 3 === 0 ? "#f0902a" : "#a02a14");
    }
    c.peak(20, 14, 1.2, "#1e0e10");
    c.peak(140, 12, 1.3, "#1e0e10");
    c.ridge(25, 2, "#160a0a", 0.7);
    // 溶岩の川
    c.rect(0, 30, BACKDROP_W, 3, "#c0401c");
    for (let x = 0; x < BACKDROP_W; x++) if ((x + Math.floor(c.r() * 3)) % 4 === 0) c.px(x, 30, "#f0902a");
    c.speckle(31, 33, 0.15, "#ffd23c");
    c.rect(0, 33, BACKDROP_W, 3, "#160a0a");
  },
  /** 凍てつく峠：夜明け前の雪の峠 */
  snowpass: (c) => {
    c.sky(["#0e1a38", "#1c3058", "#3a5a88", "#8aa8c8"]);
    c.stars(30, 14, "#e8f0ff");
    c.peak(30, 9, 1.5, "#6a7a9c", "#f2f6ff");
    c.peak(88, 6, 1.4, "#74849e", "#ffffff");
    c.peak(138, 10, 1.6, "#6a7a9c", "#f2f6ff");
    c.ridge(23, 2, "#8a9ab8", 0.5);
    for (let x = 4; x < BACKDROP_W; x += 8 + Math.floor(c.r() * 6)) c.pine(x, 29, 7 + Math.floor(c.r() * 5), "#2a4a5a", "#1a2a34");
    c.rect(0, 28, BACKDROP_W, 8, "#dce8f4");
    c.speckle(28, 36, 0.08, "#ffffff");
    c.speckle(30, 36, 0.05, "#b4cce0");
    // 凍った道
    c.rect(0, 31, BACKDROP_W, 3, "#b8d4ea");
    c.speckle(31, 34, 0.1, "#e8f6ff");
  },
  /** どれにも当てはまらないとき：草原 */
  plains: (c) => {
    c.sky(["#2a3a5a", "#3a5078", "#506a90"]);
    c.ridge(22, 3, "#2e4a3a", 0.5);
    c.rect(0, 28, BACKDROP_W, 8, "#2e5a28");
    c.speckle(28, 36, 0.05, "#4a7a3a");
  },
};

export const BACKDROP_NAMES = Object.keys(SCENES);

export interface BackdropPath {
  color: string;
  d: string;
}

const cache = new Map<string, BackdropPath[]>();

/** 背景を、色ごとの path にまとめて返す（横に並んだ同じ色のドットを1本にする） */
export function backdropPaths(name: string): BackdropPath[] {
  const key = SCENES[name] ? name : "plains";
  const hit = cache.get(key);
  if (hit) return hit;
  let seed = 0;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const canvas = new Canvas(rng(seed));
  SCENES[key]!(canvas);
  const byColor = new Map<string, string[]>();
  canvas.g.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      if (c) {
        const list = byColor.get(c) ?? [];
        list.push(`M${x} ${y}h${end - x}v1h${x - end}z`);
        byColor.set(c, list);
      }
      x = end;
    }
  });
  const paths = [...byColor].map(([color, parts]) => ({ color, d: parts.join("") }));
  cache.set(key, paths);
  return paths;
}
