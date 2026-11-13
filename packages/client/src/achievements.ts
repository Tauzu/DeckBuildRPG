// 実績（企画書 13.2）。ゲームの終わりに判定し、進み具合に記録する
import type { CardRegistry, GameEvent, GameResult, PlayerPublicView, StageDef } from "@deckbuild/core";
import { codexIds } from "./codex.js";
import type { Progress } from "./progress.js";

/** 1ゲームの中で、自分の行動から集める記録 */
export interface GameTally {
  /** 買ったカード */
  bought: string[];
  /** 使った英雄の種類（買った・転職した。村の若者を除く） */
  heroIds: string[];
  /** 1回の攻撃で与えた最大のダメージ */
  maxHit: number;
  /** 受けた呪いの枚数 */
  cursesTaken: number;
  /** 英雄を最高レベルにした */
  reachedMaxLevel: boolean;
}

export function emptyTally(): GameTally {
  return { bought: [], heroIds: [], maxHit: 0, cursesTaken: 0, reachedMaxLevel: false };
}

/** 自分（viewerId）の行動を記録に足す */
export function addToTally(t: GameTally, events: GameEvent[], viewerId: string, reg: CardRegistry): GameTally {
  let next = t;
  const heroUsed = (defId: string) => {
    const d = reg.get(defId);
    if (d.type !== "hero" || d.level === 0) return;
    if (!next.heroIds.includes(d.heroId)) next = { ...next, heroIds: [...next.heroIds, d.heroId] };
    if (reg.heroLevels(d.heroId).at(-1)?.id === d.id) next = { ...next, reachedMaxLevel: true };
  };
  for (const e of events) {
    if (!("playerId" in e) || e.playerId !== viewerId) continue;
    if (e.type === "cardBought") {
      next = { ...next, bought: [...next.bought, e.defId] };
      heroUsed(e.defId);
    } else if (e.type === "leveledUp") heroUsed(e.toDefId);
    else if (e.type === "attackResolved") next = { ...next, maxHit: Math.max(next.maxHit, e.damage) };
    else if (e.type === "curseAdded") next = { ...next, cursesTaken: next.cursesTaken + 1 };
  }
  return next;
}

export interface EndContext {
  reg: CardRegistry;
  stage: StageDef;
  danger: number;
  playerCount: number;
  result: GameResult;
  me: PlayerPublicView;
  /** 手番の数（1人のときは自分の手番の数） */
  turnCount: number;
  villageHp: number;
  villageHpMax: number;
  tally: GameTally;
  /** このゲームの結果を記録したあとの進み具合 */
  progress: Progress;
}

export type AchievementGroup = "進行" | "戦い方" | "協力" | "通算";

export interface AchievementDef {
  id: string;
  group: AchievementGroup;
  name: string;
  text: string;
  check(c: EndContext): boolean;
}

const win = (c: EndContext) => c.result.outcome === "win";
const realStages = (reg: CardRegistry) => reg.stages.filter((s) => !s.tutorial);
const allHeroIds = (reg: CardRegistry) =>
  [...new Set(reg.stages.flatMap((s) => s.heroIds))].filter((id) => (reg.heroLevels(id)[0]?.level ?? 0) > 0);

export const SPEED_TURNS = 20;
export const SLAYER_KILLS = 25;
export const BIG_HIT = 15;
export const FRUGAL_BUYS = 5;

