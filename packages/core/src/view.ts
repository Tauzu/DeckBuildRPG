// プレイヤーごとに見える情報（仕様書 6.3、設計書 2.11）
import type {
  CardInstance,
  GameConfig,
  GameEvent,
  GameResult,
  GameState,
  Pending,
  StackId,
  Step,
  TurnState,
} from "./types.js";

export interface PlayerPublicView {
  id: string;
  name: string;
  handCount: number;
  deckCount: number;
  discardCount: number;
  discardTop: CardInstance | null;
  field: CardInstance[];
  exp: number;
  totalExp: number;
  kills: number;
  /** 本人のときだけ入る */
  hand?: CardInstance[];
  /** 本人のときだけ入る */
  discard?: CardInstance[];
}

export interface PlayerView {
  viewerId: string;
  config: GameConfig;
  turnCount: number;
  currentPlayerId: string;
  step: Step;
  turn: TurnState | null;
  pending: Pending | null;
  players: PlayerPublicView[];
  village: { stacks: Record<StackId, { top: CardInstance | null; count: number }>; curseCount: number };
  enemyDeckCount: number;
  route: CardInstance[][];
  villageHp: number;
  trashCount: number;
  result: GameResult | null;
}

export function viewFor(s: GameState, viewerId: string): PlayerView {
  const stacks: PlayerView["village"]["stacks"] = {};
  for (const [id, stack] of Object.entries(s.village.stacks)) stacks[id] = { top: stack[0] ?? null, count: stack.length };
  return {
    viewerId,
    config: s.config,
    turnCount: s.turnCount,
    currentPlayerId: s.players[s.currentPlayer]?.id ?? "",
    step: s.step,
    turn: s.turn,
    pending: s.pending,
    players: s.players.map((p) => {
      const pub: PlayerPublicView = {
        id: p.id,
        name: p.name,
        handCount: p.hand.length,
        deckCount: p.deck.length,
        discardCount: p.discard.length,
        discardTop: p.discard[p.discard.length - 1] ?? null,
        field: p.field,
        exp: p.exp,
        totalExp: p.totalExp,
        kills: p.kills,
      };
      if (p.id === viewerId) {
        pub.hand = p.hand;
        pub.discard = p.discard;
      }
      return pub;
    }),
    village: { stacks, curseCount: s.village.curses.length },
    enemyDeckCount: s.enemyDeck.length,
    route: s.route,
    villageHp: s.villageHp,
    trashCount: s.trash.length,
    result: s.result,
  };
}

/** 他のプレイヤーに見せてはいけない情報をイベントから消す */
export function viewEvents(events: readonly GameEvent[], viewerId: string): GameEvent[] {
  return events.map((e) => (e.type === "cardsDrawn" && e.playerId !== viewerId ? { ...e, uids: [] } : e));
}
