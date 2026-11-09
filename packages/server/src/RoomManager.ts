// ルームの作成・検索・削除と、ソケットのメッセージの受け口（設計書 5.1）
import { randomInt } from "node:crypto";
import type { CardRegistry } from "@deckbuild/core";
import type { Server, Socket } from "socket.io";
import {
  actionMessageSchema,
  type ClientToServer,
  createSchema,
  joinSchema,
  type JoinReply,
  type Reply,
  resumeSchema,
  type ServerToClient,
  setStageSchema,
  zodMessage,
} from "./protocol.js";
import { DEFAULT_TIMINGS, Room, RoomError, type RoomHooks, type RoomTimings } from "./Room.js";

/** 同時に存在できるルームの数の既定値。環境変数 MAX_ROOMS で変えられる */
const MAX_ROOMS = Number(process.env.MAX_ROOMS ?? 200);

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 見間違えやすい O/0・I/1 は使わない

type IoServer = Server<ClientToServer, ServerToClient>;
type IoSocket = Socket<ClientToServer, ServerToClient>;

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  /** socket.id → ルームコード */
  private readonly socketRoom = new Map<string, string>();
  private readonly hooks: RoomHooks;

  constructor(
    private readonly io: IoServer,
    private readonly reg: CardRegistry,
    private readonly timings: RoomTimings = DEFAULT_TIMINGS,
    private readonly log: (message: string, data?: unknown) => void = (m, d) => console.log(m, d ?? ""),
    /** 同時に存在できるルームの数（使いすぎを防ぐ） */
    private readonly maxRooms = MAX_ROOMS,
  ) {
    this.hooks = {
      sendRoom: (sid, room) => this.io.to(sid).emit("room:update", room),
      sendState: (sid, u) => this.io.to(sid).emit("game:state", u),
      sendError: (sid, message) => this.io.to(sid).emit("game:error", message),
      onDispose: (room) => {
        this.rooms.delete(room.code);
        this.log("ルームを削除", { room: room.code });
      },
      log: this.log,
    };
    io.on("connection", (socket) => this.attach(socket));
  }

  private newCode(): string {
    for (;;) {
      let c = "";
      for (let i = 0; i < 6; i++) c += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!this.rooms.has(c)) return c;
    }
  }

  private roomOf(socket: IoSocket): Room | undefined {
    const code = this.socketRoom.get(socket.id);
    return code ? this.rooms.get(code) : undefined;
  }

  /** 別のルームにいたら抜ける（1つの接続は1つのルームにだけいる） */
  private detach(socket: IoSocket): void {
    const room = this.roomOf(socket);
    if (room) room.leave(socket.id);
    this.socketRoom.delete(socket.id);
  }

  private attach(socket: IoSocket): void {
    const guard =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        try {
          fn(...args);
        } catch (e) {
          const reply = args[args.length - 1];
          const message = e instanceof RoomError ? e.message : "サーバーでエラーが起きました";
          if (!(e instanceof RoomError)) this.log("想定外の例外", { error: String(e), stack: (e as Error).stack });
          if (typeof reply === "function") (reply as (r: Reply) => void)({ ok: false, error: message });
          else socket.emit("game:error", message);
        }
      };
    const joined = (room: Room, playerId: string, token: string): JoinReply => {
      this.socketRoom.set(socket.id, room.code);
      return { ok: true, code: room.code, playerId, token };
    };

    socket.on(
      "room:create",
      guard((msg: unknown, reply: (r: JoinReply) => void) => {
        const p = createSchema.safeParse(msg);
        if (!p.success) return reply({ ok: false, error: zodMessage(p.error) });
        if (!this.reg.stages.some((s) => s.id === p.data.stageId)) return reply({ ok: false, error: "そのステージはありません" });
        if (this.rooms.size >= this.maxRooms) return reply({ ok: false, error: "ただいま混み合っています。しばらくしてからお試しください" });
        if (p.data.danger > this.reg.maxDanger) return reply({ ok: false, error: `危険度は ${this.reg.maxDanger} までです` });
        this.detach(socket);
        const room = new Room(this.newCode(), this.reg, this.hooks, this.timings, p.data.stageId, p.data.danger);
        this.rooms.set(room.code, room);
        this.log("ルームを作成", { room: room.code });
        const m = room.join(p.data.name, socket.id);
        reply(joined(room, m.playerId, m.token));
      }),
    );

    socket.on(
      "room:join",
      guard((msg: unknown, reply: (r: JoinReply) => void) => {
        const p = joinSchema.safeParse(msg);
        if (!p.success) return reply({ ok: false, error: zodMessage(p.error) });
        const room = this.rooms.get(p.data.code);
        if (!room) return reply({ ok: false, error: "そのルームは見つかりません" });
        this.detach(socket);
        const m = room.join(p.data.name, socket.id);
        reply(joined(room, m.playerId, m.token));
      }),
    );

    socket.on(
      "room:resume",
      guard((msg: unknown, reply: (r: JoinReply) => void) => {
        const p = resumeSchema.safeParse(msg);
        if (!p.success) return reply({ ok: false, error: zodMessage(p.error) });
        const room = this.rooms.get(p.data.code);
        if (!room) return reply({ ok: false, error: "そのルームはもうありません" });
        if (this.socketRoom.get(socket.id) !== room.code) this.detach(socket);
        // reply を先に返してから状態を送る（ブラウザが自分の playerId を知ってから状態を受け取れるように）
        const m = room.members.find((x) => x.token === p.data.token);
        if (!m) return reply({ ok: false, error: "このルームの席が見つかりません" });
        reply(joined(room, m.playerId, m.token));
        room.resume(p.data.token, socket.id);
      }),
    );

    socket.on(
      "room:setStage",
      guard((msg: unknown, reply: (r: Reply) => void) => {
        const p = setStageSchema.safeParse(msg);
        if (!p.success) return reply({ ok: false, error: zodMessage(p.error) });
        const { room, playerId } = this.current(socket);
        room.setStage(playerId, p.data.stageId, p.data.danger);
        reply({ ok: true });
      }),
    );

    socket.on(
      "room:start",
      guard((reply: (r: Reply) => void) => {
        const { room, playerId } = this.current(socket);
        room.start(playerId);
        reply({ ok: true });
      }),
    );

    socket.on(
      "room:backToLobby",
      guard((reply: (r: Reply) => void) => {
        const { room, playerId } = this.current(socket);
        room.backToLobby(playerId);
        reply({ ok: true });
      }),
    );

    socket.on(
      "room:leave",
      guard(() => this.detach(socket)),
    );

    socket.on(
      "game:action",
      guard((msg: unknown) => {
        const p = actionMessageSchema.safeParse(msg);
        if (!p.success) {
          socket.emit("game:error", "操作の形式が正しくありません");
          return;
        }
        const { room, playerId } = this.current(socket);
        room.handleAction(playerId, p.data.action);
      }),
    );

    socket.on("disconnect", () => {
      const room = this.roomOf(socket);
      this.socketRoom.delete(socket.id);
      room?.disconnect(socket.id);
    });
  }

  private current(socket: IoSocket): { room: Room; playerId: string } {
    const room = this.roomOf(socket);
    const m = room?.memberBySocket(socket.id);
    if (!room || !m) throw new RoomError("ルームに入っていません");
    return { room, playerId: m.playerId };
  }
}
