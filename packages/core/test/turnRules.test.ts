import { describe, expect, it } from "vitest";
import { act, errorOf, hand, placeEnemy, setHand, start, uidOf } from "./helpers.js";

describe("行動の取り消し", () => {
  it("集落：まだ何もしていなければ行動の選択に戻れる", () => {
    let s = act(start(), "p1", { type: "chooseVillage" }).state;
    s = act(s, "p1", { type: "cancelAction" }).state;
    expect(s.step.kind).toBe("chooseAction");
    expect(s.turn).toBeNull();
    expect(s.turnCount).toBe(1);
  });

  it("集落：カードを出したり購入したりした後は取り消せない", () => {
    let s = setHand(start(), 0, ["food_bread", "food_wine", "food_wine"]);
    s = act(s, "p1", { type: "chooseVillage" }).state;
    const bought = act(s, "p1", { type: "buy", stackId: "food_bread" }).state;
    expect(errorOf(bought, "p1", { type: "cancelAction" })).toBe("CANNOT_CANCEL");
    const played = act(s, "p1", { type: "playFood", uid: uidOf(hand(s), "food_bread") }).state;
    expect(errorOf(played, "p1", { type: "cancelAction" })).toBe("CANNOT_CANCEL");
  });

  it("戦闘：確定前なら、出したカードを手札に戻して取り消せる", () => {
    const placed = placeEnemy(setHand(start(), 0, ["food_bread", "hero_knight_1", "weapon_sword"]), 2, "enemy_wolf");
    let s = act(placed.state, "p1", { type: "chooseBattle", targetUid: placed.uid }).state;
    const h = hand(s);
    s = act(s, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_1") }).state;
    s = act(s, "p1", { type: "equip", weaponUid: uidOf(h, "weapon_sword"), heroUid: uidOf(h, "hero_knight_1") }).state;
    s = act(s, "p1", { type: "cancelAction" }).state;
    expect(s.step.kind).toBe("chooseAction");
    expect(s.players[0]!.field).toHaveLength(0);
    expect(hand(s)).toHaveLength(3);
    // 取り消した後は集落を訪れてもよい
    expect(errorOf(s, "p1", { type: "chooseVillage" })).toBeNull();
  });

  it("行動を選ぶ前は取り消しはできない", () => {
    expect(errorOf(start(), "p1", { type: "cancelAction" })).toBe("INVALID_STEP");
  });
});

describe("敵を撃破した手番は進軍しない", () => {
  function attack(enemy: string, heroes: string[]) {
    const placed = placeEnemy(setHand(start(), 0, ["food_jerky", ...heroes]), 3, enemy);
    let s = placed.state;
    const deckBefore = s.enemyDeck.length;
    s = act(s, "p1", { type: "chooseBattle", targetUid: placed.uid }).state;
    const h = hand(s);
    s = act(s, "p1", { type: "playFood", uid: uidOf(h, "food_jerky") }).state;
    for (const id of heroes) s = act(s, "p1", { type: "playHero", uid: uidOf(h, id) }).state;
    return { r: act(s, "p1", { type: "confirmAttack" }), deckBefore };
  }

  it("撃破したら敵は進まず、新しい敵も公開されない", () => {
    let { state } = placeEnemy(start(), 4, "enemy_orc"); // 集落の手前にもう1体
    const placed = placeEnemy(setHand(state, 0, ["food_jerky", "hero_knight_1"]), 1, "enemy_goblin");
    state = placed.state;
    const deckBefore = state.enemyDeck.length;
    let s = act(state, "p1", { type: "chooseBattle", targetUid: placed.uid }).state;
    const h = hand(s);
    s = act(s, "p1", { type: "playFood", uid: uidOf(h, "food_jerky") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_1") }).state;
    const r = act(s, "p1", { type: "confirmAttack" });
    expect(r.events.some((e) => e.type === "marchSkipped")).toBe(true);
    expect(r.events.some((e) => e.type === "enemyMoved" || e.type === "enemyRevealed")).toBe(false);
    expect(r.state.route[4]!.map((c) => c.defId)).toEqual(["enemy_orc"]);
    expect(r.state.villageHp).toBe(15);
    expect(r.state.enemyDeck).toHaveLength(deckBefore);
    expect(r.state.turnCount).toBe(2);
    expect(hand(r.state)).toHaveLength(r.state.config.handSize);
  });

  it("撃破できなかったら通常どおり進軍する", () => {
    const { r, deckBefore } = attack("enemy_orc", ["hero_knight_1"]);
    expect(r.events.some((e) => e.type === "marchSkipped")).toBe(false);
    expect(r.state.route[4]!.map((c) => c.defId)).toEqual(["enemy_orc"]);
    expect(r.state.enemyDeck).toHaveLength(deckBefore - 1);
  });

  it("撃破した手番はボスの進軍時の能力も発動しない", () => {
    let s = start(2);
    s = placeEnemy(s, 0, "enemy_dragon").state;
    const placed = placeEnemy(setHand(s, 0, ["food_bread", "hero_knight_1"]), 2, "enemy_goblin");
    s = act(placed.state, "p1", { type: "chooseBattle", targetUid: placed.uid }).state;
    const h = hand(s);
    s = act(s, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_1") }).state;
    const r = act(s, "p1", { type: "confirmAttack" });
    expect(r.state.pending).toBeNull();
    expect(r.state.currentPlayer).toBe(1);
  });
});

describe("戦利品の売却", () => {
  it("集落を訪れた手番の終わりに、手札の敵カードは金として使われて取り除かれる", () => {
    let s = setHand(start(), 0, ["enemy_orc", "enemy_goblin", "food_bread"]);
    s = act(s, "p1", { type: "chooseVillage" }).state;
    s = act(s, "p1", { type: "buy", stackId: "hero:knight" }).state;
    const r = act(s, "p1", { type: "endVisit" });
    expect(r.events.find((e) => e.type === "lootSold")).toMatchObject({ defIds: ["enemy_orc", "enemy_goblin"] });
    const trashed = r.state.trash.map((c) => c.defId);
    expect(trashed).toContain("enemy_orc");
    expect(trashed).toContain("enemy_goblin");
    const p = r.state.players[0]!;
    // 敵カード以外は通常どおり捨て札へ（その後の引き直しで手札・山札に移ることもある）
    expect([...p.deck, ...p.hand, ...p.discard].some((c) => c.defId === "food_bread")).toBe(true);
    expect([...p.deck, ...p.hand, ...p.discard].some((c) => c.defId.startsWith("enemy_"))).toBe(false);
  });

  it("戦闘した手番では売却されない", () => {
    const placed = placeEnemy(setHand(start(), 0, ["enemy_orc", "food_bread", "hero_knight_1"]), 2, "enemy_goblin");
    let s = act(placed.state, "p1", { type: "chooseBattle", targetUid: placed.uid }).state;
    s = act(s, "p1", { type: "confirmAttack" }).state;
    expect(s.trash.some((c) => c.defId === "enemy_orc")).toBe(false);
  });
});