export const ACHIEVEMENTS: AchievementDef[] = [
  // 進行
  { id: "first_win", group: "進行", name: "はじめての勝利", text: "チュートリアル以外のステージで勝つ", check: (c) => win(c) && !c.stage.tutorial },
  {
    id: "all_stages",
    group: "進行",
    name: "辺境の守り手",
    text: "すべてのステージをクリアする",
    check: (c) => realStages(c.reg).every((s) => c.progress.cleared.includes(s.id)),
  },
  { id: "danger1", group: "進行", name: "危険を恐れず", text: "危険度1以上で勝つ", check: (c) => win(c) && c.danger >= 1 },
  { id: "danger5", group: "進行", name: "歴戦の勇士", text: "危険度3以上で勝つ", check: (c) => win(c) && c.danger >= 3 },
  { id: "danger10", group: "進行", name: "伝説の英雄", text: "最高の危険度（5）で勝つ", check: (c) => win(c) && c.danger >= 5 },
  {
    id: "all_danger10",
    group: "進行",
    name: "辺境の伝説",
    text: "すべてのステージを最高の危険度（5）でクリアする",
    check: (c) => realStages(c.reg).every((s) => (c.progress.bestDanger[s.id] ?? -1) >= c.reg.maxDanger),
  },
  // 戦い方
  { id: "flawless", group: "戦い方", name: "無傷の守り", text: "集落を無傷のまま勝つ", check: (c) => win(c) && c.villageHp >= c.villageHpMax },
  {
    id: "speedrun",
    group: "戦い方",
    name: "電光石火",
    text: `1人で、${SPEED_TURNS}手番以内に勝つ`,
    check: (c) => win(c) && c.playerCount === 1 && c.turnCount <= SPEED_TURNS && !c.stage.tutorial,
  },
  {
    id: "one_class",
    group: "戦い方",
    name: "一筋",
    text: "村の若者のほかは、1種類の英雄だけを使って勝つ",
    check: (c) => win(c) && c.tally.heroIds.length === 1 && !c.stage.tutorial,
  },
  {
    id: "no_weapon",
    group: "戦い方",
    name: "素手の勇者",
    text: "武器を1枚も買わずに勝つ",
    check: (c) => win(c) && !c.stage.tutorial && !c.tally.bought.some((id) => c.reg.get(id).type === "weapon"),
  },
  {
    id: "frugal",
    group: "戦い方",
    name: "倹約家",
    text: `買ったカードが${FRUGAL_BUYS}枚以下で勝つ`,
    check: (c) => win(c) && !c.stage.tutorial && c.tally.bought.length <= FRUGAL_BUYS,
  },
  {
    id: "no_curse",
    group: "戦い方",
    name: "清らかな魂",
    text: "最後のステージで、呪いを1枚も受けずに勝つ",
    check: (c) => win(c) && c.stage.id === c.reg.defaultStageId && c.tally.cursesTaken === 0,
  },
  { id: "big_hit", group: "戦い方", name: "会心の一撃", text: `1回の攻撃で${BIG_HIT}ダメージ以上を与える`, check: (c) => c.tally.maxHit >= BIG_HIT },
  { id: "max_level", group: "戦い方", name: "極めし者", text: "英雄を最高レベルにする", check: (c) => c.tally.reachedMaxLevel },
  { id: "slayer", group: "戦い方", name: "魔物狩り", text: `1回のゲームで魔物を${SLAYER_KILLS}体倒す`, check: (c) => c.me.kills >= SLAYER_KILLS },
  // 協力
  { id: "coop_win", group: "協力", name: "仲間とともに", text: "2人以上で勝つ", check: (c) => win(c) && c.playerCount >= 2 },
  { id: "full_party", group: "協力", name: "四人の英雄", text: "4人で勝つ", check: (c) => win(c) && c.playerCount >= 4 },
  { id: "mvp", group: "協力", name: "最優秀", text: "2人以上のゲームでMVPになる", check: (c) => c.result.mvp.includes(c.me.id) },
  // 通算
  { id: "wins10", group: "通算", name: "百戦錬磨", text: "通算で10回勝つ", check: (c) => c.progress.stats.wins >= 10 },
  { id: "kills100", group: "通算", name: "魔物の天敵", text: "通算で魔物を100体倒す", check: (c) => c.progress.stats.kills >= 100 },
  {
    id: "all_heroes",
    group: "通算",
    name: "英雄図鑑",
    text: "すべての種類の英雄で、それぞれ1回以上勝つ（その英雄を使って勝つ）",
    check: (c) => allHeroIds(c.reg).every((id) => c.progress.stats.heroWins.includes(id)),
  },
  {
    id: "codex",
    group: "通算",
    name: "博識",
    text: "カード図鑑をすべて埋める",
    check: (c) => codexIds(c.reg).every((id) => c.progress.seen.includes(id)),
  },
];

/** 英雄図鑑の進み具合（勝った種類 / 全種類） */
export function heroWinsCount(reg: CardRegistry, p: Progress): { done: number; total: number } {
  const all = allHeroIds(reg);
  return { done: all.filter((id) => p.stats.heroWins.includes(id)).length, total: all.length };
}

/** ゲームの終わりに、通算の記録を足し、新しく達成した実績を記録する */
export function recordGameEnd(c: Omit<EndContext, "progress"> & { progress: Progress }, now = Date.now()): { progress: Progress; unlocked: AchievementDef[] } {
  const p0 = c.progress;
  const won = c.result.outcome === "win";
  const progress: Progress = {
    ...p0,
    stats: {
      games: p0.stats.games + 1,
      wins: p0.stats.wins + (won ? 1 : 0),
      kills: p0.stats.kills + c.me.kills,
      heroWins: won && !c.stage.tutorial ? [...new Set([...p0.stats.heroWins, ...c.tally.heroIds])] : p0.stats.heroWins,
    },
  };
  const ctx: EndContext = { ...c, progress };
  const unlocked = ACHIEVEMENTS.filter((a) => progress.achievements[a.id] === undefined && a.check(ctx));
  if (unlocked.length === 0) return { progress, unlocked };
  const achievements = { ...progress.achievements };
  for (const a of unlocked) achievements[a.id] = now;
  return { progress: { ...progress, achievements }, unlocked };
}
