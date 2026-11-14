import { describe, expect, it } from "vitest";
import { createGame, guardedUids, legalActions, timeoutAction } from "../src/index.js";
import { act, cards, confirmAndFinish, errorOf, hand, mutate, placeEnemy, players, reg, setHand, start, uidOf } from "./helpers.js";

/** 集落を訪れて何もせずに手番を終える */
function pass(s: ReturnType<typeof start>, playerId = "p1") {
  const a = act(s, playerId, { type: "chooseVillage" }).state;
  return act(a, playerId, { type: "endVisit" });
}

/** 氷術師を出して、対象の選択待ちにする */
function playFrost(s: ReturnType<typeof start>, heroDef: string) {
  const h = setHand(s, 0, [heroDef]);
  const v = act(h, "p1", { type: "chooseVillage" }).state;
  return act(v, "p1", { type: "playHero", uid: hand(v)[0]!.uid }).state;
}

function square(s: ReturnType<typeof start>, uid: string): number {
  return s.route.findIndex((sq) => sq.some((c) => c.uid === uid));
}

describe("凍結（仕様書 5.4・5.5）", () => {
  it("氷術師Lv2の村効果で敵を選んで凍結する。凍結した敵は次の進軍で動かず、進軍のあと解ける", () => {
    const a = placeEnemy(start(), 1, "enemy_goblin");
    const b = placeEnemy(a.state, 2, "enemy_orc");
    let s = playFrost(b.state, "hero_frost_2");
    expect(s.pending).toMatchObject({ kind: "target", mode: "freeze" });
    expect(legalActions(s, "p1", reg).selection).toMatchObject({ kind: "target", mode: "freeze" });
    s = act(s, "p1", { type: "chooseTarget", targetUid: b.uid }).state;
    expect(s.pending).toBeNull();
    expect(s.frozen).toEqual([b.uid]);

    s = act(s, "p1", { type: "endVisit" }).state;
    expect(square(s, b.uid)).toBe(2); // 動かない
    expect(square(s, a.uid)).toBe(2); // 凍結していない敵は進む
    expect(s.frozen).toEqual([]);
  });

  it("凍結中の敵は5マス目にいても集落に着かない", () => {
    const { state, uid } = placeEnemy(start(), 4, "enemy_orc");
    const frozen = mutate(state, (d) => {
      d.frozen.push(uid);
    });
    const r = pass(frozen).state;
    expect(r.villageHp).toBe(frozen.villageHp); // 集落に着かない
    expect(square(r, uid)).toBe(4);
  });

  it("ボスは凍結の対象にならない。対象がいなければ何も起きない", () => {
    const { state } = placeEnemy(start(), 2, "enemy_dragon");
    const s = playFrost(state, "hero_frost_2");
    expect(s.pending).toBeNull();
  });

  it("すでに凍結中の敵は選べない。選べない敵を指定するとエラー", () => {
    const a = placeEnemy(start(), 1, "enemy_goblin");
    const b = placeEnemy(a.state, 2, "enemy_wolf");
    const withFrozen = mutate(b.state, (d) => {
      d.frozen.push(a.uid);
    });
    const s = playFrost(withFrozen, "hero_frost_2");
    expect(errorOf(s, "p1", { type: "chooseTarget", targetUid: a.uid })).toBe("INVALID_SELECTION");
    expect(errorOf(s, "p1", { type: "chooseTarget", targetUid: "zzz" })).toBe("INVALID_SELECTION");
    expect(errorOf(s, "p1", { type: "endVisit" })).toBe("PENDING_INPUT");
  });

  it("時間切れのときは、選べる敵からランダムに選ぶ", () => {
    const { state, uid } = placeEnemy(start(), 2, "enemy_goblin");
    const s = playFrost(state, "hero_frost_2");
    expect(timeoutAction(s, "p1")).toEqual({ type: "chooseTarget", targetUid: uid });
  });
});

describe("後退（仕様書 5.5）", () => {
  it("氷術師Lv1の村効果で、敵を1マス戻す。1マス目の敵は選べない", () => {
    const a = placeEnemy(start(), 0, "enemy_goblin");
    const b = placeEnemy(a.state, 3, "enemy_orc");
    const s = playFrost(b.state, "hero_frost_1");
    expect(s.pending).toMatchObject({ kind: "target", mode: "push", uids: [b.uid] });
    const r = act(s, "p1", { type: "chooseTarget", targetUid: b.uid });
    expect(square(r.state, b.uid)).toBe(2);
    expect(r.events.find((e) => e.type === "enemyPushed")).toMatchObject({ uid: b.uid, from: 3, to: 2 });
  });

  it("氷術師Lv3は後退と凍結を続けて選ぶ", () => {
    const a = placeEnemy(start(), 2, "enemy_orc");
    let s = playFrost(a.state, "hero_frost_3");
    expect(s.pending).toMatchObject({ mode: "push" });
    s = act(s, "p1", { type: "chooseTarget", targetUid: a.uid }).state;
    expect(s.pending).toMatchObject({ mode: "freeze" });
    s = act(s, "p1", { type: "chooseTarget", targetUid: a.uid }).state;
    expect(square(s, a.uid)).toBe(1);
    expect(s.frozen).toEqual([a.uid]);
  });
});

