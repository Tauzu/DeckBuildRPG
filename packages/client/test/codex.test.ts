// カード図鑑（企画書 13.4）
import { createGame, defaultRegistry, viewFor } from "@deckbuild/core";
import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "../src/achievements.js";
import { addSeen, bossHpFor, cardsOfStage, codexGroups, codexIds, seedSeen, visibleDefIds } from "../src/codex.js";
import { emptyProgress } from "../src/progress.js";

const reg = defaultRegistry();

describe("カード図鑑", () => {
  it("データにあるカードがすべて、1回ずつ並ぶ", () => {
    const ids = codexIds(reg);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(reg.all().map((d) => d.id).sort());
    expect(codexGroups(reg).map((g) => g.label)).toEqual(["英雄", "食料", "武器", "魔物", "ボス", "呪い"]);
    // 英雄は村の若者が最初、種類ごとにレベル順
    const heroes = codexGroups(reg)[0]!.rows;
    expect(heroes[0]).toEqual(["hero_youth_0"]);
    expect(heroes[1]).toEqual(["hero_knight_1", "hero_knight_2", "hero_knight_3"]);
  });

  it("ゲームの画面に見えているカードを拾う", () => {
    const s = createGame({ seed: 3, players: [{ id: "p1", name: "a" }], stageId: "stage1" }, reg).state;
    const ids = visibleDefIds(viewFor(s, "p1"));
    // 村の在庫の一番上（英雄は Lv1）と、自分の手札
    expect(ids).toContain("hero_knight_1");
    expect(ids).toContain("weapon_javelin");
    expect(ids).not.toContain("hero_knight_2");
    for (const c of s.players[0]!.hand) expect(ids).toContain(c.defId);
  });

  it("見たカードを足す。増えなければ同じものを返す", () => {
    const p = addSeen(emptyProgress(), ["a", "b"]);
    expect(p.seen).toEqual(["a", "b"]);
    expect(addSeen(p, ["b"])).toBe(p);
  });

  it("図鑑の記録がない古い進み具合には、クリアしたステージのカードを入れる", () => {
    const old = { ...emptyProgress(), cleared: ["tutorial", "stage1"] };
    const p = seedSeen(reg, old);
    expect(p.seen).toEqual(expect.arrayContaining(cardsOfStage(reg, reg.stage("stage1"))));
    expect(p.seen).toContain("enemy_goblin_chief");
    expect(p.seen).not.toContain("enemy_dragon");
    // 記録があれば、そのまま
    const has = { ...old, seen: ["food_bread"] };
    expect(seedSeen(reg, has)).toBe(has);
  });

  it("ボスの生命力は1人のときの値", () => {
    expect(bossHpFor(reg, "enemy_bone_general")).toBe(reg.stage("stage1").playerCounts["1"]!.bossHp);
  });

  it("図鑑をすべて埋めると実績", () => {
    const a = ACHIEVEMENTS.find((x) => x.id === "codex")!;
    const progress = { ...emptyProgress(), seen: codexIds(reg) };
    expect(a.check({ reg, progress } as never)).toBe(true);
    expect(a.check({ reg, progress: { ...progress, seen: progress.seen.slice(1) } } as never)).toBe(false);
  });
});
