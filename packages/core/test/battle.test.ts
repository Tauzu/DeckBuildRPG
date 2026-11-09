import { describe, expect, it } from "vitest";
import { battlePreview, calcDamage } from "../src/index.js";
import { act, errorOf, hand, mutate, placeEnemy, reg, setHand, start, uidOf } from "./helpers.js";

describe("ダメージの計算（仕様書 5.3.1）", () => {
  it("仕様書の例：騎士Lv1＋鉄の剣と狩人Lv1でスケルトンを攻撃するとダメージ4", () => {
    const d = calcDamage(
      [
        { physical: 3 + 2, magic: 0 },
        { physical: 2, magic: 1 },
      ],
      reg.enemy("enemy_skeleton"),
    );
    expect(d).toEqual({ physical: 7, magic: 1, physicalAfter: 3, magicAfter: 1, total: 4 });
  });

  it("無効の耐性は0にする", () => {
    expect(calcDamage([{ physical: 9, magic: 2 }], reg.enemy("enemy_ghost")).total).toBe(2);
  });
});

function battle(handIds: string[], enemy: string, square = 2) {
  const placed = placeEnemy(setHand(start(), 0, handIds), square, enemy);
  const s = act(placed.state, "p1", { type: "chooseBattle", targetUid: placed.uid }).state;
  return { s, target: placed.uid, h: hand(s) };
}

