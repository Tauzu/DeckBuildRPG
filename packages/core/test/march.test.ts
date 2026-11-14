import { describe, expect, it } from "vitest";
import { applyAction, isEngineError, timeoutAction } from "../src/index.js";
import { act, cards, confirmAndFinish, errorOf, mutate, placeEnemy, reg, setHand, start } from "./helpers.js";

/** 集落を訪れて何もせずに手番を終える */
function pass(s: ReturnType<typeof start>, playerId = "p1") {
  const a = act(s, playerId, { type: "chooseVillage" }).state;
  return act(a, playerId, { type: "endVisit" });
}

describe("敵の進軍（仕様書 5.4）", () => {
  it("手番が終わるたびに敵が1歩進み、山札から1枚公開されて1マス目に置かれる", () => {
    const s0 = start();
    const top = s0.enemyDeck[0]!;
    const s1 = pass(s0).state;
    expect(s1.route[0]!.map((c) => c.uid)).toEqual([top.uid]);
    expect(s1.enemyDeck).toHaveLength(s0.enemyDeck.length - 1);
    const s2 = pass(s1).state;
    expect(s2.route[1]!.map((c) => c.uid)).toEqual([top.uid]);
    expect(s2.turnCount).toBe(3);
  });

  it("5マス目から進んだ敵は集落に着き、侵攻力の分だけ耐久値を減らして取り除かれる", () => {
    const { state, uid } = placeEnemy(start(), 4, "enemy_orc");
    const r = pass(state);
    expect(r.state.villageHp).toBe(12);
    expect(r.state.route.flat().some((c) => c.uid === uid)).toBe(false);
    expect(r.events.find((e) => e.type === "enemyArrived")).toMatchObject({ uid, damage: 3, villageHp: 12 });
  });

  it("耐久値が0以下になったら敗北", () => {
    let { state } = placeEnemy(start(), 4, "enemy_wolf");
    state = mutate(state, (d) => {
      d.villageHp = 2;
    });
    const r = pass(state).state;
    expect(r.result).toMatchObject({ outcome: "lose", reason: "villageDestroyed", rank: "C", villageHp: 0 });
  });

  it("ボスが集落に着いたら敗北", () => {
    const { state } = placeEnemy(start(), 4, "enemy_dragon");
    expect(pass(state).state.result).toMatchObject({ outcome: "lose", reason: "bossArrived" });
  });

  it("ゴブリン呪術師の公開時：全員が手札を1枚捨てる（選ぶまで待つ）", () => {
    let s = placeEnemy(start(2), 3, "enemy_orc").state;
    s = mutate(s, (d) => {
      d.enemyDeck.unshift(...cards("enemy_shaman"));
    });
    s = pass(s, "p1").state;
    s = pass(s, "p2").state;
    expect(s.pending?.kind).toBe("discard");
    expect(s.step.kind).toBe("nextTurn");
    expect(errorOf(s, "p2", { type: "chooseVillage" })).toBe("PENDING_INPUT");

    const p2Card = s.players[1]!.hand[0]!.uid;
    expect(errorOf(s, "p2", { type: "discardForEffect", uids: [] })).toBe("INVALID_SELECTION");
    s = act(s, "p2", { type: "discardForEffect", uids: [p2Card] }).state;
    expect(s.pending).not.toBeNull();
    expect(s.players[1]!.discard.map((c) => c.uid)).toContain(p2Card);

    const timeout = timeoutAction(s, "p1");
    expect(timeout?.type).toBe("discardForEffect");
    s = act(s, "p1", timeout!).state;
    expect(s.pending).toBeNull();
    expect(s.step.kind).toBe("chooseAction");
    expect(s.players[0]!.hand).toHaveLength(s.config.handSize - 1);
    expect(s.players[1]!.hand).toHaveLength(s.config.handSize - 1);
  });

  it("死霊術師の公開時：全員の捨て札に呪いを1枚加える", () => {
    let s = start(3);
    s = mutate(s, (d) => {
      d.enemyDeck.unshift(...cards("enemy_necro"));
    });
    s = pass(s, "p1").state;
    s = pass(s, "p2").state;
    s = pass(s, "p3").state;
    for (const p of s.players) expect(p.discard.some((c) => c.defId === "curse")).toBe(true);
    expect(s.village.curses).toHaveLength(17);
  });

  it("魔竜の進軍時：次の手番のプレイヤーだけが手札を1枚捨てる。公開された回は発動しない", () => {
    let s = placeEnemy(start(2), 3, "enemy_orc").state;
    s = mutate(s, (d) => {
      d.enemyDeck.unshift(...cards("enemy_dragon"));
    });
    // 1ラウンド目の終わりに公開（全員）
    s = pass(s, "p1").state;
    s = pass(s, "p2").state;
    expect(s.pending).toMatchObject({ kind: "discard" });
    if (s.pending?.kind !== "discard") throw new Error();
    expect(s.pending.requests.map((r) => r.playerId)).toEqual(["p1", "p2"]);
    s = act(s, "p1", timeoutAction(s, "p1")!).state;
    s = act(s, "p2", timeoutAction(s, "p2")!).state;

    // 2ラウンド目（順番はランダム）の終わり → 進軍時：次のラウンドの最初の手番のプレイヤーだけ
    const first = s.players[s.currentPlayer]!.id;
    const second = s.players[s.turnQueue[0]!]!.id;
    s = pass(s, first).state;
    expect(s.pending).toBeNull();
    s = pass(s, second).state;
    if (s.pending?.kind !== "discard") throw new Error("入力待ちになっていません");
    expect(s.pending.requests.map((r) => r.playerId)).toEqual([s.players[s.currentPlayer]!.id]);
  });

  it("2人以上では、敵は全員の手番が終わるごと（1ラウンドに1回）に進む", () => {
    const { state, uid } = placeEnemy(start(2), 1, "enemy_orc");
    const deck = state.enemyDeck.length;
    let r = pass(state, "p1");
    expect(r.events.some((e) => e.type === "enemyMoved" || e.type === "enemyRevealed")).toBe(false);
    expect(r.state.route[1]!.map((c) => c.uid)).toEqual([uid]);
    r = pass(r.state, "p2");
    expect(r.state.route[2]!.map((c) => c.uid)).toEqual([uid]);
    expect(r.state.enemyDeck).toHaveLength(deck - 1);
    // 次のラウンドも全員が1回ずつ手番を持つ（順番はランダム）
    expect([r.state.currentPlayer, ...r.state.turnQueue].sort()).toEqual([0, 1]);
  });

  it("手番の冒頭に進軍ルートが空なら、1体補充する", () => {
    const s0 = start(2);
    expect(s0.route.flat()).toHaveLength(0);
    const s = pass(s0, "p1").state; // ラウンドの途中なので進軍はしない
    expect(s.currentPlayer).toBe(1);
    expect(s.route.flat()).toHaveLength(1);
  });

  it("ラウンドの全員が敵を撃破したときだけ進軍しない（1人なら撃破した手番は進軍しない）", () => {
    /** p の手番で、2マス目のゴブリンを騎士で撃破する */
    const defeat = (s: ReturnType<typeof start>, playerId: string) => {
      const idx = s.players.findIndex((p) => p.id === playerId);
      const placed = placeEnemy(setHand(s, idx, ["hero_knight_1"]), 1, "enemy_goblin");
      let t = act(placed.state, playerId, { type: "chooseBattle", targetUid: placed.uid }).state;
      t = act(t, playerId, { type: "playHero", uid: t.players[idx]!.hand[0]!.uid }).state;
      return confirmAndFinish(t, playerId);
    };
    const base = placeEnemy(start(2), 3, "enemy_orc").state;
    // p1 だけ撃破 → 進軍する
    let r = defeat(base, "p1");
    r = pass(r.state, "p2");
    expect(r.events.some((e) => e.type === "enemyMoved")).toBe(true);
    // 2人とも撃破 → 進軍しない
    r = defeat(base, "p1");
    r = defeat(r.state, "p2");
    expect(r.events.some((e) => e.type === "marchSkipped")).toBe(true);
    expect(r.events.some((e) => e.type === "enemyMoved" || e.type === "enemyRevealed")).toBe(false);
    expect(r.state.roundDefeats).toBe(0);
  });

  it("手番は手番順に回る", () => {
    let s = start(3);
    expect(errorOf(s, "p2", { type: "chooseVillage" })).toBe("NOT_YOUR_TURN");
    s = pass(s, "p1").state;
    s = pass(s, "p2").state;
    s = pass(s, "p3").state;
    expect(s.currentPlayer).toBe(0);
    expect(s.turnCount).toBe(4);
  });

  it("ルール違反の操作では状態は変わらない", () => {
    const s = start();
    const r = applyAction(s, "p1", { type: "buy", stackId: "food_bread" }, reg);
    expect(isEngineError(r)).toBe(true);
    expect(s.step.kind).toBe("chooseAction");
  });
});
