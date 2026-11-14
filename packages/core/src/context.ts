// エンジン内部で使う共通の道具
import type { CardRegistry } from "./data/registry.js";
import { shuffleInPlace } from "./rng.js";
import type { CardInstance, CardId, ErrorCode, GameEvent, GameState, PlayerState } from "./types.js";

/** ルール違反。applyAction の中で投げると、状態を変えずにエラーとして返る */
export class RuleError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "RuleError";
  }
}

export function fail(code: ErrorCode, message?: string): never {
  throw new RuleError(code, message);
}

export interface Ctx {
  /** Immer の draft（そのまま書き換えてよい） */
  s: GameState;
  reg: CardRegistry;
  events: GameEvent[];
}

export function newCard(s: GameState, defId: CardId): CardInstance {
  const card = { uid: `c${s.nextUid}`, defId };
  s.nextUid += 1;
  return card;
}

export function currentPlayer(s: GameState): PlayerState {
  const p = s.players[s.currentPlayer];
  if (!p) throw new Error("手番プレイヤーが見つかりません");
  return p;
}

export function playerById(s: GameState, id: string): PlayerState {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new Error(`プレイヤーが見つかりません: ${id}`);
  return p;
}

/** list から uid のカードを取り除いて返す。なければ null */
export function takeCard(list: CardInstance[], uid: string): CardInstance | null {
  const i = list.findIndex((c) => c.uid === uid);
  if (i < 0) return null;
  const [card] = list.splice(i, 1);
  return card ?? null;
}

export function findCard(list: readonly CardInstance[], uid: string): CardInstance | undefined {
  return list.find((c) => c.uid === uid);
}

/** 山札から n 枚引く（仕様書 5.1「カードを引くときの処理」）。引いたカードの uid を返す */
export function drawCards(ctx: Ctx, player: PlayerState, n: number): string[] {
  const drawn: string[] = [];
  for (let i = 0; i < n; i++) {
    if (player.deck.length === 0) {
      if (player.discard.length === 0) break;
      player.deck.push(...player.discard.splice(0));
      shuffleInPlace(ctx.s, player.deck);
      ctx.events.push({ type: "deckShuffled", playerId: player.id });
    }
    const card = player.deck.shift();
    if (!card) break;
    player.hand.push(card);
    drawn.push(card.uid);
  }
  if (n > 0) ctx.events.push({ type: "cardsDrawn", playerId: player.id, count: drawn.length, uids: drawn });
  return drawn;
}

/** 敵が取り除かれたとき、凍結・分裂済みの記録を消す */
export function forgetEnemy(s: GameState, uid: string): void {
  s.frozen = s.frozen.filter((u) => u !== uid);
  s.split = s.split.filter((u) => u !== uid);
}

export function heroStackId(heroId: string): string {
  return `hero:${heroId}`;
}

export function assertUnique(uids: readonly string[]): void {
  if (new Set(uids).size !== uids.length) fail("INVALID_SELECTION", "同じカードが2回選ばれています");
}
