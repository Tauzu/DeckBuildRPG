// タイトル画面の背景：月夜の村と、遠くの火山、月をよぎる魔竜。外部の素材は使わず、図形を組み合わせてここで描く
import { memo, useEffect, useState } from "react";

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
  readonly g: Grid;
  constructor(
    readonly r: () => number,
    readonly W: number,
    readonly H: number,
  ) {
    this.g = Array.from({ length: H }, () => Array<string | null>(W).fill(null));
  }

  px(x: number, y: number, c: string) {
    if (x >= 0 && x < this.W && y >= 0 && y < this.H) this.g[y]![x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  disc(cx: number, cy: number, rad: number, c: string) {
    for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) if (i * i + j * j <= rad * rad) this.px(cx + i, cy + j, c);
  }
  /** 空：上から色の帯を重ね、境目は市松模様でぼかす */
  sky(colors: string[], bottom: number) {
    const band = bottom / colors.length;
    for (let y = 0; y < this.H; y++) {
      const k = Math.min(colors.length - 1, Math.floor(y / band));
      for (let x = 0; x < this.W; x++) {
        const edge = k + 1 < colors.length && y === Math.floor((k + 1) * band) - 1 && (x + y) % 2 === 0;
        this.px(x, y, edge ? colors[k + 1]! : colors[k]!);
      }
    }
  }
  ridge(base: number, amp: number, c: string, step = 0.5) {
    let h = base;
    for (let x = 0; x < this.W; x++) {
      h += (this.r() - 0.5) * 2 * step;
      h = Math.max(base - amp, Math.min(base + amp, h));
      for (let y = Math.round(h); y < this.H; y++) this.px(x, y, c);
    }
  }
  peak(cx: number, top: number, slope: number, c: string, snow?: string) {
    for (let y = top; y < this.H; y++) {
      const half = Math.floor((y - top) * slope);
      for (let x = cx - half; x <= cx + half; x++) this.px(x, y, snow && y < top + 3 ? snow : c);
    }
  }
  pine(x: number, ground: number, h: number, c: string, trunk: string) {
    this.rect(x, ground - 2, 1, 2, trunk);
    for (let i = 0; i < h; i++) {
      const half = Math.floor(i / 2);
      this.rect(x - half, ground - h - 1 + i, half * 2 + 1, 1, c);
    }
  }
  /** 家：壁・三角の屋根・明かりの灯った窓・煙突 */
  house(x: number, ground: number, w: number, h: number, wall: string, roof: string, lit: string) {
    this.rect(x, ground - h, w, h, wall);
    const rh = Math.ceil(w / 2) + 1;
    for (let i = 0; i < rh; i++) this.rect(x - 1 + i, ground - h - rh + i + 1, w + 2 - i * 2, 1, roof);
    this.rect(x + w - 3, ground - h - rh, 2, 3, roof);
    this.rect(x + 1, ground - h + 2, 2, 2, lit);
    if (w >= 8) this.rect(x + w - 3, ground - h + 2, 2, 2, lit);
    this.rect(x + Math.floor(w / 2) - 1, ground - 3, 2, 3, "#2a1a14");
  }
}

interface Layer {
  color: string;
  d: string;
}

function toPaths(g: Grid): Layer[] {
  const byColor = new Map<string, string[]>();
  g.forEach((row, y) => {
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
  return [...byColor].map(([color, parts]) => ({ color, d: parts.join("") }));
}

/** 魔竜のシルエット（頭は右向き） */
const DRAGON = [
  "...#..........#.....",
  "..##..........##....",
  "..###...####..###...",
  "...###.######.###...",
  "....##########.##...",
  ".....###########.###",
  "..#########.....####",
  ".###.......#.....#.#",
];

function spritePath(rows: string[]): string {
  const parts: string[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "#") {
        x++;
        continue;
      }
      let end = x;
      while (end < row.length && row[end] === "#") end++;
      parts.push(`M${x} ${y}h${end - x}v1h${x - end}z`);
      x = end;
    }
  });
  return parts.join("");
}

