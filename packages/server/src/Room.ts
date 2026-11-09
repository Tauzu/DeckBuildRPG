// 1つのルーム（設計書 5.2〜5.4）。参加者、ゲーム状態、タイマーを持つ
import { randomBytes, randomInt } from "node:crypto";
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
  timeoutAction,
} from "@deckbuild/core";
import { MAX_PLAYERS, type RoomInfo } from "./protocol.js";

export interface Member {
  playerId: string;
  name: string;
  token: string;
  socketId: string | null;
  /** 接続が切れた時刻。つながっていれば null */
  disconnectedAt: number | null;
  /** 席の保持時間が過ぎた・退出した・放置が続いたので、手番を自動で進める */
  auto: boolean;
  /** つながっているのに操作がなく、代わりに進めた回数（自分で操作すると 0 に戻る） */
  idleStrikes: number;
}

/** ルームから外へ出す処理（ソケットへの送信など）。テストでは差し替える */
export interface RoomHooks {
  sendRoom(socketId: string, room: RoomInfo): void;
  sendState(socketId: string, update: GameUpdate): void;
  sendError(socketId: string, message: string): void;
  /** 参加者が誰もいなくなり、削除してよくなった */
  onDispose(room: Room): void;
  log(message: string, data?: unknown): void;
}

/** 放置で代わりに進めた回数がこれになったら、以後その人は自動で進める */
export const IDLE_STRIKES_TO_AUTO = 2;

/** タイマーの時間（ミリ秒）。設計書 5.4 */
export interface RoomTimings {
  /** 手札を捨てる選択の制限時間 */
  pendingMs: number;
  /** 接続が切れた人の手番を自動で進めるまで */
  disconnectedTurnMs: number;
  /** つながっている人が何も操作しないとき、代わりに進めるまで */
  idleTurnMs: number;
  /** 接続が切れた人の席を残す時間 */
  seatMs: number;
  /** 誰もつながっていないルームを消すまで */
  emptyRoomMs: number;
}

export const DEFAULT_TIMINGS: RoomTimings = {
  pendingMs: 30_000,
  disconnectedTurnMs: 30_000,
  idleTurnMs: 60_000,
  seatMs: 5 * 60_000,
  emptyRoomMs: 10 * 60_000,
};

export class RoomError extends Error {}

export class Room {
  hostId: string;
  stageId: string;
  danger = 0;
  readonly members: Member[] = [];
  state: GameState | null = null;
  record: GameRecord | null = null;
  /** 状態が変わるたびに増やす。古いタイマーが動かないようにするため */
  private version = 0;
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /** タイマーが切れる時刻 */
  private readonly timerEnds = new Map<string, number>();
  private nextSeat = 1;

  constructor(
    readonly code: string,
    private readonly reg: CardRegistry,
    private readonly hooks: RoomHooks,
    private readonly timings: RoomTimings = DEFAULT_TIMINGS,
    stageId: string = reg.defaultStageId,
    danger = 0,
  ) {
    this.hostId = "";
    this.stageId = stageId;
    this.danger = this.checkDanger(stageId, danger);
  }

  /** 危険度がそのステージで選べるか確かめる */
  private checkDanger(stageId: string, danger: number): number {
    if (danger > this.reg.maxDanger) throw new RoomError(`危険度は ${this.reg.maxDanger} までです`);
    if (danger > 0 && this.reg.stage(stageId).tutorial) throw new RoomError("チュートリアルには危険度がありません");
    return danger;
  }

  get started(): boolean {
    return this.state !== null;
  }

  info(): RoomInfo {
    return {
      code: this.code,
      hostId: this.hostId,
      stageId: this.stageId,
      danger: this.danger,
      started: this.started,
      members: this.members.map((m) => ({ id: m.playerId, name: m.name, connected: m.socketId !== null, auto: m.auto })),
    };
  }

  member(playerId: string): Member | undefined {
    return this.members.find((m) => m.playerId === playerId);
  }

