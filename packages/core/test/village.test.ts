import { describe, expect, it } from "vitest";
import { currentGold } from "../src/index.js";
import { act, cards, errorOf, hand, mutate, reg, setHand, start, uidOf } from "./helpers.js";

function visit(defIds: string[]) {
  const s = setHand(start(), 0, defIds);
  return act(s, "p1", { type: "chooseVillage" }).state;
}

describe("購入（仕様書 5.2(c)）", () => {
  it("金価値の合計で在庫の一番上を買い、捨て札に加える", () => {
    let s = visit(["food_bread", "food_bread", "food_bread", "hero_youth_0"]);
    expect(currentGold(s, reg)).toBe(4);
    s = act(s, "p1", { type: "buy", stackId: "hero:knight" }).state;
    expect(s.players[0]!.discard.at(-1)!.defId).toBe("hero_knight_1");
    expect(s.village.stacks["hero:knight"]).toHaveLength(8);
    expect(currentGold(s, reg)).toBe(0);
    expect(errorOf(s, "p1", { type: "buy", stackId: "food_bread" })).toBe("NOT_ENOUGH_GOLD");
  });

  it("金が足りる限り何枚でも買える", () => {
    let s = visit(["food_wine", "food_wine", "food_wine"]);
    s = act(s, "p1", { type: "buy", stackId: "food_bread" }).state;
    s = act(s, "p1", { type: "buy", stackId: "food_bread" }).state;
    s = act(s, "p1", { type: "buy", stackId: "weapon_club" }).state;
    expect(currentGold(s, reg)).toBe(3);
  });

  it("在庫がなければ買えない", () => {
    let s = visit(["food_wine"]);
    s = mutate(s, (d) => {
      d.village.stacks["food_bread"] = [];
    });
    expect(errorOf(s, "p1", { type: "buy", stackId: "food_bread" })).toBe("STOCK_EMPTY");
    expect(errorOf(s, "p1", { type: "buy", stackId: "nothing" })).toBe("UNKNOWN_STACK");
  });

  it("集落を訪れていないときは買えない", () => {
    const s = start();
    expect(errorOf(s, "p1", { type: "buy", stackId: "food_bread" })).toBe("INVALID_STEP");
  });
});

