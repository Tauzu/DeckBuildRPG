// 進み具合・実績・引き継ぎコード（企画書 13章）
import { defaultRegistry, type GameResult, type PlayerPublicView } from "@deckbuild/core";
import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, addToTally, emptyTally, recordGameEnd } from "../src/achievements.js";
import {
  CodeError,
  emptyProgress,
  exportCode,
  importCode,
  markCleared,
  maxDangerFor,
  mergeProgress,
  normalizeProgress,
  type Progress,
} from "../src/progress.js";

const reg = defaultRegistry();
const stage1 = reg.stage("stage1");

describe("進み具合", () => {
  it("古い形（v1）を読み込むと、クリアしたステージは危険度0のクリアになる", () => {
    const p = normalizeProgress({ cleared: ["tutorial", "stage1"] });
    expect(p.cleared).toEqual(["tutorial", "stage1"]);
    expect(p.bestDanger).toEqual({ tutorial: 0, stage1: 0 });
    expect(p.stats.games).toBe(0);
  });

  it("おかしな値は捨てる", () => {
    const p = normalizeProgress({ cleared: [1, "stage1"], bestDanger: { stage1: "x" }, stats: { wins: -3, heroWins: [5] } });
    expect(p.cleared).toEqual(["stage1"]);
    expect(p.bestDanger).toEqual({ stage1: 0 });
    expect(p.stats.wins).toBe(0);
    expect(p.stats.heroWins).toEqual([]);
  });

  it("クリアすると次の危険度が選べるようになる", () => {
    let p = emptyProgress();
    expect(maxDangerFor(stage1, p, 10)).toBe(0);
    let r = markCleared(p, "stage1", 0);
    expect(r).toMatchObject({ newStage: true, newDanger: true });
    p = r.progress;
    expect(maxDangerFor(stage1, p, 10)).toBe(1);
    r = markCleared(p, "stage1", 1);
    expect(r).toMatchObject({ newStage: false, newDanger: true });
    expect(maxDangerFor(stage1, r.progress, 10)).toBe(2);
    // 低い危険度でクリアしても下がらない
    r = markCleared(r.progress, "stage1", 0);
    expect(r).toMatchObject({ newStage: false, newDanger: false });
    expect(r.progress.bestDanger.stage1).toBe(1);
  });

  it("危険度は最高まで。チュートリアルには危険度がない", () => {
    const p = { ...emptyProgress(), cleared: ["tutorial", "stage1"], bestDanger: { tutorial: 0, stage1: 10 } };
    expect(maxDangerFor(stage1, p, 10)).toBe(10);
    expect(maxDangerFor(reg.stage("tutorial"), p, 10)).toBe(0);
  });

  it("合わせても記録は消えない", () => {
    const a: Progress = {
      cleared: ["stage1"],
      bestDanger: { stage1: 3 },
      achievements: { first_win: 200 },
      stats: { games: 10, wins: 5, kills: 40, heroWins: ["knight"] },
      seen: ["food_bread"],
    };
    const b: Progress = {
      cleared: ["stage2"],
      bestDanger: { stage1: 1, stage2: 2 },
      achievements: { first_win: 100, danger1: 300 },
      stats: { games: 4, wins: 7, kills: 10, heroWins: ["mage"] },
      seen: ["food_bread", "enemy_wolf"],
    };
    const m = mergeProgress(a, b);
    expect(m.cleared.sort()).toEqual(["stage1", "stage2"]);
    expect(m.bestDanger).toEqual({ stage1: 3, stage2: 2 });
    expect(m.achievements).toEqual({ first_win: 100, danger1: 300 });
    expect(m.stats).toEqual({ games: 10, wins: 7, kills: 40, heroWins: ["knight", "mage"] });
    expect(m.seen).toEqual(["food_bread", "enemy_wolf"]);
  });
});

