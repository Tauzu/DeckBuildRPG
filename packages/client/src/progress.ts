// 進み具合（企画書 12.4、13章）。ブラウザに保存する。引き継ぎコードで書き出し・読み込みできる
import type { StageDef } from "@deckbuild/core";

const KEY = "deckbuild.progress.v2";
const OLD_KEY = "deckbuild.progress.v1";

export interface Progress {
  /** クリアしたステージのID（危険度は問わない） */
  cleared: string[];
  /** ステージごとの、クリアした最高の危険度（0 は通常） */
  bestDanger: Record<string, number>;
  /** 達成した実績（ID → 達成した日時） */
  achievements: Record<string, number>;
  /** 通算の記録 */
  stats: Stats;
  /** カード図鑑：ゲームで見たカード */
  seen: string[];
}

export interface Stats {
  games: number;
  wins: number;
  kills: number;
  /** 勝ったときに使っていた英雄の種類（村の若者を除く） */
  heroWins: string[];
}

export function emptyProgress(): Progress {
  return { cleared: [], bestDanger: {}, achievements: {}, stats: { games: 0, wins: 0, kills: 0, heroWins: [] }, seen: [] };
}

const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);
const count = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
function numbers(x: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  return out;
}

/** 保存されていた値（や引き継ぎコードの中身）を、正しい形にそろえる。おかしな値は捨てる */
export function normalizeProgress(raw: unknown): Progress {
  const p = emptyProgress();
  if (!raw || typeof raw !== "object") return p;
  const d = raw as Record<string, unknown>;
  p.cleared = [...new Set(strings(d.cleared))];
  p.bestDanger = numbers(d.bestDanger);
  // 古い形（v1）にはクリアの記録だけがある：危険度0でクリアしたことにする
  for (const id of p.cleared) p.bestDanger[id] = Math.max(p.bestDanger[id] ?? 0, 0);
  p.achievements = numbers(d.achievements);
  const st = (d.stats && typeof d.stats === "object" ? d.stats : {}) as Record<string, unknown>;
  p.stats = { games: count(st.games), wins: count(st.wins), kills: count(st.kills), heroWins: [...new Set(strings(st.heroWins))] };
  p.seen = [...new Set(strings(d.seen))];
  return p;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    return raw ? normalizeProgress(JSON.parse(raw)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 保存できない環境（プライベートウィンドウなど）では、この画面を開いている間だけ覚えておく
  }
}

/** クリアを記録する。新しく解放されたもの（ステージのクリア・次の危険度）を返す */
export function markCleared(p: Progress, stageId: string, danger: number): { progress: Progress; newStage: boolean; newDanger: boolean } {
  const newStage = !p.cleared.includes(stageId);
  const best = p.bestDanger[stageId];
  const newDanger = best === undefined || danger > best;
  if (!newStage && !newDanger) return { progress: p, newStage, newDanger };
  return {
    progress: {
      ...p,
      cleared: newStage ? [...p.cleared, stageId] : p.cleared,
      bestDanger: { ...p.bestDanger, [stageId]: Math.max(best ?? 0, danger) },
    },
    newStage,
    newDanger,
  };
}

/** 遊べるか：最初のステージ（チュートリアル）はいつでも、それ以外は1つ前をクリアしていれば */
export function isUnlocked(stages: StageDef[], p: Progress, stageId: string): boolean {
  const i = stages.findIndex((s) => s.id === stageId);
  if (i <= 0) return i === 0;
  return p.cleared.includes(stages[i - 1]!.id);
}

/** そのステージで選べる最高の危険度（クリアした最高の危険度 +1。まだクリアしていなければ 0） */
export function maxDangerFor(stage: StageDef, p: Progress, maxDanger: number): number {
  if (stage.tutorial) return 0;
  const best = p.bestDanger[stage.id];
  return best === undefined ? 0 : Math.min(maxDanger, best + 1);
}

/** ステージ選択が解放されているか（チュートリアルをクリアしたら） */
export function stageSelectUnlocked(stages: StageDef[], p: Progress): boolean {
  const tutorial = stages.find((s) => s.tutorial);
  return !tutorial || p.cleared.includes(tutorial.id);
}

/** 次のステージ */
export function nextStage(stages: StageDef[], stageId: string): StageDef | null {
  const i = stages.findIndex((s) => s.id === stageId);
  return i >= 0 ? (stages[i + 1] ?? null) : null;
}

/** 2つの進み具合を合わせる。どちらの記録も消さない（クリア・実績は合わせ、数は大きいほう） */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const bestDanger = { ...a.bestDanger };
  for (const [k, v] of Object.entries(b.bestDanger)) bestDanger[k] = Math.max(bestDanger[k] ?? v, v);
  const achievements = { ...a.achievements };
  for (const [k, v] of Object.entries(b.achievements)) achievements[k] = Math.min(achievements[k] ?? v, v);
  return {
    cleared: [...new Set([...a.cleared, ...b.cleared])],
    bestDanger,
    achievements,
    stats: {
      games: Math.max(a.stats.games, b.stats.games),
      wins: Math.max(a.stats.wins, b.stats.wins),
      kills: Math.max(a.stats.kills, b.stats.kills),
      heroWins: [...new Set([...a.stats.heroWins, ...b.stats.heroWins])],
    },
    seen: [...new Set([...a.seen, ...b.seen])],
  };
}

// ---------------------------------------------------------------------------
// 引き継ぎコード：進み具合の JSON を圧縮して、英数字の文字列にする。
// 形：「HK1-」＋本体＋「-」＋確かめ用の4文字。打ち間違い・貼り間違いを見つけられる

const PREFIX = "HK1-";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).slice(-4).padStart(4, "0").toUpperCase();
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function exportCode(p: Progress): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(p));
  const body = toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
  return `${PREFIX}${body}-${checksum(body)}`;
}

export class CodeError extends Error {}

export async function importCode(code: string): Promise<Progress> {
  const text = code.replace(/\s+/g, "");
  if (!text.startsWith(PREFIX)) throw new CodeError("引き継ぎコードではありません（「HK1-」で始まります）");
  const rest = text.slice(PREFIX.length);
  const cut = rest.lastIndexOf("-");
  if (cut < 0) throw new CodeError("引き継ぎコードが途中で切れています");
  const body = rest.slice(0, cut);
  if (checksum(body) !== rest.slice(cut + 1).toUpperCase()) throw new CodeError("引き継ぎコードが正しくありません（一部が欠けているか、違う文字が入っています）");
  try {
    const json = await pipe(fromBase64Url(body), new DecompressionStream("deflate-raw"));
    return normalizeProgress(JSON.parse(new TextDecoder().decode(json)));
  } catch {
    throw new CodeError("引き継ぎコードを読み取れませんでした");
  }
}
