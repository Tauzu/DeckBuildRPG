// 危険度（企画書 13.1）：条件が足し合わされ、ゲームの準備に反映されること
import { describe, expect, it } from "vitest";
import { createGame, createRegistry, enemyHp, newRecord, replay } from "../src/index.js";
import heroes from "../../../data/heroes.json";
import items from "../../../data/items.json";
import enemies from "../../../data/enemies.json";
import setup from "../../../data/setup.json";
import stages from "../../../data/stages.json";
import { players, reg } from "./helpers.js";

const dangers = [
  { level: 1, text: "ボス +50%", add: { bossHpPct: 50 } },
  { level: 2, text: "集落 −5・魔物 +2", add: { villageHp: -5, enemyHp: 2 } },
  { level: 3, text: "呪い2枚・山札 −3", add: { startCurses: 2, enemyDeckTrim: 3 } },
  { level: 4, text: "手札 −1", add: { handSize: -1 } },
];
const testReg = createRegistry({ heroes, items, enemies, setup, stages, dangers });
const game = (danger: number, stageId = "stage1") => createGame({ seed: 5, players: players(1), stageId, danger }, testReg).state;

describe("危険度", () => {
  it("危険度0は通常と同じ", () => {
    const a = game(0);
    const b = createGame({ seed: 5, players: players(1), stageId: "stage1" }, testReg).state;
    expect(a).toEqual(b);
    expect(a.config.danger).toBe(0);
  });

  it("それまでの段階の条件が足し合わされる", () => {
    expect(testReg.dangerModifiers(2)).toEqual({ bossHpPct: 50, villageHp: -5, enemyHp: 2, startCurses: 0, enemyDeckTrim: 0, handSize: 0 });
    expect(testReg.maxDanger).toBe(4);
  });

  it("ボスの生命力・集落の耐久値・魔物の生命力が変わる", () => {
    const base = game(0);
    const s = game(2);
    expect(s.config.bossHp).toBe(Math.round(base.config.bossHp * 1.5));
    expect(s.config.villageHp).toBe(base.config.villageHp - 5);
    expect(s.villageHp).toBe(base.villageHp - 5);
    const wolf = testReg.enemy("enemy_wolf");
    expect(enemyHp(s, wolf)).toBe((wolf.hp ?? 0) + 2);
    // ボスの生命力は割合で増え、魔物の生命力の増加は足さない
    expect(enemyHp(s, testReg.enemy("enemy_bone_general"))).toBe(s.config.bossHp);
  });

  it("最初の山札に呪いが入り、魔物の山札が減る", () => {
    const base = game(0);
    const s = game(3);
    const p = s.players[0]!;
    const all = [...p.deck, ...p.hand];
    expect(all.filter((c) => c.defId === testReg.curseId)).toHaveLength(2);
    expect(s.enemyDeck.length).toBe(base.enemyDeck.length - 3);
    // ボスは残っている
    expect(s.enemyDeck.some((c) => c.defId === "enemy_bone_general")).toBe(true);
  });

  it("手札の枚数が減る", () => {
    const s = game(4);
    expect(s.config.handSize).toBe(setup.handSize - 1);
    expect(s.players[0]!.hand).toHaveLength(setup.handSize - 1);
  });

  it("範囲の外やチュートリアルでは始められない", () => {
    expect(() => game(5)).toThrow(/危険度は 0～4/);
    expect(() => game(-1)).toThrow();
    expect(() => game(1, "tutorial")).toThrow(/チュートリアル/);
  });

  it("記録から危険度つきで再現できる", () => {
    const record = newRecord(5, players(1), testReg, "stage1", 3);
    expect(replay(record, testReg)).toEqual(game(3));
  });

  it("標準データの危険度は1から順に並び、最高は10", () => {
    expect(reg.maxDanger).toBe(10);
    reg.dangers.forEach((d, i) => expect(d.level).toBe(i + 1));
  });

  it("危険度の段階が順に並んでいないとデータの誤り", () => {
    const broken = [dangers[1], dangers[0]];
    expect(() => createRegistry({ heroes, items, enemies, setup, stages, dangers: broken })).toThrow(/1 から順に/);
  });
});