describe("敵を倒す（仕様書 5.3）", () => {
  it("生命力以上のダメージで撃破し、敵カードと経験値を得る。手番が終わり手札を引き直す", () => {
    const { s: s0, target, h } = battle(["food_bread", "hero_knight_1"], "enemy_goblin");
    let s = act(s0, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_1") }).state;
    expect(battlePreview(s, reg)).toMatchObject({ total: 3, hp: 3 });
    const r = act(s, "p1", { type: "confirmAttack" });
    expect(r.state.step.kind).toBe("afterBattle");
    s = act(r.state, "p1", { type: "finishBattle" }).state;
    const p = s.players[0]!;
    expect(r.events.find((e) => e.type === "attackResolved")).toMatchObject({ damage: 3, defeated: true });
    expect([...p.deck, ...p.hand, ...p.discard].map((c) => c.uid)).toContain(target);
    expect(p.exp).toBe(1);
    expect(p.kills).toBe(1);
    expect(p.hand).toHaveLength(s.config.handSize);
    expect(s.step.kind).toBe("chooseAction");
    expect(s.route.flat().some((c) => c.uid === target)).toBe(false);
  });

  it("ダメージが足りなければ失敗し、敵は残る（その後1歩進む）", () => {
    const { s: s0, target, h } = battle(["food_bread", "hero_knight_1"], "enemy_ghost", 1);
    let s = act(s0, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_1") }).state;
    const r = act(s, "p1", { type: "confirmAttack" });
    expect(r.events.find((e) => e.type === "attackResolved")).toMatchObject({ damage: 0, defeated: false });
    expect(r.state.route[2]!.map((c) => c.uid)).toContain(target);
    expect(r.state.players[0]!.exp).toBe(0);
  });

  it("武器は場の英雄1人に1枚まで装備でき、ダメージに加わる", () => {
    const { s: s0, h } = battle(["food_bread", "hero_knight_1", "weapon_sword", "weapon_club"], "enemy_wolf");
    const knight = uidOf(h, "hero_knight_1");
    expect(errorOf(s0, "p1", { type: "equip", weaponUid: uidOf(h, "weapon_sword"), heroUid: knight })).toBe(
      "CARD_NOT_FOUND",
    );
    let s = act(s0, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: knight }).state;
    s = act(s, "p1", { type: "equip", weaponUid: uidOf(h, "weapon_sword"), heroUid: knight }).state;
    expect(errorOf(s, "p1", { type: "equip", weaponUid: uidOf(h, "weapon_club"), heroUid: knight })).toBe(
      "ALREADY_EQUIPPED",
    );
    expect(battlePreview(s, reg)?.total).toBe(5);
  });

  it("確定前なら出したカードを手札に戻せる。英雄を戻すと装備した武器も戻る", () => {
    const { s: s0, h } = battle(["food_bread", "hero_knight_1", "hero_mage_1", "weapon_sword"], "enemy_wolf");
    const knight = uidOf(h, "hero_knight_1");
    const mage = uidOf(h, "hero_mage_1");
    const bread = uidOf(h, "food_bread");
    let s = act(s0, "p1", { type: "playFood", uid: bread }).state;
    s = act(s, "p1", { type: "playHero", uid: knight }).state;
    s = act(s, "p1", { type: "playHero", uid: mage }).state;
    s = act(s, "p1", { type: "equip", weaponUid: uidOf(h, "weapon_sword"), heroUid: knight }).state;
    // 英雄2人（食料1＋無料の1枠）が出ているので、食料は戻せない
    expect(errorOf(s, "p1", { type: "undoBattleCard", uid: bread })).toBe("CANNOT_UNDO");
    s = act(s, "p1", { type: "undoBattleCard", uid: knight }).state;
    expect(hand(s)).toHaveLength(2);
    expect(s.players[0]!.field.map((c) => c.uid)).toEqual([bread, mage]);
    s = act(s, "p1", { type: "undoBattleCard", uid: bread }).state;
    s = act(s, "p1", { type: "undoBattleCard", uid: mage }).state;
    expect(hand(s)).toHaveLength(4);
    expect(s.turn).toMatchObject({ foodSlots: 0, usedSlots: 0, equips: {} });
  });

  it("食料がなくても英雄を1人出せる。2人目からは食料が必要", () => {
    const { s: s0, h } = battle(["hero_knight_1", "hero_mage_1"], "enemy_goblin");
    const s = act(s0, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_1") }).state;
    expect(errorOf(s, "p1", { type: "playHero", uid: uidOf(h, "hero_mage_1") })).toBe("NO_SLOT");
  });

  it("撃破した直後に、戦った英雄（場）をレベルアップできる。終えると手番が終わる", () => {
    const { s: s0, h } = battle(["hero_knight_1", "hero_mage_1"], "enemy_goblin");
    let s = mutate(s0, (d) => {
      d.players[0]!.exp = 1;
    });
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_1") }).state;
    s = act(s, "p1", { type: "confirmAttack" }).state;
    expect(s.step.kind).toBe("afterBattle");
    expect(s.players[0]!.exp).toBe(2);
    // 手札の英雄も対象
    expect(errorOf(s, "p1", { type: "levelUp", uid: uidOf(h, "hero_mage_1") })).toBeNull();
    expect(errorOf(s, "p1", { type: "chooseVillage" })).toBe("INVALID_STEP");
    s = act(s, "p1", { type: "levelUp", uid: uidOf(h, "hero_knight_1") }).state;
    const p = s.players[0]!;
    expect(p.exp).toBe(0);
    expect(p.field.some((c) => c.defId === "hero_knight_1")).toBe(false);
    expect(p.discard.some((c) => c.defId === "hero_knight_2")).toBe(true);
    const r = act(s, "p1", { type: "finishBattle" });
    expect(r.events.some((e) => e.type === "marchSkipped")).toBe(true);
    expect(r.state.step.kind).toBe("chooseAction");
  });

  it("撃破できなかったときは、レベルアップの段階にならない", () => {
    const { s: s0, h } = battle(["hero_knight_1"], "enemy_orc");
    let s = act(s0, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_1") }).state;
    s = act(s, "p1", { type: "confirmAttack" }).state;
    expect(s.step.kind).toBe("chooseAction");
  });

  it("村効果は戦闘では発動しない", () => {
    const { s: s0, h } = battle(["food_bread", "hero_bard_1"], "enemy_goblin");
    let s = act(s0, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_bard_1") }).state;
    expect(hand(s)).toHaveLength(0);
  });

  it("進軍ルートに敵がいなければ戦闘は選べない", () => {
    const s = start();
    expect(errorOf(s, "p1", { type: "chooseBattle", targetUid: "x" })).toBe("NO_ENEMY");
  });

  function bossBattle() {
    const { s, h, target } = battle(["food_feast", "hero_knight_3", "hero_mage_3", "hero_knight_3"], "enemy_dragon", 3);
    let st = act(s, "p1", { type: "playFood", uid: uidOf(h, "food_feast") }).state;
    st = act(st, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_3") }).state;
    st = act(st, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_3", 1) }).state;
    st = act(st, "p1", { type: "playHero", uid: uidOf(h, "hero_mage_3") }).state;
    return { s: st, target };
  }

  it("ボスに与えたダメージは残る（倒しきれなくても削れる）", () => {
    const { s, target } = bossBattle();
    expect(battlePreview(s, reg)).toMatchObject({ total: 24, hp: 36, prevDamage: 0 });
    const r = act(s, "p1", { type: "confirmAttack" });
    expect(r.state.result).toBeNull();
    expect(r.state.enemyDamage[target]).toBe(24);
    expect(r.events.find((e) => e.type === "attackResolved")).toMatchObject({ damage: 24, prevDamage: 0, defeated: false });
  });

  it("ボス以外の敵のダメージは残らない", () => {
    const { s: s0, target, h } = battle(["food_bread", "hero_knight_1"], "enemy_orc");
    let s = act(s0, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_1") }).state;
    s = act(s, "p1", { type: "confirmAttack" }).state;
    expect(s.enemyDamage[target]).toBeUndefined();
  });

  it("ボスを撃破すると勝利。耐久値の割合でチーム評価が決まる", () => {
    let { s, target } = bossBattle();
    s = mutate(s, (d) => {
      d.villageHp = 12; // 15 の 80%
      d.enemyDamage[target] = 12; // 前の手番までに削った分
    });
    expect(battlePreview(s, reg)).toMatchObject({ total: 24, hp: 36, prevDamage: 12 });
    const r = act(s, "p1", { type: "confirmAttack" });
    expect(r.state.result).toMatchObject({ outcome: "win", reason: "bossDefeated", rank: "S" });
    expect(r.state.enemyDamage[target]).toBeUndefined();
    expect(r.state.step.kind).toBe("finished");
    expect(errorOf(r.state, "p1", { type: "chooseVillage" })).toBe("GAME_OVER");
  });
});