describe("引き継ぎコード", () => {
  const p: Progress = {
    cleared: ["tutorial", "stage1", "stage2"],
    bestDanger: { tutorial: 0, stage1: 4, stage2: 0 },
    achievements: { first_win: 1700000000000, danger1: 1700000001000 },
    stats: { games: 12, wins: 8, kills: 130, heroWins: ["knight", "mage", "hunter"] },
    seen: ["hero_youth_0", "food_bread", "weapon_club", "enemy_goblin", "enemy_wolf"],
  };

  it("書き出して読み込むと元に戻る", async () => {
    const code = await exportCode(p);
    expect(code).toMatch(/^HK1-[A-Za-z0-9_-]+-[0-9A-Z]{4}$/);
    expect(await importCode(code)).toEqual(p);
    // 前後の空白や改行が入っていても読める
    expect(await importCode(`  ${code.slice(0, 20)}\n${code.slice(20)}  `)).toEqual(p);
  });

  it("1文字でも違うと読み込まない", async () => {
    const code = await exportCode(p);
    const i = 10;
    const broken = code.slice(0, i) + (code[i] === "A" ? "B" : "A") + code.slice(i + 1);
    await expect(importCode(broken)).rejects.toThrow(CodeError);
    await expect(importCode(code.slice(0, -6))).rejects.toThrow(CodeError);
    await expect(importCode("hello")).rejects.toThrow(/HK1-/);
  });
});

describe("実績", () => {
  const me: PlayerPublicView = {
    id: "p1",
    name: "あなた",
    handCount: 0,
    deckCount: 0,
    discardCount: 0,
    discardTop: null,
    field: [],
    exp: 0,
    totalExp: 10,
    kills: 5,
  };
  const winResult: GameResult = { outcome: "win", reason: "bossDefeated", rank: "S", villageHp: 15, mvp: [], titles: {} };
  const base = {
    reg,
    stage: stage1,
    danger: 0,
    playerCount: 1,
    result: winResult,
    me,
    turnCount: 30,
    villageHp: 15,
    villageHpMax: 15,
    tally: emptyTally(),
    progress: markCleared(emptyProgress(), "stage1", 0).progress,
  };
  const ids = (list: { id: string }[]) => list.map((a) => a.id).sort();

  it("勝つと「はじめての勝利」「無傷の守り」などを達成し、通算の記録が増える", () => {
    const tally = addToTally(
      emptyTally(),
      [
        { type: "cardBought", playerId: "p1", uid: "u1", defId: "hero_knight_1", cost: 4 },
        { type: "cardBought", playerId: "p2", uid: "u2", defId: "weapon_sword", cost: 3 },
        { type: "attackResolved", playerId: "p1", targetUid: "e", targetDefId: "enemy_wolf", damage: 7, prevDamage: 0, hp: 4, defeated: true },
      ],
      "p1",
      reg,
    );
    expect(tally).toMatchObject({ bought: ["hero_knight_1"], heroIds: ["knight"], maxHit: 7 });
    const r = recordGameEnd({ ...base, tally });
    // 武器を買っていない・買ったのは1枚・英雄は1種類
    expect(ids(r.unlocked)).toEqual(["first_win", "flawless", "frugal", "no_weapon", "one_class"]);
    expect(r.progress.stats).toEqual({ games: 1, wins: 1, kills: 5, heroWins: ["knight"] });
    // もう一度同じ条件で勝っても、達成済みのものは出さない
    expect(recordGameEnd({ ...base, tally, progress: r.progress }).unlocked).toEqual([]);
  });

  it("負けても通算の記録は増える。勝ち負けを問わない実績は達成できる", () => {
    const tally = { ...emptyTally(), maxHit: 20, reachedMaxLevel: true };
    const lose: GameResult = { ...winResult, outcome: "lose", reason: "bossArrived" };
    const r = recordGameEnd({ ...base, result: lose, tally });
    expect(ids(r.unlocked)).toEqual(["big_hit", "max_level"]);
    expect(r.progress.stats).toMatchObject({ games: 1, wins: 0, heroWins: [] });
  });

  it("危険度の実績", () => {
    const r = recordGameEnd({ ...base, danger: 3, villageHp: 3, tally: { ...emptyTally(), bought: Array(9).fill("weapon_sword") } });
    expect(ids(r.unlocked)).toEqual(["danger1", "danger5", "first_win"]);
  });

  it("実績のIDは重ならない", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