interface Scene {
  w: number;
  h: number;
  base: Layer[];
  twinkle: { x: number; y: number; delay: number }[];
  smoke: { x: number; y: number; delay: number }[];
  windows: { x: number; y: number }[];
  /** 魔竜の飛ぶ始点・終点（y は画面の高さに応じて決める） */
  fly: { x0: number; x1: number; y0: number; y1: number; sec: number };
}

const scenes = new Map<string, Scene>();

/** 横長（パソコン）は 160x90、縦長（スマホ縦持ち）は 72x128 で、それぞれ構図を変えて描く */
function build(portrait: boolean): Scene {
  const key = portrait ? "p" : "l";
  const hit = scenes.get(key);
  if (hit) return hit;
  const W = portrait ? 72 : 160;
  const H = portrait ? 128 : 90;
  const f = (landscape: number, port: number) => (portrait ? port : landscape);
  const c = new Canvas(rng(20261114 + (portrait ? 1 : 0)), W, H);
  const horizon = Math.round(H * 0.69);
  // 夜空（地平線に近いほど赤い）
  c.sky(["#070a1e", "#0d1230", "#171a40", "#2a2050", "#4a2a58", "#7a3a58", "#b4505a"], horizon);
  // 星
  const twinkle: Scene["twinkle"] = [];
  const starCount = Math.round((W * H) / 160);
  for (let i = 0; i < starCount; i++) {
    const x = Math.floor(c.r() * W);
    const y = Math.floor(c.r() * H * 0.5);
    c.px(x, y, c.r() < 0.2 ? "#ffffff" : "#b8bde8");
    if (i % 9 === 0) twinkle.push({ x, y, delay: Math.round(c.r() * 30) / 10 });
  }
  // 月（暈つき）
  const mx = f(112, 46);
  const my = f(20, 26);
  c.disc(mx, my, 12, "#1e2250");
  c.disc(mx, my, 10, "#2c3068");
  c.disc(mx, my, 8, "#f0e8bc");
  c.disc(mx + 3, my - 2, 2, "#d8cf9c");
  c.disc(mx - 4, my + 4, 1, "#d8cf9c");
  // 遠くの山
  const mt = Math.round(H * 0.44);
  if (portrait) {
    c.peak(10, mt + 6, 1.0, "#2a2252", "#8a86b8");
    c.peak(36, mt - 4, 1.1, "#32285a", "#9a96c4");
  } else {
    c.peak(24, 40, 1.0, "#2a2252", "#8a86b8");
    c.peak(58, 34, 1.1, "#32285a", "#9a96c4");
    c.peak(86, 44, 0.9, "#2a2250");
  }
  c.ridge(mt + 10, 2, "#241c46", 0.5);
  // 魔竜の火山
  const vx = f(142, 58);
  const vt = f(30, mt - 8);
  c.peak(vx, vt, 1.5, "#1a0e22");
  c.rect(vx - 5, vt - 1, 11, 2, "#f0902a");
  c.rect(vx - 3, vt - 3, 7, 2, "#ffd23c");
  for (let y = vt + 1; y < vt + 24; y++) {
    c.px(vx + Math.round(Math.sin(y / 2.2) * 2), y, y % 4 === 0 ? "#ffd23c" : "#e0502a");
    if (y % 3 === 0) c.px(vx - 5 - Math.floor((y - vt) * 0.4), y, "#a02a14");
  }
  // 火の粉
  for (let i = 0; i < 14; i++) c.px(vx - 12 + Math.floor(c.r() * 26), vt - 16 + Math.floor(c.r() * 15), c.r() < 0.5 ? "#f0902a" : "#ffd23c");
  // 丘と森
  c.ridge(horizon - 4, 3, "#161638", 0.6);
  for (let x = 2; x < W; x += 4 + Math.floor(c.r() * 4)) c.pine(x, horizon + 4, 6 + Math.floor(c.r() * 5), "#101a2e", "#0a1020");
  c.ridge(horizon + 4, 2, "#0f1a2a", 0.4);
  // 村
  const windows: Scene["windows"] = [];
  const smoke: Scene["smoke"] = [];
  const homes: [number, number, number, string, string][] = portrait
    ? [
        [3, 8, 7, "#4a3a4e", "#3a2038"],
        [17, 10, 9, "#54404a", "#4a2430"],
        [34, 9, 6, "#4a3a4e", "#36203a"],
        [50, 12, 10, "#5a443f", "#52282c"],
      ]
    : [
        [46, 8, 7, "#4a3a4e", "#3a2038"],
        [60, 10, 9, "#54404a", "#4a2430"],
        [76, 9, 6, "#4a3a4e", "#36203a"],
        [90, 12, 10, "#5a443f", "#52282c"],
        [108, 8, 7, "#4a3a4e", "#3a2038"],
      ];
  const ground = horizon + 14;
  c.rect(0, ground, W, H - ground, "#0c1622");
  for (const [x, w, h, wall, roof] of homes) {
    c.house(x, ground, w, h, wall, roof, "#ffd23c");
    windows.push({ x: x + 1, y: ground - h + 2 });
    smoke.push({ x: x + w - 3, y: ground - h - Math.ceil(w / 2) - 2, delay: Math.round(c.r() * 40) / 10 });
  }
  // 手前の道と草
  c.rect(0, ground + 2, W, 3, "#17202c");
  for (let x = 0; x < W; x++) if ((x * 7 + 3) % 5 === 0) c.px(x, ground + 3, "#2a3444");
  for (let x = 0; x < W; x++) for (let y = ground + 6; y < H - 3; y++) if (c.r() < 0.02) c.px(x, y, "#13202a");
  // 手前の大きな木
  const trees: (readonly [number, number])[] = portrait
    ? [[5, 30], [14, 22], [66, 32], [57, 20]]
    : [[6, 26], [16, 20], [150, 28], [140, 18], [30, 14]];
  for (const [x, h] of trees) c.pine(x, H - 2, h, "#08101c", "#05080e");
  c.rect(0, H - 3, W, 3, "#05080e");
  const s: Scene = {
    w: W,
    h: H,
    base: toPaths(c.g),
    twinkle,
    smoke,
    windows,
    fly: portrait ? { x0: -24, x1: W + 6, y0: 40, y1: 26, sec: 40 } : { x0: -24, x1: W + 6, y0: 12, y1: 4, sec: 70 },
  };
  scenes.set(key, s);
  return s;
}

