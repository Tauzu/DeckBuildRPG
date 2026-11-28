import { describe, expect, it } from "vitest";
import { turnsPerPlayer, winRank } from "../src/flow.js";
import { mutate, start } from "./helpers.js";

describe("評価（速さ）", () => {
  const withPar = (players: number, turnCount: number, villageHp?: number) =>
    mutate(start(players), (d) => {
      d.config.rankTurns = { S: 10, A: 15 };
      d.turnCount = turnCount;
      if (villageHp !== undefined) d.villageHp = villageHp;
    });

  it("1人あたりの手番数は、全員の手番の合計を人数で割って切り上げる", () => {
    expect(turnsPerPlayer(withPar(1, 10))).toBe(10);
    expect(turnsPerPlayer(withPar(3, 31))).toBe(11);
  });

  it("目安以内なら S、次の目安以内なら A、それより遅ければ B", () => {
    expect(winRank(withPar(1, 10))).toBe("S");
    expect(winRank(withPar(1, 11))).toBe("A");
    expect(winRank(withPar(1, 15))).toBe("A");
    expect(winRank(withPar(1, 16))).toBe("B");
    expect(winRank(withPar(4, 40))).toBe("S");
    expect(winRank(withPar(4, 41))).toBe("A");
  });

  it("集落の耐久値が半分を切ると1つ下がる（B より下にはならない）", () => {
    const s = start(1);
    const half = Math.floor(s.config.villageHp / 2) - 1;
    expect(winRank(withPar(1, 10, half))).toBe("A");
    expect(winRank(withPar(1, 12, half))).toBe("B");
    expect(winRank(withPar(1, 20, half))).toBe("B");
  });

  it("目安のないステージは、これまでどおり集落の耐久値で決める", () => {
    const s = mutate(start(1), (d) => {
      delete d.config.rankTurns;
      d.turnCount = 99;
    });
    expect(winRank(s)).toBe("S");
    const hurt = mutate(s, (d) => {
      d.villageHp = Math.floor(d.config.villageHp * 0.6);
    });
    expect(winRank(hurt)).toBe("A");
  });
});
