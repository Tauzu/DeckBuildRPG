import { describe, expect, it } from "vitest";
import { applyAction, isEngineError, timeoutAction } from "../src/index.js";
import { act, cards, errorOf, mutate, placeEnemy, reg, start } from "./helpers.js";

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
    let s = start(2);
    s = mutate(s, (d) => {
      d.enemyDeck.unshift(...cards("enemy_shaman"));
    });
    s = pass(s).state;
    expect(s.pending?.kind).toBe("discard");
    expect(s.step.kind).toBe("nextTurn");
    expect(errorOf(s, "p2", { type: "chooseVillage" })).toBe("PENDING_INPUT");

    const p2Card = s.players[1]!.hand[0]!.uid;
    expect(errorOf(s, "p2", { type: "discardForEffect", uids: [] })).toBe("INVALID_SELECTION");
    s = act(s, "p2", { type: "discardForEffect", uids: [p2Card] }).state;
    expect(s.pending).not.toBeNull();
    expect(s.players[1]!.discard.map((c) => c.uid)).toEqual([p2Card]);

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
    s = pass(s).state;
    for (const p of s.players) expect(p.discard.some((c) => c.defId === "curse")).toBe(true);
    expect(s.village.curses).toHaveLength(17);
  });

  it("魔竜の進軍時：次の手番のプレイヤーだけが手札を1枚捨てる。公開された回は発動しない", () => {
    let s = start(2);
    s = mutate(s, (d) => {
      d.enemyDeck.unshift(...cards("enemy_dragon"));
    });
    // 公開時（全員）
    s = pass(s).state;
    expect(s.pending).toMatchObject({ kind: "discard" });
    if (s.pending?.kind !== "discard") throw new Error();
    expect(s.pending.requests.map((r) => r.playerId)).toEqual(["p1", "p2"]);
    s = act(s, "p1", timeoutAction(s, "p1")!).state;
    s = act(s, "p2", timeoutAction(s, "p2")!).state;
    expect(s.currentPlayer).toBe(1);

    // p2 の手番が終わる → 進軍時：次の手番の p1 だけ
    s = pass(s, "p2").state;
    if (s.pending?.kind !== "discard") throw new Error("入力待ちになっていません");
    expect(s.pending.requests.map((r) => r.playerId)).toEqual(["p1"]);
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
