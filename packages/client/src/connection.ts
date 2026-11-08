// ゲームとのつなぎ口（設計書 4.1）
import {
  type Action,
  applyAction,
  battlePreview,
  type CardRegistry,
  createGame,
  currentGold,
  type DamageBreakdown,
  type GameEvent,
  type GameRecord,
  type GameState,
  heroSlots,
  isEngineError,
  type LegalActions,
  legalActions,
  newRecord,
  type PlayerView,
  viewEvents,
  viewFor,
} from "@deckbuild/core";

/** 画面に必要な、手番中の計算結果 */
export interface TurnInfo {
  gold: number;
  slots: { total: number; used: number; left: number };
  preview: (DamageBreakdown & { hp: number }) | null;
}

export interface GameUpdate {
  view: PlayerView;
  events: GameEvent[];
  legal: LegalActions;
  info: TurnInfo;
  /** 直前の操作が受け付けられなかった理由 */
  error: string | null;
}

export interface GameConnection {
  readonly playerId: string;
  readonly seed: number;
  send(action: Action): void;
  subscribe(listener: (update: GameUpdate) => void): () => void;
  current(): GameUpdate;
  /** 記録（ソロのみ） */
  record(): GameRecord | null;
}

/** ソロ：ブラウザの中で core を動かす */
export class LocalConnection implements GameConnection {
  readonly playerId = "p1";
  private state: GameState;
  private last: GameUpdate;
  private readonly rec: GameRecord;
  private readonly listeners = new Set<(u: GameUpdate) => void>();

  constructor(
    readonly seed: number,
    playerName: string,
    private readonly reg: CardRegistry,
  ) {
    const players = [{ id: this.playerId, name: playerName }];
    const created = createGame({ seed, players }, reg);
    this.state = created.state;
    this.rec = newRecord(seed, players, reg);
    this.last = this.makeUpdate(created.events, null);
  }

  send(action: Action): void {
    const r = applyAction(this.state, this.playerId, action, this.reg);
    if (isEngineError(r)) {
      this.publish(this.makeUpdate([], r.message));
      return;
    }
    this.state = r.state;
    this.rec.actions.push({ playerId: this.playerId, action });
    this.publish(this.makeUpdate(r.events, null));
  }

  subscribe(listener: (u: GameUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  current(): GameUpdate {
    return this.last;
  }

  record(): GameRecord {
    return this.rec;
  }

  private publish(u: GameUpdate) {
    this.last = u;
    for (const l of this.listeners) l(u);
  }

  private makeUpdate(events: GameEvent[], error: string | null): GameUpdate {
    const s = this.state;
    return {
      view: viewFor(s, this.playerId),
      events: viewEvents(events, this.playerId),
      legal: legalActions(s, this.playerId, this.reg),
      info: { gold: currentGold(s, this.reg), slots: heroSlots(s), preview: battlePreview(s, this.reg) },
      error,
    };
  }
}

export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! | 0;
}