  memberBySocket(socketId: string): Member | undefined {
    return this.members.find((m) => m.socketId === socketId);
  }

  // -------------------------------------------------------------------------
  // 参加・退出・再接続

  /** 新しく参加する。最初の参加者がホストになる */
  join(name: string, socketId: string): Member {
    if (this.started) throw new RoomError("ゲームはもう始まっています");
    if (this.members.length >= MAX_PLAYERS) throw new RoomError(`ルームは${MAX_PLAYERS}人までです`);
    const m: Member = {
      playerId: `p${this.nextSeat++}`,
      name,
      token: randomBytes(16).toString("hex"),
      socketId,
      disconnectedAt: null,
      auto: false,
      idleStrikes: 0,
    };
    this.members.push(m);
    if (!this.hostId) this.hostId = m.playerId;
    this.clearTimer("empty");
    this.broadcastRoom();
    return m;
  }

  /** トークンが一致すれば、同じ席に戻る */
  resume(token: string, socketId: string): Member {
    const m = this.members.find((x) => x.token === token);
    if (!m) throw new RoomError("このルームの席が見つかりません");
    if (m.socketId && m.socketId !== socketId) this.hooks.sendError(m.socketId, "別の画面から接続し直しました");
    m.socketId = socketId;
    m.disconnectedAt = null;
    m.auto = false;
    m.idleStrikes = 0;
    this.clearTimer(`seat:${m.playerId}`);
    this.clearTimer("empty");
    this.broadcastRoom();
    if (this.state) {
      this.schedule();
      this.hooks.sendState(socketId, this.updateFor(m.playerId, []));
    }
    return m;
  }

  /** 接続が切れた。席は残す */
  disconnect(socketId: string): void {
    const m = this.memberBySocket(socketId);
    if (!m) return;
    m.socketId = null;
    m.disconnectedAt = Date.now();
    if (!this.started) {
      // 待機中は席を残す必要がない
      this.remove(m);
      return;
    }
    this.setTimer(`seat:${m.playerId}`, this.timings.seatMs, () => {
      m.auto = true;
      this.hooks.log("席の保持時間が過ぎた", { room: this.code, player: m.playerId });
      this.broadcastRoom();
      this.runAutomation();
    });
    this.broadcastRoom();
    this.schedule();
    this.checkEmpty();
  }

  /** 自分から退出する */
  leave(socketId: string): void {
    const m = this.memberBySocket(socketId);
    if (!m) return;
    if (!this.started) {
      this.remove(m);
      return;
    }
    m.socketId = null;
    m.disconnectedAt = Date.now();
    m.auto = true;
    this.clearTimer(`seat:${m.playerId}`);
    this.broadcastRoom();
    this.runAutomation();
    this.checkEmpty();
  }

  private remove(m: Member): void {
    this.members.splice(this.members.indexOf(m), 1);
    if (this.hostId === m.playerId) this.hostId = this.members[0]?.playerId ?? "";
    this.broadcastRoom();
    this.checkEmpty();
  }

  private checkEmpty(): void {
    if (this.members.some((m) => m.socketId !== null)) return;
    if (this.members.length === 0) {
      this.dispose();
      return;
    }
    this.setTimer("empty", this.timings.emptyRoomMs, () => this.dispose());
  }

  dispose(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.hooks.onDispose(this);
  }

  // -------------------------------------------------------------------------
  // 待機中の操作（ホストのみ）

  setStage(playerId: string, stageId: string, danger = 0): void {
    this.requireHost(playerId);
    if (this.started) throw new RoomError("ゲーム中はステージを変えられません");
    if (!this.reg.stages.some((s) => s.id === stageId)) throw new RoomError("そのステージはありません");
    this.danger = this.checkDanger(stageId, danger);
    this.stageId = stageId;
    this.broadcastRoom();
  }

