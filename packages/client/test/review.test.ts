// ゲーム後の振り返りの集計
import { buildUpdate, createGame, defaultRegistry, viewFor } from "@deckbuild/core";
import type { GameEvent, GameUpdate } from "@deckbuild/core";
import { describe, expect, it } from "vitest";
import { addToReview, emptyReview, groupDeck, highlights } from "../src/review.js";

const reg = defaultRegistry();

function update(events: GameEvent[]): GameUpdate {
  const { state } = createGame({ seed: 1, players: [{ id: "a", name: "あ" }], stageId: "stage1", danger: 0 }, reg);
  return buildUpdate(state, events, "a", reg);
}

describe("振り返りの集計", () => {
  it("手番・買い物・撃破・集落の被害を集める", () => {
    const enemy = reg.all().find((c) => c.type === "enemy")!.id;
    const food = reg.all().find((c) => c.type === "food")!.id;
    let r = addToReview(emptyReview(), update([]));
    expect(r.points).toHaveLength(1);
    r = addToReview(r, update([{ type: "turnStarted", playerId: "a", turnCount: 2 }, { type: "cardBought", playerId: "a", uid: "u1", defId: food, cost: 3 }]));
    r = addToReview(
      r,
      update([
        { type: "attackResolved", playerId: "a", targetUid: "e1", targetDefId: enemy, damage: 7, prevDamage: 0, hp: 5, defeated: true },
        { type: "enemyArrived", uid: "e2", defId: enemy, damage: 2, villageHp: 18 },
        { type: "curseAdded", playerId: "a", uid: "c1" },
      ]),
    );
    expect(r.points.map((p) => p.turn)).toEqual([0, 2]);
    expect(r.buys).toEqual([{ turn: 2, playerId: "a", defId: food, cost: 3 }]);
    expect(r.kills).toEqual([{ turn: 2, playerId: "a", defId: enemy }]);
    expect(r.hits).toEqual([{ turn: 2, defId: enemy, damage: 2, villageHp: 18 }]);
    expect(r.curses).toHaveLength(1);
    expect(r.bestHit?.damage).toBe(7);
    expect(highlights(r, reg, () => "あ", false).length).toBeGreaterThan(2);
  });

  it("元の値を書き換えない", () => {
    const r0 = emptyReview();
    addToReview(r0, update([{ type: "turnStarted", playerId: "a", turnCount: 1 }]));
    expect(r0.points).toEqual([]);
  });

  it("デッキを種類ごと・同じカードごとにまとめる", () => {
    const { state } = createGame({ seed: 1, players: [{ id: "a", name: "あ" }], stageId: "stage1", danger: 0 }, reg);
    const p = state.players[0]!;
    const g = groupDeck([...p.deck, ...p.hand].map((c) => c.defId), reg);
    expect(g.reduce((n, x) => n + x.total, 0)).toBe(p.deck.length + p.hand.length);
  });

  it("ゲームの途中は他人にも自分にもデッキの中身を見せず、終わると見せる", () => {
    const { state } = createGame({ seed: 1, players: [{ id: "a", name: "あ" }], stageId: "stage1", danger: 0 }, reg);
    expect(viewFor(state, "a").players[0]!.allCards).toBeUndefined();
    const done = { ...state, result: { outcome: "win", reason: "bossDefeated", rank: "S", villageHp: 1, mvp: [], titles: {} } } as typeof state;
    const p = state.players[0]!;
    expect(viewFor(done, "a").players[0]!.allCards).toHaveLength(p.deck.length + p.hand.length + p.field.length + p.discard.length);
  });
});