const DRAGON_D = spritePath(DRAGON);

const PORTRAIT_QUERY = "(max-aspect-ratio: 4/5)";

function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(() => typeof matchMedia === "function" && matchMedia(PORTRAIT_QUERY).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia(PORTRAIT_QUERY);
    const on = () => setPortrait(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return portrait;
}

export const TitleScene = memo(function TitleScene() {
  const s = build(usePortrait());
  const fly = { "--fx0": `${s.fly.x0}px`, "--fx1": `${s.fly.x1}px`, "--fy0": `${s.fly.y0}px`, "--fy1": `${s.fly.y1}px`, animationDuration: `${s.fly.sec}s` } as React.CSSProperties;
  return (
    <svg
      className="title-scene"
      viewBox={`0 0 ${s.w} ${s.h}`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {s.base.map((p) => (
        <path key={p.color} fill={p.color} d={p.d} />
      ))}
      {s.twinkle.map((t, i) => (
        <rect key={i} className="ts-twinkle" x={t.x} y={t.y} width="1" height="1" fill="#ffffff" style={{ animationDelay: `${t.delay}s` }} />
      ))}
      {s.windows.map((w, i) => (
        <rect key={i} className="ts-window" x={w.x} y={w.y} width="2" height="2" fill="#fff3a0" style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
      {s.smoke.map((m, i) => (
        <rect key={i} className="ts-smoke" x={m.x} y={m.y} width="2" height="2" fill="#6a6a86" style={{ animationDelay: `${m.delay}s` }} />
      ))}
      <g className="ts-dragon" style={fly}>
        <g className="ts-dragon-bob">
          <path d={DRAGON_D} fill="#04040c" />
        </g>
      </g>
    </svg>
  );
});
