// ゲームとのつなぎ口（設計書 4.1）
import {
  type Action,
  applyAction,
  buildUpdate,
  type CardRegistry,
  createGame,
  type GameEvent,
  type GameRecord,
  type GameState,
  type GameUpdate,
  isEngineError,
  newRecord,
} from "@deckbuild/core";

export type { GameUpdate, TurnInfo } from "@deckbuild/core";

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
    stageId: string = reg.defaultStageId,
  ) {
    const players = [{ id: this.playerId, name: playerName }];
    const created = createGame({ seed, players, stageId }, reg);
    this.state = created.state;
    this.rec = newRecord(seed, players, reg, stageId);
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
    return buildUpdate(this.state, events, this.playerId, this.reg, error);
  }
}

export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! | 0;
}

/** マルチ：サーバーから届いた更新を画面に流す。操作はサーバーへ送る（設計書 4.1） */
export class RemoteConnection implements GameConnection {
  readonly seed = 0;
  private last: GameUpdate;
  private readonly listeners = new Set<(u: GameUpdate) => void>();

  constructor(
    readonly playerId: string,
    first: GameUpdate,
    private readonly sendAction: (action: Action) => void,
  ) {
    this.last = first;
  }

  send(action: Action): void {
    this.sendAction(action);
  }

  /** サーバーから届いた更新（エラーは直前の画面のまま理由だけ付ける） */
  push(u: GameUpdate): void {
    this.last = u;
    for (const l of this.listeners) l(u);
  }

  pushError(message: string): void {
    this.push({ ...this.last, events: [], error: message });
  }

  subscribe(listener: (u: GameUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  current(): GameUpdate {
    return this.last;
  }

  record(): null {
    return null;
  }
}
