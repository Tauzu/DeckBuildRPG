// 性質のテスト・再現のテスト・見える情報のテスト（設計書 7章）
import { describe, expect, it } from "vitest";
import {
  type Action,
  createGame,
  type GameState,
  legalActions,
  newRecord,
  replay,
  viewEvents,
  viewFor,
} from "../src/index.js";
import { rngStep } from "../src/rng.js";
import { act, allCards, players, reg } from "./helpers.js";

/** テスト用の小さな乱数 */
function makeRandom(seed: number) {
  let state = seed;
  return (n: number) => {
    const r = rngStep(state);
    state = r.next;
    return Math.floor(r.value * n);
  };
}

/** ランダムに遊ぶボット。終了の操作も一定の確率で選ぶ */
function randomAction(s: GameState, playerId: string, rand: (n: number) => number): Action | null {
  const legal = legalActions(s, playerId, reg);
  if (!legal.waitingForMe) return null;
  const p = s.players.find((x) => x.id === playerId)!;
  if (legal.selection?.kind === "discard") {
    const pool = p.hand.map((c) => c.uid);
    const uids: string[] = [];
    for (let i = 0; i < legal.selection.count; i++) uids.push(...pool.splice(rand(pool.length), 1));
    return { type: "discardForEffect", uids };
  }
  if (legal.selection?.kind === "trash") {
    const pool = [...p.hand, ...p.discard].map((c) => c.uid);
    const n = rand(Math.min(legal.selection.max, pool.length) + 1);
    const uids: string[] = [];
    for (let i = 0; i < n; i++) uids.push(...pool.splice(rand(pool.length), 1));
    return { type: "resolveTrash", uids };
  }
  const ok = legal.options.filter((o) => o.reason === null).map((o) => o.action);
  const finishing = ok.filter((a) => a.type === "endVisit" || a.type === "confirmAttack");
  const others = ok.filter((a) => a.type !== "endVisit" && a.type !== "confirmAttack" && a.type !== "undoBattleCard");
  if (finishing.length > 0 && (others.length === 0 || rand(4) === 0)) return finishing[0]!;
  if (others.length > 0) return others[rand(others.length)]!;
  return ok[rand(ok.length)] ?? null;
}

function checkInvariants(s: GameState, total: number) {
  const all = allCards(s);
  expect(all).toHaveLength(total);
  expect(new Set(all.map((c) => c.uid)).size).toBe(all.length);
  for (const p of s.players) {
    expect(p.exp).toBeGreaterThanOrEqual(0);
    expect(p.exp).toBeLessThanOrEqual(p.totalExp);
  }
  if (s.turn) expect(s.turn.usedSlots).toBeLessThanOrEqual(s.turn.foodSlots);
}

function playRandomGame(seed: number, n: number) {
  const ps = players(n);
  let s = createGame({ seed, players: ps }, reg).state;
  const record = newRecord(seed, ps, reg);
  const total = allCards(s).length;
  const rand = makeRandom(seed * 7919);
  let steps = 0;
  while (!s.result) {
    let acted = false;
    for (const p of ps) {
      const action = randomAction(s, p.id, rand);
      if (!action) continue;
      s = act(s, p.id, action).state;
      record.actions.push({ playerId: p.id, action });
      checkInvariants(s, total);
      acted = true;
      break;
    }
    if (!acted) throw new Error("誰も操作できない状態になりました");
    if (++steps > 5000) throw new Error("ゲームが終わりません");
  }
  return { s, record };
}

describe("ランダムに遊んでも性質が保たれる", () => {
  for (const n of [1, 2, 4]) {
    it(`${n}人で数ゲーム、最後まで進み、カードの総数や uid の一意性が保たれる`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const { s } = playRandomGame(seed * 101 + n, n);
        expect(s.result).not.toBeNull();
        expect(s.step.kind).toBe("finished");
      }
    });
  }
});

describe("再現（replay）", () => {
  it("記録から作り直した状態は元の状態と完全に一致する", () => {
    const { s, record } = playRandomGame(2024, 2);
    expect(replay(record, reg)).toEqual(s);
  });

  it("カードデータが違う記録は再現できない", () => {
    const record = { ...newRecord(1, players(1), reg), dataHash: "deadbeef" };
    expect(() => replay(record, reg)).toThrow(/カードデータ/);
  });
});

describe("見える情報（viewFor）", () => {
  it("他のプレイヤーの手札・捨て札の中身や山札の順番は含まれない", () => {
    const s = createGame({ seed: 3, players: players(2) }, reg).state;
    const v = viewFor(s, "p1");
    const me = v.players.find((p) => p.id === "p1")!;
    const other = v.players.find((p) => p.id === "p2")!;
    expect(me.hand).toHaveLength(5);
    expect(other.hand).toBeUndefined();
    expect(other.discard).toBeUndefined();
    expect(other.handCount).toBe(5);
    const json = JSON.stringify(v);
    for (const c of s.players[1]!.hand) expect(json).not.toContain(`"${c.uid}"`);
    for (const c of s.players[0]!.deck) expect(json).not.toContain(`"${c.uid}"`);
    for (const c of s.enemyDeck) expect(json).not.toContain(`"${c.uid}"`);
    expect(json).not.toContain('"rng"');
  });

  it("他のプレイヤーが引いたカードの uid はイベントから消える", () => {
    const { events } = createGame({ seed: 3, players: players(2) }, reg);
    const forP1 = viewEvents(events, "p1");
    const p2Draw = forP1.find((e) => e.type === "cardsDrawn" && e.playerId === "p2");
    expect(p2Draw).toMatchObject({ count: 5, uids: [] });
    const p1Draw = forP1.find((e) => e.type === "cardsDrawn" && e.playerId === "p1");
    expect(p1Draw && p1Draw.type === "cardsDrawn" && p1Draw.uids).toHaveLength(5);
  });
});
