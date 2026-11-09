import { defaultRegistry, type GameUpdate } from "@deckbuild/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomInfo } from "../src/protocol.js";
import { Room, type RoomHooks, type RoomTimings } from "../src/Room.js";

const reg = defaultRegistry();
const T: RoomTimings = { pendingMs: 1000, disconnectedTurnMs: 2000, seatMs: 10_000, emptyRoomMs: 60_000 };

function setup() {
  const sent = { rooms: new Map<string, RoomInfo>(), states: new Map<string, GameUpdate>(), errors: [] as string[], disposed: false };
  const hooks: RoomHooks = {
    sendRoom: (sid, r) => sent.rooms.set(sid, r),
    sendState: (sid, u) => sent.states.set(sid, u),
    sendError: (_sid, m) => sent.errors.push(m),
    onDispose: () => {
      sent.disposed = true;
    },
    log: () => {},
  };
  const room = new Room("ABCDEF", reg, hooks, T, "stage4");
  return { room, sent };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("ルーム（仕様書 9.2）", () => {
  it("最初に入った人がホスト。4人まで。開始後は入れない", () => {
    const { room, sent } = setup();
    const a = room.join("あ", "s1");
    room.join("い", "s2");
    expect(room.hostId).toBe(a.playerId);
    expect(sent.rooms.get("s2")?.members.map((m) => m.name)).toEqual(["あ", "い"]);
    room.join("う", "s3");
    room.join("え", "s4");
    expect(() => room.join("お", "s5")).toThrow("4人まで");
    const { room: r2 } = setup();
    r2.join("あ", "s1");
    r2.start("p1");
    expect(() => r2.join("い", "s2")).toThrow("始まっています");
  });

  it("ホストだけが開始・ステージ変更できる。人数に合わないステージは始められない", () => {
    const { room } = setup();
    room.join("あ", "s1");
    room.join("い", "s2");
    expect(() => room.start("p2")).toThrow("ルームを作った人");
    room.setStage("p1", "tutorial");
    expect(() => room.start("p1")).toThrow("1人で遊ぶステージ");
    room.setStage("p1", "stage1");
    room.start("p1", 5);
    expect(room.state?.players.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(room.state?.config.stageId).toBe("stage1");
  });

  it("各プレイヤーには自分向けの状態が届き、他人の手札は見えない", () => {
    const { room, sent } = setup();
    room.join("あ", "s1");
    room.join("い", "s2");
    room.start("p1", 5);
    const u1 = sent.states.get("s1")!;
    const u2 = sent.states.get("s2")!;
    expect(u1.view.viewerId).toBe("p1");
    expect(u1.legal.waitingForMe).toBe(true);
    expect(u2.legal.waitingForMe).toBe(false);
    expect(u2.view.players.find((p) => p.id === "p1")?.hand).toBeUndefined();
    expect(u2.view.players.find((p) => p.id === "p1")?.handCount).toBe(5);
  });

  it("手番でない人の操作はエラーになり、本人にだけ伝わる", () => {
    const { room, sent } = setup();
    room.join("あ", "s1");
    room.join("い", "s2");
    room.start("p1", 5);
    room.handleAction("p2", { type: "chooseVillage" });
    expect(sent.errors).toHaveLength(1);
    room.handleAction("p1", { type: "chooseVillage" });
    room.handleAction("p1", { type: "endVisit" });
    expect(room.state?.players[room.state.currentPlayer]?.id).toBe("p2");
    expect(room.record?.actions).toHaveLength(2);
  });

  it("接続が切れた人の手番は、制限時間が来たら「集落を訪れる」→「訪問を終える」で進む", () => {
    const { room } = setup();
    room.join("あ", "s1");
    room.join("い", "s2");
    room.start("p1", 5);
    room.handleAction("p1", { type: "chooseVillage" });
    room.handleAction("p1", { type: "endVisit" });
    room.disconnect("s2");
    vi.advanceTimersByTime(T.disconnectedTurnMs - 1);
    expect(room.state?.players[room.state.currentPlayer]?.id).toBe("p2");
    vi.advanceTimersByTime(1);
    expect(room.state?.players[room.state.currentPlayer]?.id).toBe("p1");
    expect(room.record?.actions.slice(-2).map((a) => a.action.type)).toEqual(["chooseVillage", "endVisit"]);
  });

  it("再接続すれば同じ席に戻り、最新の状態が届く。タイマーは止まる", () => {
    const { room, sent } = setup();
    const a = room.join("あ", "s1");
    const b = room.join("い", "s2");
    room.start("p1", 5);
    room.handleAction("p1", { type: "chooseVillage" });
    room.handleAction("p1", { type: "endVisit" });
    room.disconnect("s2");
    expect(sent.rooms.get("s1")?.members[1]?.connected).toBe(false);
    const back = room.resume(b.token, "s9");
    expect(back.playerId).toBe("p2");
    expect(sent.states.get("s9")?.legal.waitingForMe).toBe(true);
    vi.advanceTimersByTime(T.disconnectedTurnMs * 2);
    expect(room.state?.players[room.state.currentPlayer]?.id).toBe("p2");
    expect(() => room.resume("違うトークン", "s8")).toThrow();
    expect(a.playerId).toBe("p1");
  });

  it("席の保持時間が過ぎた人の手番は、すぐに自動で進む", () => {
    const { room } = setup();
    room.join("あ", "s1");
    room.join("い", "s2");
    room.start("p1", 5);
    room.disconnect("s2");
    vi.advanceTimersByTime(T.seatMs);
    expect(room.member("p2")?.auto).toBe(true);
    room.handleAction("p1", { type: "chooseVillage" });
    room.handleAction("p1", { type: "endVisit" });
    // p2 の手番は自動で終わり、すぐに p1 に戻る
    expect(room.state?.players[room.state.currentPlayer]?.id).toBe("p1");
  });

  it("待機中に全員いなくなったらルームを消す。ゲーム中は一定時間後に消す", () => {
    const a = setup();
    a.room.join("あ", "s1");
    a.room.disconnect("s1");
    expect(a.sent.disposed).toBe(true);
    const b = setup();
    b.room.join("あ", "s1");
    b.room.start("p1", 5);
    b.room.disconnect("s1");
    expect(b.sent.disposed).toBe(false);
    vi.advanceTimersByTime(T.emptyRoomMs);
    expect(b.sent.disposed).toBe(true);
  });

  it("全員が自動になっても、ゲームは終わりまで進む（止まらない）", () => {
    const { room } = setup();
    room.join("あ", "s1");
    room.join("い", "s2");
    room.start("p1", 5);
    room.leave("s1");
    room.leave("s2");
    expect(room.state?.result).not.toBeNull();
  });

  it("結果が出たら、ホストは同じ顔ぶれで待機に戻せる", () => {
    const { room } = setup();
    room.join("あ", "s1");
    room.join("い", "s2");
    room.start("p1", 5);
    expect(() => room.backToLobby("p1")).toThrow("終わってから");
    room.state = { ...room.state!, result: { outcome: "lose", reason: "bossArrived", rank: "C", villageHp: 0, mvp: [], titles: {} } };
    room.backToLobby("p1");
    expect(room.started).toBe(false);
    expect(room.members).toHaveLength(2);
  });
});
