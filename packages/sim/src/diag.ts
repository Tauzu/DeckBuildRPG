// 手番ごとの「手札で出せる最大ダメージ」とデッキの状態を調べる
//   npx tsx src/diag.ts --variants base --games 200
import { applyAction, createGame, isEngineError } from "@deckbuild/core";
import { maxDamage, smartBot } from "./bots.js";
import { buildRegistry } from "./variants.js";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
}

const reg = buildRegistry(arg("variants", "base").split("+"));
const games = Number(arg("games", "200"));
const bot = smartBot({ buildUnlessThreatAt: null, target: "closest" });
const plain = { ...reg.enemy("enemy_orc"), resistPhysical: "none" as const, resistMagic: "none" as const };

type Row = { dmg: number[]; deck: number[]; heroes: number[]; route: number[]; hp: number[]; exp: number[]; junk: number[] };
const byTurn = new Map<number, Row>();
for (let seed = 1; seed <= games; seed++) {
  let s = createGame({ seed, players: [{ id: "p1", name: "bot" }] }, reg).state;
  while (!s.result) {
    if (s.step.kind === "chooseAction" && !s.pending) {
      const p = s.players[0]!;
      const all = [...p.deck, ...p.hand, ...p.discard];
      const row = byTurn.get(s.turnCount) ?? { dmg: [], deck: [], heroes: [], route: [], hp: [], exp: [], junk: [] };
      row.dmg.push(maxDamage(reg, p.hand, plain));
      row.deck.push(all.length);
      row.heroes.push(all.filter((c) => reg.get(c.defId).type === "hero").length);
      row.junk.push(all.filter((c) => ["enemy", "curse"].includes(reg.get(c.defId).type)).length);
      row.route.push(s.route.flat().length);
      row.hp.push(s.villageHp);
      row.exp.push(p.exp);
      byTurn.set(s.turnCount, row);
    }
    const actor = s.pending?.kind === "discard" ? s.pending.requests.find((r) => !r.done)!.playerId : "p1";
    const r = applyAction(s, actor, bot.choose(s, actor, reg), reg);
    if (isEngineError(r)) throw new Error(r.message);
    s = r.state;
  }
}
const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
console.table(
  [...byTurn.entries()]
    .filter(([t]) => t % 2 === 1 && t <= 41)
    .map(([t, r]) => ({
      手番: t,
      残りゲーム: r.dmg.length,
      最大ダメージ: avg(r.dmg),
      デッキ枚数: avg(r.deck),
      英雄: avg(r.heroes),
      戦利品と呪い: avg(r.junk),
      ルートの敵: avg(r.route),
      耐久値: avg(r.hp),
      所持経験値: avg(r.exp),
    })),
);