describe("護衛（仕様書 5.3.3）", () => {
  it("護衛は1つ後ろのマスの敵と、同じマスの護衛を持たない敵を守る", () => {
    const g = placeEnemy(start(), 3, "enemy_frost_guard");
    const same = placeEnemy(g.state, 3, "enemy_goblin");
    const behind = placeEnemy(same.state, 2, "enemy_wolf");
    const far = placeEnemy(behind.state, 1, "enemy_skeleton");
    const front = placeEnemy(far.state, 4, "enemy_orc");
    const guarded = guardedUids(front.state, reg);
    expect(guarded.has(same.uid)).toBe(true);
    expect(guarded.has(behind.uid)).toBe(true);
    expect(guarded.has(g.uid)).toBe(false);
    expect(guarded.has(far.uid)).toBe(false);
    expect(guarded.has(front.uid)).toBe(false);
    expect(errorOf(front.state, "p1", { type: "chooseBattle", targetUid: same.uid })).toBe("GUARDED");
    expect(errorOf(front.state, "p1", { type: "chooseBattle", targetUid: g.uid })).toBeNull();
    expect(legalActions(front.state, "p1", reg).options.find((o) => o.action.type === "chooseBattle" && o.action.targetUid === behind.uid)?.reason).toBe(
      "GUARDED",
    );
  });

  it("同じマスの護衛同士は守り合わず、1つ後ろの護衛は前の護衛に守られる", () => {
    const a = placeEnemy(start(), 2, "enemy_frost_guard");
    const b = placeEnemy(a.state, 2, "enemy_frost_guard");
    const c = placeEnemy(b.state, 1, "enemy_frost_guard");
    const guarded = guardedUids(c.state, reg);
    expect(guarded.has(a.uid)).toBe(false);
    expect(guarded.has(b.uid)).toBe(false);
    expect(guarded.has(c.uid)).toBe(true);
  });

  it("護衛を倒すと、守られていた敵を選べるようになる", () => {
    const g = placeEnemy(start(), 3, "enemy_frost_guard");
    const e = placeEnemy(g.state, 3, "enemy_goblin");
    const h = setHand(e.state, 0, ["hero_knight_3", "food_bread", "weapon_axe"]);
    let s = act(h, "p1", { type: "chooseBattle", targetUid: g.uid }).state;
    s = act(s, "p1", { type: "playFood", uid: uidOf(hand(s), "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(hand(s), "hero_knight_3") }).state;
    s = act(s, "p1", { type: "equip", weaponUid: uidOf(hand(s), "weapon_axe"), heroUid: s.players[0]!.field.find((c) => c.defId === "hero_knight_3")!.uid }).state;
    s = confirmAndFinish(s).state;
    expect(s.route.flat().some((c) => c.uid === g.uid)).toBe(false);
    expect(guardedUids(s, reg).has(e.uid)).toBe(false);
  });
});

describe("分裂（仕様書 5.3.3）と霜の杖（chill）", () => {
  function attack(s: ReturnType<typeof start>, targetUid: string, handIds: string[]) {
    let t = act(setHand(s, 0, handIds), "p1", { type: "chooseBattle", targetUid }).state;
    for (const defId of handIds) {
      const d = reg.get(defId);
      if (d.type === "food") t = act(t, "p1", { type: "playFood", uid: uidOf(hand(t), defId) }).state;
    }
    for (const defId of handIds) {
      if (reg.get(defId).type === "hero") t = act(t, "p1", { type: "playHero", uid: uidOf(hand(t), defId) }).state;
    }
    for (const defId of handIds) {
      if (reg.get(defId).type !== "weapon") continue;
      const hero = t.players[0]!.field.find((c) => reg.get(c.defId).type === "hero");
      t = act(t, "p1", { type: "equip", weaponUid: uidOf(hand(t), defId), heroUid: hero!.uid }).state;
    }
    return confirmAndFinish(t).state;
  }

  it("スライムへの攻撃が撃破に失敗すると、1マス目に小スライムが出る（1体につき1回だけ）", () => {
    const slime = placeEnemy(start(), 3, "enemy_slime");
    let s = attack(slime.state, slime.uid, ["hero_youth_0"]);
    const lings = () => s.route.flat().filter((c) => c.defId === "enemy_slimeling");
    // 手番が終わった進軍で小スライムは1マス進み、新たに1体公開される
    expect(lings()).toHaveLength(1);
    expect(s.split).toEqual([slime.uid]);
    const alive = s.route.flat().find((c) => c.uid === slime.uid)!;
    s = attack(s, alive.uid, ["hero_youth_0"]);
    expect(lings()).toHaveLength(1);
  });

  it("小スライムは分裂しない。撃破すると経験値0", () => {
    const ling = placeEnemy(start(), 2, "enemy_slimeling");
    const s = attack(ling.state, ling.uid, ["hero_knight_1", "food_bread"]);
    expect(s.route.flat().some((c) => c.uid === ling.uid)).toBe(false);
    expect(s.route.flat().filter((c) => c.defId === "enemy_slimeling")).toHaveLength(0);
  });

  it("霜の杖：撃破に失敗した敵を凍結する。撃破したときは凍結しない", () => {
    const wolf = placeEnemy(start(), 1, "enemy_orc");
    const s = attack(wolf.state, wolf.uid, ["hero_mage_1", "weapon_frost"]);
    expect(square(s, wolf.uid)).toBe(1); // 進軍しても凍結で動かない
    const kill = placeEnemy(start(), 1, "enemy_goblin");
    const k = attack(kill.state, kill.uid, ["hero_mage_1", "weapon_frost"]);
    expect(k.frozen).toEqual([]);
  });

  it("霜の杖はボスを凍結できない", () => {
    const boss = placeEnemy(start(), 1, "enemy_dragon");
    const s = attack(boss.state, boss.uid, ["hero_mage_1", "weapon_frost"]);
    expect(s.frozen).toEqual([]);
  });
});

describe("疾走と号令", () => {
  it("雪狼は進軍で2マス進み、集落を超えると到達する", () => {
    const w = placeEnemy(start(), 1, "enemy_snow_wolf");
    const r = pass(w.state).state;
    expect(square(r, w.uid)).toBe(3);
    const near = placeEnemy(start(), 3, "enemy_snow_wolf");
    const r2 = pass(near.state);
    expect(r2.state.villageHp).toBe(near.state.villageHp - 2);
    expect(r2.state.route.flat().some((c) => c.uid === near.uid)).toBe(false);
  });

  it("雪の女王の公開時（号令）：他の敵が1マス進み、5マス目の敵は動かず、凍結が解ける", () => {
    const a = placeEnemy(start(), 0, "enemy_goblin");
    const b = placeEnemy(a.state, 3, "enemy_orc");
    const c = placeEnemy(b.state, 4, "enemy_wolf");
    const withQueen = mutate(c.state, (d) => {
      d.enemyDeck.unshift(...cards("enemy_snow_queen"));
      d.frozen.push(b.uid);
    });
    const r = pass(withQueen).state;
    // 進軍で a:0→1, b は凍結で3のまま, c:4→到達。その後の公開で女王が1マス目に出て、号令で他の敵が1つ進む
    const queen = r.route.flat().find((x) => x.defId === "enemy_snow_queen")!;
    expect(square(r, queen.uid)).toBe(0);
    expect(square(r, a.uid)).toBe(2);
    expect(square(r, b.uid)).toBe(4);
    expect(r.frozen).toEqual([]);
  });
});

describe("ステージ5「凍てつく峠」", () => {
  it("追加ステージなので、既定のステージはステージ4のまま", () => {
    expect(reg.defaultStageId).toBe("stage4");
    expect(reg.stages.at(-1)!.id).toBe("stage5");
  });

  it("1〜4人で始められ、英雄在庫は6束（盗賊の代わりに氷術師）", () => {
    for (const n of [1, 2, 3, 4]) {
      const s = createGame({ seed: 3, players: players(n), stageId: "stage5" }, reg).state;
      const heroStacks = Object.keys(s.village.stacks).filter((k) => k.startsWith("hero:"));
      expect(heroStacks).toHaveLength(6);
      expect(heroStacks).toContain("hero:frost");
      expect(heroStacks).not.toContain("hero:thief");
      expect(s.village.stacks["weapon_frost"]).toHaveLength(4);
      expect(s.enemyDeck.some((c) => c.defId === "enemy_snow_queen")).toBe(true);
    }
  });
});