  start(playerId: string, seed: number = randomInt(0, 2 ** 31)): void {
    this.requireHost(playerId);
    if (this.started) throw new RoomError("ゲームはもう始まっています");
    const stage = this.reg.stage(this.stageId);
    const n = this.members.length;
    if (!stage.playerCounts[String(n) as "1"]) {
      const ok = Object.keys(stage.playerCounts).join("・");
      throw new RoomError(`「${stage.name}」は${ok}人で遊ぶステージです（今は${n}人）`);
    }
    const players = this.members.map((m) => ({ id: m.playerId, name: m.name }));
    const created = createGame({ seed, players, stageId: this.stageId, danger: this.danger }, this.reg);
    this.state = created.state;
    this.record = newRecord(seed, players, this.reg, this.stageId, this.danger);
    this.hooks.log("ゲーム開始", { room: this.code, stage: this.stageId, danger: this.danger, players: n, seed });
    this.broadcastRoom();
    this.afterChange(created.events);
  }

  /** 結果が出たあと、同じ顔ぶれで待機に戻る */
  backToLobby(playerId: string): void {
    this.requireHost(playerId);
    if (!this.state?.result) throw new RoomError("ゲームが終わってから戻れます");
    this.state = null;
    this.record = null;
    this.version++;
    this.clearTimer("pending");
    this.clearTimer("turn");
    // 戻らなかった人（自動になった人・つながっていない人）は外す
    for (const m of [...this.members]) {
      if (m.socketId === null) this.members.splice(this.members.indexOf(m), 1);
    }
    if (!this.member(this.hostId)) this.hostId = this.members[0]?.playerId ?? "";
    this.broadcastRoom();
  }

  private requireHost(playerId: string): void {
    if (playerId !== this.hostId) throw new RoomError("ルームを作った人だけができる操作です");
  }

  // -------------------------------------------------------------------------
  // ゲームの操作（設計書 5.2 の handleAction）

  handleAction(playerId: string, action: Action): void {
    const m = this.member(playerId);
    if (!this.state || !m) return;
    // つながっている人が操作したら、放置で自動になっていても戻る
    if (m.socketId !== null && (m.auto || m.idleStrikes > 0)) {
      const wasAuto = m.auto;
      m.auto = false;
      m.idleStrikes = 0;
      if (wasAuto) this.broadcastRoom();
    }
    const r = applyAction(this.state, playerId, action, this.reg);
    if (isEngineError(r)) {
      if (m.socketId) this.hooks.sendError(m.socketId, r.message);
      return;
    }
    this.commit(playerId, action, r.state, r.events);
    this.runAutomation();
  }

  private commit(playerId: string, action: Action, state: GameState, events: GameEvent[]): void {
    this.state = state;
    this.record?.actions.push({ playerId, action });
    this.afterChange(events);
  }

  private afterChange(events: GameEvent[]): void {
    this.version++;
    if (this.state?.result) {
      this.clearTimer("pending");
      this.clearTimer("turn");
      this.broadcastState(events);
      this.hooks.log("ゲーム終了", { room: this.code, result: this.state.result.outcome, turns: this.state.turnCount });
      return;
    }
    // 残り時間を更新に載せるため、タイマーを付けてから送る
    this.schedule();
    this.broadcastState(events);
  }

  /** 今入力を待っているプレイヤー */
  waitingFor(): string[] {
    const s = this.state;
    if (!s || s.result) return [];
    const p = s.pending;
    if (p?.kind === "discard") return p.requests.filter((r) => !r.done).map((r) => r.playerId);
    if (p?.kind === "trash") return [p.playerId];
    const cur = s.players[s.currentPlayer];
    return cur ? [cur.id] : [];
  }

  /** 自動で進める人（席の保持時間が過ぎた人）の入力を、すぐに代わりに行う */
  private runAutomation(): void {
    for (let guard = 0; guard < 500; guard++) {
      const s = this.state;
      if (!s || s.result) return;
      const auto = this.waitingFor().find((id) => this.member(id)?.auto);
      if (!auto) return;
      if (!this.autoAct(auto)) return;
    }
    this.hooks.log("自動の操作が多すぎるため止めた", { room: this.code });
  }

