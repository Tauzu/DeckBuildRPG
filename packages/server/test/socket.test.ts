// 実際に Socket.IO でつないで、作成→参加→開始→操作→再接続を確かめる（設計書 7章）
import type { GameUpdate } from "@deckbuild/core";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type RunningServer, startServer } from "../src/index.js";
import type { JoinReply, Reply, RoomInfo } from "../src/protocol.js";

let server: RunningServer;
const sockets: Socket[] = [];

beforeAll(async () => {
  server = await startServer({ port: 0, staticDir: null, log: () => {} });
});
afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await server.close();
});

function client() {
  const s = connect(`http://localhost:${server.port}`, { transports: ["websocket"], forceNew: true });
  sockets.push(s);
  const box = { room: null as RoomInfo | null, state: null as GameUpdate | null, errors: [] as string[] };
  s.on("room:update", (r: RoomInfo) => (box.room = r));
  s.on("game:state", (u: GameUpdate) => (box.state = u));
  s.on("game:error", (m: string) => box.errors.push(m));
  return { s, box };
}

function ask<T>(s: Socket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise((ok) => s.emit(event, ...args, (r: T) => ok(r)));
}

async function until(cond: () => boolean, ms = 2000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("時間切れ");
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("Socket.IO でのやりとり", () => {
  it("ルームを作って参加し、開始して操作できる。切断しても同じ席に戻れる", async () => {
    const a = client();
    const b = client();
    const created = await ask<JoinReply>(a.s, "room:create", { name: "アリス", stageId: "stage1" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.code).toMatch(/^[A-Z0-9]{6}$/);

    const bad = await ask<JoinReply>(b.s, "room:join", { code: "ZZZZZZ", name: "ボブ" });
    expect(bad).toEqual({ ok: false, error: "そのルームは見つかりません" });
    const joined = await ask<JoinReply>(b.s, "room:join", { code: created.code.toLowerCase(), name: " ボブ " });
    expect(joined.ok).toBe(true);
    await until(() => a.box.room?.members.length === 2);
    expect(a.box.room?.members.map((m) => m.name)).toEqual(["アリス", "ボブ"]);

    expect(await ask<Reply>(b.s, "room:start")).toEqual({ ok: false, error: "ルームを作った人だけができる操作です" });
    expect(await ask<Reply>(a.s, "room:start")).toEqual({ ok: true });
    await until(() => !!a.box.state && !!b.box.state);
    expect(a.box.state?.legal.waitingForMe).toBe(true);
    expect(a.box.state?.view.config.stageId).toBe("stage1");

    // 不正な形の操作は弾く
    a.s.emit("game:action", { action: { type: "buy" } });
    await until(() => a.box.errors.length === 1);

    a.s.emit("game:action", { action: { type: "chooseVillage" } });
    a.s.emit("game:action", { action: { type: "endVisit" } });
    await until(() => b.box.state?.legal.waitingForMe === true);

    // ボブが切断 → 新しい接続で戻る
    if (!joined.ok) return;
    b.s.disconnect();
    await until(() => a.box.room?.members[1]?.connected === false);
    const b2 = client();
    const resumed = await ask<JoinReply>(b2.s, "room:resume", { code: joined.code, token: joined.token });
    expect(resumed).toMatchObject({ ok: true, playerId: joined.playerId });
    await until(() => b2.box.state?.legal.waitingForMe === true);
    await until(() => a.box.room?.members[1]?.connected === true);
  });
});
