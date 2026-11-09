// プレイヤー1人に送る「更新」（設計書 4.1）。ソロ（ブラウザ）とマルチ（サーバー）で同じものを使う
import type { CardRegistry } from "./data/registry.js";
import { type LegalActions, legalActions } from "./engine.js";
import { battlePreview, currentGold, type DamageBreakdown, heroSlots } from "./rules.js";
import type { GameEvent, GameState } from "./types.js";
import { type PlayerView, viewEvents, viewFor } from "./view.js";

/** 画面に必要な、手番中の計算結果 */
export interface TurnInfo {
  gold: number;
  slots: { total: number; used: number; left: number };
  preview: (DamageBreakdown & { hp: number; prevDamage: number }) | null;
}

export interface GameUpdate {
  view: PlayerView;
  events: GameEvent[];
  legal: LegalActions;
  info: TurnInfo;
  /** 直前の操作が受け付けられなかった理由 */
  error: string | null;
}

/** playerId から見た更新を作る。手番プレイヤー以外の戦闘のダメージ見込みも見えてよい（場は公開情報） */
export function buildUpdate(
  s: GameState,
  events: GameEvent[],
  playerId: string,
  reg: CardRegistry,
  error: string | null = null,
): GameUpdate {
  return {
    view: viewFor(s, playerId),
    events: viewEvents(events, playerId),
    legal: legalActions(s, playerId, reg),
    info: { gold: currentGold(s, reg), slots: heroSlots(s), preview: battlePreview(s, reg) },
    error,
  };
}
