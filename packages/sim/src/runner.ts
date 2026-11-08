// ゲームを最後まで自動で進め、集計する
import {
  applyAction,
  type CardRegistry,
  createGame,
  type GameRecord,
  isEngineError,
  newRecord,
} from "@deckbuild/core";
import type { Bot } from "./bots.js";

export interface GameStats {
  seed: number;
  players: number;
  win: boolean;
  rank: string;
  reason: string;
  turns: number;
  villageHp: number;
  kills: number;
  levelUps: number;
  classChanges: number;
  /** 最初のレベルアップ（転職を除く）の手番。なければ null */
  firstLevelUpTurn: number | null;
  /** 最初の転職の手番 */
  firstClassChangeTurn: number | null;
  totalExp: number;
  bossRevealTurn: number | null;
  bossAttacks: number;
  marchSkipped: number;
  maxLevelReached: number;
}

export function playGame(reg: CardRegistry, bot: Bot, seed: number, n: number): { stats: GameStats; record: GameRecord } {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `bot${i + 1}` }));
  let s = createGame({ seed, players }, reg).state;
  const record = newRecord(seed, players, reg);
  const st: GameStats = {
    seed,
    players: n,
    win: false,
    rank: "C",
    reason: "",
    turns: 0,
    villageHp: 0,
    kills: 0,
    levelUps: 0,
    classChanges: 0,
    firstLevelUpTurn: null,
    firstClassChangeTurn: null,
    totalExp: 0,
    bossRevealTurn: null,
    bossAttacks: 0,
    marchSkipped: 0,
    maxLevelReached: 1,
  };

  for (let guard = 0; !s.result; guard++) {
    if (guard > 20000) throw new Error(`seed ${seed}: ゲームが終わりません`);
    // 入力を待っているプレイヤー（入力待ちが優先）
    let actor = s.players[s.currentPlayer]!.id;
    if (s.pending?.kind === "trash") actor = s.pending.playerId;
    if (s.pending?.kind === "discard") actor = s.pending.requests.find((r) => !r.done)!.playerId;

    const action = bot.choose(s, actor, reg);
    const r = applyAction(s, actor, action, reg);
    if (isEngineError(r)) throw new Error(`seed ${seed}: ボットの操作が失敗 ${action.type} ${r.error} ${r.message}`);
    record.actions.push({ playerId: actor, action });
    for (const e of r.events) {
      switch (e.type) {
        case "leveledUp": {
          const from = reg.hero(e.fromDefId);
          const to = reg.hero(e.toDefId);
          st.maxLevelReached = Math.max(st.maxLevelReached, to.level);
          if (from.level === 0) {
            st.classChanges++;
            st.firstClassChangeTurn ??= s.turnCount;
          } else {
            st.levelUps++;
            st.firstLevelUpTurn ??= s.turnCount;
          }
          break;
        }
        case "enemyRevealed":
          if (reg.enemy(e.defId).isBoss) st.bossRevealTurn ??= r.state.turnCount;
          break;
        case "attackResolved":
          if (reg.enemy(e.targetDefId).isBoss) st.bossAttacks++;
          break;
        case "marchSkipped":
          st.marchSkipped++;
          break;
      }
    }
    s = r.state;
  }

  const res = s.result!;
  st.win = res.outcome === "win";
  st.rank = res.rank;
  st.reason = res.reason;
  st.turns = s.turnCount;
  st.villageHp = Math.max(0, s.villageHp);
  st.kills = s.players.reduce((n, p) => n + p.kills, 0);
  st.totalExp = s.players.reduce((n, p) => n + p.totalExp, 0);
  return { stats: st, record };
}

export interface Summary {
  label: string;
  games: number;
  winRate: number;
  rankS: number;
  rankA: number;
  rankB: number;
  lossVillage: number;
  lossBoss: number;
  avgTurns: number;
  avgTurnsPerPlayer: number;
  avgKills: number;
  avgExp: number;
  avgLevelUps: number;
  avgClassChanges: number;
  gamesWithLevelUp: number;
  avgFirstLevelUpTurn: number | null;
  avgFirstClassChangeTurn: number | null;
  reachedLv3: number;
  avgBossReveal: number | null;
  avgBossAttacks: number;
  avgHpLeftOnWin: number | null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const rate = (xs: GameStats[], f: (g: GameStats) => boolean) => xs.filter(f).length / Math.max(1, xs.length);

export function summarize(label: string, games: GameStats[]): Summary {
  const wins = games.filter((g) => g.win);
  return {
    label,
    games: games.length,
    winRate: rate(games, (g) => g.win),
    rankS: rate(games, (g) => g.rank === "S"),
    rankA: rate(games, (g) => g.rank === "A"),
    rankB: rate(games, (g) => g.rank === "B"),
    lossVillage: rate(games, (g) => g.reason === "villageDestroyed"),
    lossBoss: rate(games, (g) => g.reason === "bossArrived"),
    avgTurns: avg(games.map((g) => g.turns)) ?? 0,
    avgTurnsPerPlayer: avg(games.map((g) => g.turns / g.players)) ?? 0,
    avgKills: avg(games.map((g) => g.kills / g.players)) ?? 0,
    avgExp: avg(games.map((g) => g.totalExp / g.players)) ?? 0,
    avgLevelUps: avg(games.map((g) => g.levelUps / g.players)) ?? 0,
    avgClassChanges: avg(games.map((g) => g.classChanges / g.players)) ?? 0,
    gamesWithLevelUp: rate(games, (g) => g.levelUps > 0),
    avgFirstLevelUpTurn: avg(games.flatMap((g) => (g.firstLevelUpTurn === null ? [] : [g.firstLevelUpTurn / g.players]))),
    avgFirstClassChangeTurn: avg(
      games.flatMap((g) => (g.firstClassChangeTurn === null ? [] : [g.firstClassChangeTurn / g.players])),
    ),
    reachedLv3: rate(games, (g) => g.maxLevelReached >= 3),
    avgBossReveal: avg(games.flatMap((g) => (g.bossRevealTurn === null ? [] : [g.bossRevealTurn / g.players]))),
    avgBossAttacks: avg(games.map((g) => g.bossAttacks)) ?? 0,
    avgHpLeftOnWin: avg(wins.map((g) => g.villageHp)),
  };
}
