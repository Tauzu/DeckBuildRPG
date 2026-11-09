// マルチプレイの通信（仕様書 9章、設計書 5.3）。Socket.IO でサーバーとやりとりする
import type { Action, GameUpdate } from "@deckbuild/core";
import { io, type Socket } from "socket.io-client";

export interface MemberInfo {
  id: string;
  name: string;
  connected: boolean;
  auto: boolean;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  stageId: string;
  danger: number;
  started: boolean;
  members: MemberInfo[];
}

/** 再接続に使う情報。ブラウザに保存する */
export interface Session {
  code: string;
  playerId: string;
  token: string;
}

type JoinReply = { ok: true; code: string; playerId: string; token: string } | { ok: false; error: string };
type Reply = { ok: true } | { ok: false; error: string };

const SESSION_KEY = "deckbuild.room.v1";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    return typeof s.code === "string" && typeof s.playerId === "string" && typeof s.token === "string"
      ? { code: s.code, playerId: s.playerId, token: s.token }
      : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // 保存できない環境では再接続できないだけ
  }
}

export interface OnlineHandlers {
  room(room: RoomInfo): void;
  state(update: GameUpdate): void;
  error(message: string): void;
  /** 接続の状態が変わった */
  connection(connected: boolean): void;
  /** 再接続しようとしたが、ルームか席がもうなかった */
  lost(message: string): void;
}

export class Online {
  private readonly socket: Socket;
  session: Session | null = loadSession();

  constructor(private readonly h: OnlineHandlers) {
    // 開発中も本番も、画面を配信しているのと同じ場所につなぐ（開発中は Vite が中継する）
    this.socket = io({ transports: ["websocket", "polling"] });
    this.socket.on("room:update", (r: RoomInfo) => h.room(r));
    this.socket.on("game:state", (u: GameUpdate) => h.state(u));
    this.socket.on("game:error", (m: string) => h.error(m));
    this.socket.on("disconnect", () => h.connection(false));
    this.socket.on("connect", () => {
      h.connection(true);
      // つながるたび（再接続を含む）に、席があれば戻る
      if (this.session) void this.resume();
    });
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  private ask<T>(event: string, ...args: unknown[]): Promise<T> {
    return new Promise((ok) => {
      this.socket.timeout(8000).emit(event, ...args, (err: Error | null, r: T) => {
        ok(err ? ({ ok: false, error: "サーバーに接続できません" } as T) : r);
      });
    });
  }

  private async enter(event: string, msg: unknown): Promise<Reply> {
    const r = await this.ask<JoinReply>(event, msg);
    if (!r.ok) return r;
    this.session = { code: r.code, playerId: r.playerId, token: r.token };
    saveSession(this.session);
    return { ok: true };
  }

  create(name: string, stageId: string, danger: number): Promise<Reply> {
    return this.enter("room:create", { name, stageId, danger });
  }

  join(code: string, name: string): Promise<Reply> {
    return this.enter("room:join", { code, name });
  }

  async resume(): Promise<void> {
    const s = this.session;
    if (!s) return;
    const r = await this.ask<JoinReply>("room:resume", { code: s.code, token: s.token });
    if (!r.ok && this.session === s) {
      this.session = null;
      saveSession(null);
      this.h.lost(r.error);
    }
  }

  setStage(stageId: string, danger: number): Promise<Reply> {
    return this.ask("room:setStage", { stageId, danger });
  }

  start(): Promise<Reply> {
    return this.ask("room:start");
  }

  backToLobby(): Promise<Reply> {
    return this.ask("room:backToLobby");
  }

  leave(): void {
    this.socket.emit("room:leave");
    this.session = null;
    saveSession(null);
  }

  action(action: Action): void {
    this.socket.emit("game:action", { action });
  }
}
