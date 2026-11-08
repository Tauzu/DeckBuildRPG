import { produce } from "immer";
import {
  type Action,
  applyAction,
  type CardInstance,
  createGame,
  defaultRegistry,
  type GameEvent,
  type GameState,
  isEngineError,
} from "../src/index.js";

export const reg = defaultRegistry();

export function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `プレイヤー${i + 1}` }));
}

export function start(n = 1, seed = 1): GameState {
  return createGame({ seed, players: players(n) }, reg).state;
}

/** 操作を実行。失敗したら例外 */
export function act(state: GameState, playerId: string, action: Action): { state: GameState; events: GameEvent[] } {
  const r = applyAction(state, playerId, action, reg);
  if (isEngineError(r)) throw new Error(`${action.type}: ${r.error} ${r.message}`);
  return r;
}

/** 操作を実行し、失敗したときのエラーコードを返す */
export function errorOf(state: GameState, playerId: string, action: Action): string | null {
  const r = applyAction(state, playerId, action, reg);
  return isEngineError(r) ? r.error : null;
}

export function mutate(state: GameState, recipe: (s: GameState) => void): GameState {
  return produce(state, recipe);
}

let testUid = 0;
export function cards(...defIds: string[]): CardInstance[] {
  return defIds.map((defId) => ({ uid: `t${++testUid}`, defId }));
}

/** プレイヤーの手札を指定のカードにする（元の手札は捨てる） */
export function setHand(state: GameState, playerIndex: number, defIds: string[]): GameState {
  return mutate(state, (s) => {
    s.players[playerIndex]!.hand = cards(...defIds);
  });
}

/** 進軍ルートの指定マスに敵を置く */
export function placeEnemy(state: GameState, square: number, defId: string): { state: GameState; uid: string } {
  const [card] = cards(defId);
  return {
    state: mutate(state, (s) => {
      s.route[square]!.push(card!);
    }),
    uid: card!.uid,
  };
}

export function hand(state: GameState, playerIndex = 0): CardInstance[] {
  return state.players[playerIndex]!.hand;
}

export function uidOf(list: readonly CardInstance[], defId: string, nth = 0): string {
  const found = list.filter((c) => c.defId === defId)[nth];
  if (!found) throw new Error(`${defId} が見つかりません`);
  return found.uid;
}

/** 状態に含まれるすべてのカード */
export function allCards(s: GameState): CardInstance[] {
  return [
    ...s.players.flatMap((p) => [...p.deck, ...p.hand, ...p.field, ...p.discard]),
    ...Object.values(s.village.stacks).flat(),
    ...s.village.curses,
    ...s.enemyDeck,
    ...s.route.flat(),
    ...s.trash,
  ];
}