describe("村効果（仕様書 5.2(b)）", () => {
  it("英雄は食糧値の枚数＋1人までしか出せない（1人は食料なしで出せる）", () => {
    const s0 = visit(["food_bread", "hero_bard_1", "hero_thief_1", "hero_priest_1"]);
    const h = hand(s0);
    let s = act(s0, "p1", { type: "playHero", uid: uidOf(h, "hero_thief_1") }).state;
    expect(errorOf(s, "p1", { type: "playHero", uid: uidOf(h, "hero_bard_1") })).toBe("NO_SLOT");
    s = act(s, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_bard_1") }).state;
    expect(errorOf(s, "p1", { type: "playHero", uid: uidOf(h, "hero_priest_1") })).toBe("NO_SLOT");
  });

  it("吟遊詩人：カードを引く", () => {
    const s0 = visit(["food_bread", "hero_bard_1"]);
    const h = hand(s0);
    let s = act(s0, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    const deckBefore = s.players[0]!.deck.length;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_bard_1") }).state;
    expect(hand(s)).toHaveLength(2);
    expect(s.players[0]!.deck).toHaveLength(deckBefore - 2);
  });

  it("吟遊詩人Lv3：2枚引いて金+1（組み合わせの効果）", () => {
    const s0 = visit(["food_bread", "hero_bard_3"]);
    const h = hand(s0);
    let s = act(s0, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_bard_3") }).state;
    expect(hand(s)).toHaveLength(2);
    expect(s.turn?.action === "village" && s.turn.bonusGold).toBe(1);
  });

  it("盗賊：金が増え、自分の金価値も使える", () => {
    const s0 = visit(["food_bread", "hero_thief_1"]);
    const h = hand(s0);
    let s = act(s0, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_thief_1") }).state;
    expect(currentGold(s, reg)).toBe(3);
  });

  it("狩人Lv3：経験値+1（所持・総獲得の両方）", () => {
    const s0 = visit(["food_bread", "hero_hunter_3"]);
    const h = hand(s0);
    let s = act(s0, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_hunter_3") }).state;
    expect(s.players[0]!.exp).toBe(1);
    expect(s.players[0]!.totalExp).toBe(1);
  });

  it("僧侶：手札か捨て札から選んで廃棄する。選ぶまで他の操作はできない", () => {
    let s0 = visit(["food_bread", "hero_priest_1", "hero_youth_0"]);
    s0 = mutate(s0, (d) => {
      d.players[0]!.discard = cards("curse");
    });
    const h = hand(s0);
    const curseUid = s0.players[0]!.discard[0]!.uid;
    let s = act(s0, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_priest_1") }).state;
    expect(s.pending).toEqual({ kind: "trash", playerId: "p1", max: 1 });
    expect(errorOf(s, "p1", { type: "endVisit" })).toBe("PENDING_INPUT");
    expect(errorOf(s, "p1", { type: "resolveTrash", uids: [curseUid, uidOf(h, "hero_youth_0")] })).toBe(
      "INVALID_SELECTION",
    );
    s = act(s, "p1", { type: "resolveTrash", uids: [curseUid] }).state;
    expect(s.pending).toBeNull();
    expect(s.players[0]!.discard).toHaveLength(0);
    expect(s.trash.map((c) => c.uid)).toContain(curseUid);
  });

  it("僧侶：使った金が足りなくなる廃棄はできない", () => {
    const s0 = visit(["food_bread", "hero_priest_1", "food_wine"]);
    const h = hand(s0);
    let s = act(s0, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    // 所持金 4 のうち 3 を使い、1 残る
    s = act(s, "p1", { type: "buy", stackId: "food_jerky" }).state;
    expect(currentGold(s, reg)).toBe(1);
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_priest_1") }).state;
    // 葡萄酒（金2）を廃棄すると -1 になるのでできない
    expect(errorOf(s, "p1", { type: "resolveTrash", uids: [uidOf(h, "food_wine")] })).toBe("NOT_ENOUGH_GOLD");
    s = act(s, "p1", { type: "resolveTrash", uids: [] }).state;
    expect(s.pending).toBeNull();
  });
});

describe("レベルアップ・転職（仕様書 5.2(d)(e)）", () => {
  it("経験値を使い、手札の英雄を廃棄して1つ上のレベルを捨て札に加える", () => {
    let s = visit(["hero_knight_1"]);
    s = mutate(s, (d) => {
      d.players[0]!.exp = 2;
      d.players[0]!.totalExp = 2;
    });
    const uid = uidOf(hand(s), "hero_knight_1");
    s = act(s, "p1", { type: "levelUp", uid }).state;
    const p = s.players[0]!;
    expect(p.exp).toBe(0);
    expect(p.totalExp).toBe(2);
    expect(p.discard.at(-1)!.defId).toBe("hero_knight_2");
    expect(s.trash.map((c) => c.uid)).toContain(uid);
    // 在庫の Lv1 は上に残ったまま、Lv2 が1枚減る
    const levels = s.village.stacks["hero:knight"]!.map((c) => reg.hero(c.defId).level);
    expect(levels).toEqual([1, 1, 1, 1, 2, 2, 3, 3]);
  });

  it("経験値が足りない・最大レベル・在庫切れはできない", () => {
    let s = visit(["hero_knight_1", "hero_knight_3", "hero_mage_2"]);
    s = mutate(s, (d) => {
      d.players[0]!.exp = 3;
      d.village.stacks["hero:mage"] = d.village.stacks["hero:mage"]!.filter((c) => c.defId !== "hero_mage_3");
    });
    const h = hand(s);
    expect(errorOf(s, "p1", { type: "levelUp", uid: uidOf(h, "hero_knight_3") })).toBe("MAX_LEVEL");
    expect(errorOf(s, "p1", { type: "levelUp", uid: uidOf(h, "hero_mage_2") })).toBe("NOT_ENOUGH_EXP");
    s = mutate(s, (d) => {
      d.players[0]!.exp = 4;
    });
    expect(errorOf(s, "p1", { type: "levelUp", uid: uidOf(h, "hero_mage_2") })).toBe("STOCK_EMPTY");
    expect(errorOf(s, "p1", { type: "levelUp", uid: uidOf(h, "hero_knight_1") })).toBeNull();
  });

  it("場に出した英雄はレベルアップできない", () => {
    let s = visit(["food_bread", "hero_knight_1"]);
    s = mutate(s, (d) => {
      d.players[0]!.exp = 3;
    });
    const h = hand(s);
    s = act(s, "p1", { type: "playFood", uid: uidOf(h, "food_bread") }).state;
    s = act(s, "p1", { type: "playHero", uid: uidOf(h, "hero_knight_1") }).state;
    expect(errorOf(s, "p1", { type: "levelUp", uid: uidOf(h, "hero_knight_1") })).toBe("CARD_NOT_FOUND");
  });

  it("村の若者は経験値2で好きな英雄の Lv1 に転職できる", () => {
    let s = visit(["hero_youth_0"]);
    s = mutate(s, (d) => {
      d.players[0]!.exp = 2;
    });
    const uid = uidOf(hand(s), "hero_youth_0");
    expect(errorOf(s, "p1", { type: "levelUp", uid })).toBe("WRONG_CARD_TYPE");
    s = act(s, "p1", { type: "changeClass", uid, heroId: "mage" }).state;
    expect(s.players[0]!.discard.at(-1)!.defId).toBe("hero_mage_1");
    expect(s.players[0]!.exp).toBe(0);
  });

  it("レベルアップで手札の金価値が減り、使った金が足りなくなる場合はできない", () => {
    let s = visit(["food_bread", "food_bread", "food_bread", "hero_knight_1"]);
    s = mutate(s, (d) => {
      d.players[0]!.exp = 3;
    });
    s = act(s, "p1", { type: "buy", stackId: "hero:mage" }).state;
    expect(errorOf(s, "p1", { type: "levelUp", uid: uidOf(hand(s), "hero_knight_1") })).toBe("NOT_ENOUGH_GOLD");
  });
});
