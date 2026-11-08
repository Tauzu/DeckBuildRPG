// 使い方:
//   npm run sim -- --players 1,2,4 --games 300 --bot smart --variants base,cheapLv,cheapLv+moreExp
// 候補は "+" でつなぐと組み合わせになる
import { mkdirSync, writeFileSync } from "node:fs";
import { type Bot, passiveBot, smartBot } from "./bots.js";
import { type GameStats, playGame, type Summary, summarize } from "./runner.js";
import { buildRegistry } from "./variants.js";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
}

const BOTS: Record<string, Bot> = {
  smart: smartBot({ buildUnlessThreatAt: null, target: "closest" }, "smart"),
  greedy: smartBot({ buildUnlessThreatAt: null, target: "exp" }, "greedy"),
  builder: smartBot({ buildUnlessThreatAt: 3, target: "closest" }, "builder"),
  passive: passiveBot,
};

const playerCounts = arg("players", "1").split(",").map(Number);
const games = Number(arg("games", "200"));
const botNames = arg("bot", "smart").split(",");
const variants = arg("variants", "base").split(",");
const seed0 = Number(arg("seed", "1"));
const outDir = arg("out", "sim-output");

const rows: Summary[] = [];
const all: GameStats[] = [];
const started = Date.now();
for (const v of variants) {
  const reg = buildRegistry(v.split("+"));
  for (const botName of botNames) {
    const bot = BOTS[botName];
    if (!bot) throw new Error(`未知のボット: ${botName}`);
    for (const n of playerCounts) {
      const list: GameStats[] = [];
      for (let i = 0; i < games; i++) list.push(playGame(reg, bot, seed0 + i, n).stats);
      all.push(...list);
      rows.push(summarize(`${v} / ${botName} / ${n}人`, list));
    }
  }
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const num = (x: number | null) => (x === null ? "-" : x.toFixed(1));
console.table(
  rows.map((r) => ({
    条件: r.label,
    勝率: pct(r.winRate),
    "S/A/B": `${pct(r.rankS)}/${pct(r.rankA)}/${pct(r.rankB)}`,
    "負:耐久/ボス": `${pct(r.lossVillage)}/${pct(r.lossBoss)}`,
    "手番/人": num(r.avgTurnsPerPlayer),
    "撃破/人": num(r.avgKills),
    "経験値/人": num(r.avgExp),
    "転職/人": num(r.avgClassChanges),
    "初転職": num(r.avgFirstClassChangeTurn),
    "Lvアップ/人": num(r.avgLevelUps),
    "Lvアップ有": pct(r.gamesWithLevelUp),
    "初Lvアップ": num(r.avgFirstLevelUpTurn),
    "Lv3到達": pct(r.reachedLv3),
    "ボス出現": num(r.avgBossReveal),
    "ボス挑戦": num(r.avgBossAttacks),
  })),
);
console.log(`${all.length}ゲーム ${((Date.now() - started) / 1000).toFixed(1)}秒（手番・出現は1人あたりの手番数）`);

mkdirSync(outDir, { recursive: true });
const header = Object.keys(all[0]!).join(",");
writeFileSync(`${outDir}/games.csv`, [header, ...all.map((g) => Object.values(g).join(","))].join("\n"));
writeFileSync(`${outDir}/summary.json`, JSON.stringify(rows, null, 2));