  /** timeoutAction で代わりの操作を1つ行う。行えたら true */
  private autoAct(playerId: string): boolean {
    const s = this.state;
    if (!s) return false;
    const action = timeoutAction(s, playerId);
    if (!action) return false;
    const r = applyAction(s, playerId, action, this.reg);
    if (isEngineError(r)) {
      this.hooks.log("代わりの操作が失敗した", { room: this.code, playerId, action, error: r.message, record: this.record });
      return false;
    }
    this.commit(playerId, action, r.state, r.events);
    return true;
  }

  /** 制限時間のタイマーを付け直す（設計書 5.4） */
  private schedule(): void {
    this.clearTimer("pending");
    this.clearTimer("turn");
    const s = this.state;
    if (!s || s.result) return;
    const v = this.version;
    const waiting = this.waitingFor();
    if (s.pending?.kind === "discard") {
      // 手札を捨てる選択は、全員に制限時間がある
      this.setTimer("pending", this.timings.pendingMs, () => {
        if (this.version !== v) return;
        for (const id of this.waitingFor()) this.autoAct(id);
        this.runAutomation();
      });
      return;
    }
    // 接続が切れている人の手番（と廃棄の選択）
    const offline = waiting.find((id) => {
      const m = this.member(id);
      return m && m.socketId === null && !m.auto;
    });
    if (offline) {
      this.setTimer("turn", this.timings.disconnectedTurnMs, () => {
        if (this.version !== v) return;
        // その人の入力待ちが続く限り代わりに進める（手番が終わるまで）
        for (let guard = 0; guard < 50 && this.waitingFor().includes(offline); guard++) {
          if (!this.autoAct(offline)) break;
        }
        this.runAutomation();
      });
      return;
    }
    // つながっているのに何も操作しない人の手番
    const idle = waiting.find((id) => {
      const m = this.member(id);
      return m && m.socketId !== null && !m.auto;
    });
    if (idle) {
      this.setTimer("turn", this.timings.idleTurnMs, () => {
        if (this.version !== v) return;
        const m = this.member(idle);
        if (!m) return;
        for (let guard = 0; guard < 50 && this.waitingFor().includes(idle); guard++) {
          if (!this.autoAct(idle)) break;
        }
        m.idleStrikes++;
        if (m.idleStrikes >= IDLE_STRIKES_TO_AUTO) {
          m.auto = true;
          this.hooks.log("放置が続いたため自動にした", { room: this.code, player: idle });
          this.broadcastRoom();
        }
        this.runAutomation();
      });
    }
  }

  private setTimer(key: string, ms: number, fn: () => void): void {
    this.clearTimer(key);
    this.timerEnds.set(key, Date.now() + ms);
    const t = setTimeout(() => {
      this.timers.delete(key);
      this.timerEnds.delete(key);
      try {
        fn();
      } catch (e) {
        this.hooks.log("タイマーの処理で例外", { room: this.code, error: String(e), record: this.record });
      }
    }, ms);
    t.unref?.();
    this.timers.set(key, t);
  }

  private clearTimer(key: string): void {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.delete(key);
    this.timerEnds.delete(key);
  }

  /** 今の入力待ちの残り時間（ミリ秒）。制限がなければ null */
  private timeLeft(): number | null {
    const end = this.timerEnds.get("pending") ?? this.timerEnds.get("turn");
    return end === undefined ? null : Math.max(0, end - Date.now());
  }

  private updateFor(playerId: string, events: GameEvent[]): GameUpdate {
    return { ...buildUpdate(this.state!, events, playerId, this.reg), timeLeftMs: this.timeLeft() };
  }

  // -------------------------------------------------------------------------
  // 送信

  broadcastRoom(): void {
    const info = this.info();
    for (const m of this.members) if (m.socketId) this.hooks.sendRoom(m.socketId, info);
  }

  private broadcastState(events: GameEvent[]): void {
    const s = this.state;
    if (!s) return;
    for (const m of this.members) {
      if (m.socketId) this.hooks.sendState(m.socketId, this.updateFor(m.playerId, events));
    }
  }
}
