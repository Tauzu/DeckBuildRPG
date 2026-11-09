import { describe, expect, it } from "vitest";
import { createRegistry, DataError } from "../src/index.js";
import heroes from "../../../data/heroes.json";
import items from "../../../data/items.json";
import enemies from "../../../data/enemies.json";
import setup from "../../../data/setup.json";
import stages from "../../../data/stages.json";
import { createGame } from "../src/index.js";
import { act, allCards, errorOf, mutate, players, reg, setHand, start } from "./helpers.js";

describe("カードデータ", () => {
  it("標準データは検証を通る", () => {
    expect(() => createRegistry({ heroes, items, enemies, setup, stages })).not.toThrow();
  });

  it("形式の誤りを検出する", () => {
    const broken = heroes.map((h) => (h.id === "hero_knight_1" ? { ...h, physical: -1 } : h));
    expect(() => createRegistry({ heroes: broken, items, enemies, setup, stages })).toThrow(DataError);
  });

  it("整合性の誤りを検出する（英雄のレベル抜け）", () => {
    const broken = heroes.filter((h) => h.id !== "hero_mage_2");
    expect(() => createRegistry({ heroes: broken, items, enemies, setup, stages })).toThrow(/Lv1 から順に|Lv2/);
  });

  it("整合性の誤りを検出する（未定義のID）", () => {
    const broken = { ...setup, startingDeck: [{ id: "no_such_card", count: 1 }] };
    expect(() => createRegistry({ heroes, items, enemies, setup: broken, stages })).toThrow(/no_such_card/);
  });
});

describe("ステージ（企画書 12章）", () => {
  it("ステージを省略すると最後のステージ（魔竜）になる", () => {
    const s = start();
    expect(s.config.stageId).toBe("stage4");
    expect(s.enemyDeck.some((c) => c.defId === "enemy_dragon")).toBe(true);
  });

  it("ステージに登場するカードとボスだけが使われる", () => {
    const s = createGame({ seed: 1, players: players(1), stageId: "stage1" }, reg).state;
    expect(s.config.heroIds).toEqual(["knight", "mage", "hunter"]);
    expect(Object.keys(s.village.stacks).sort()).toEqual(
      ["food_bread", "food_jerky", "hero:hunter", "hero:knight", "hero:mage", "weapon_club", "weapon_javelin", "weapon_staff", "weapon_sword"].sort(),
    );
    const enemyIds = new Set(s.enemyDeck.map((c) => c.defId));
    expect([...enemyIds].sort()).toEqual(["enemy_bone_general", "enemy_goblin", "enemy_skeleton", "enemy_wolf"]);
    expect(s.config.bossHp).toBe(reg.stage("stage1").playerCounts["1"]!.bossHp);
  });

  it("ステージにいない英雄には転職できない", () => {
    let s = createGame({ seed: 1, players: players(1), stageId: "tutorial" }, reg).state;
    s = setHand(s, 0, ["hero_youth_0"]);
    s = mutate(s, (d) => {
      d.players[0]!.exp = 5;
    });
    s = act(s, "p1", { type: "chooseVillage" }).state;
    const uid = s.players[0]!.hand[0]!.uid;
    expect(errorOf(s, "p1", { type: "changeClass", uid, heroId: "hunter" })).toBe("UNKNOWN_STACK");
    expect(errorOf(s, "p1", { type: "changeClass", uid, heroId: "knight" })).toBeNull();
  });

  it("チュートリアルは1人でしか遊べない", () => {
    expect(() => createGame({ seed: 1, players: players(2), stageId: "tutorial" }, reg)).toThrow(/2人では遊べません/);
  });

  it("各ステージのボスが敵の山札に1体だけ入る", () => {
    for (const st of reg.stages) {
      const s = createGame({ seed: 3, players: players(1), stageId: st.id }, reg).state;
      expect(s.enemyDeck.filter((c) => reg.enemy(c.defId).isBoss).map((c) => c.defId)).toEqual([st.bossId]);
    }
  });
});

describe("ゲームの準備（仕様書 4章）", () => {
  it.each([
    [1, 18, 15, 40],
    [2, 24, 15, 69],
    [3, 30, 20, 113],
    [4, 36, 20, 165],
  ])("%i人：敵の山札・耐久値・ボスの生命力", (n, enemyCount, hp, bossHp) => {
    const s = start(n);
    expect(s.enemyDeck).toHaveLength(enemyCount + 1);
    expect(s.villageHp).toBe(hp);
    expect(s.config.bossHp).toBe(bossHp);
    expect(s.players).toHaveLength(n);
  });

  it("各プレイヤーは初期デッキ10枚から手札の枚数だけ引いている", () => {
    const s = start(4);
    expect(s.config.handSize).toBe(5);
    for (const p of s.players) {
      expect(p.hand).toHaveLength(5);
      expect(p.deck).toHaveLength(5);
      const ids = [...p.hand, ...p.deck].map((c) => c.defId).sort();
      expect(ids.filter((id) => id === "hero_youth_0")).toHaveLength(3);
      expect(ids.filter((id) => id === "food_bread")).toHaveLength(5);
      expect(ids.filter((id) => id === "weapon_club")).toHaveLength(2);
    }
  });

  it("ボスは敵の山札の底3枚のどこかにある", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = start(1, seed);
      const bossIndex = s.enemyDeck.findIndex((c) => c.defId === "enemy_dragon");
      expect(bossIndex).toBeGreaterThanOrEqual(s.enemyDeck.length - 3);
    }
  });

  it("序盤の束（上から9枚）はゴブリン・狼・スケルトン1・亡霊1", () => {
    const s = start(1, 7);
    const early = s.enemyDeck.slice(0, 9).map((c) => c.defId);
    expect(early.filter((id) => id === "enemy_goblin")).toHaveLength(4);
    expect(early.filter((id) => id === "enemy_wolf")).toHaveLength(3);
    expect(early.filter((id) => id === "enemy_skeleton")).toHaveLength(1);
    expect(early.filter((id) => id === "enemy_ghost")).toHaveLength(1);
  });

  it("英雄在庫は上から Lv1→Lv2→Lv3 の順", () => {
    const s = start();
    const levels = s.village.stacks["hero:knight"]!.map((c) => reg.hero(c.defId).level);
    expect(levels).toEqual([1, 1, 1, 1, 2, 2, 2, 3, 3]);
  });

  it("同じシード値なら同じ状態になる", () => {
    expect(start(3, 42)).toEqual(start(3, 42));
    expect(start(3, 42)).not.toEqual(start(3, 43));
  });

  it("カードの uid はすべて異なる", () => {
    const all = allCards(start(4));
    expect(new Set(all.map((c) => c.uid)).size).toBe(all.length);
  });
});
