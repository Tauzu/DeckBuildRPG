// 評価（速さ）の目安を決めるため、勝ったゲームの「1人あたりの手番数」の散らばりを出す
// 使い方: npm run sim:par -- --games 200
import { smartBot } from "./bots.js";
import { playGame } from "./runner.js";
import { buildRegistry } from "./variants.js";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
}

const games = Number(arg("games", "200"));
const reg = buildRegistry(["base"]);
const bot = smartBot({ buildUnlessThreatAt: null, target: "closest" }, "smart");
const pct = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor((xs.length - 1) * p))] ?? NaN;

const rows: Record<string, string | number>[] = [];
for (const stageId of ["tutorial", "stage1", "stage2", "stage3", "stage4", "stage5"]) {
  const stage = reg.stage(stageId);
  for (const n of [1, 2, 3, 4]) {
    if (!stage.playerCounts[String(n)]) continue;
    const wins: number[] = [];
    for (let i = 0; i < games; i++) {
      const g = playGame(reg, bot, 1 + i, n, stageId, 0).stats;
      if (g.win) wins.push(Math.ceil(g.turns / n));
    }
    wins.sort((a, b) => a - b);
    rows.push({ stage: stageId, players: n, wins: wins.length, min: wins[0] ?? NaN, p25: pct(wins, 0.25), p50: pct(wins, 0.5), p75: pct(wins, 0.75), max: wins.at(-1) ?? NaN });
  }
}
console.table(rows);
