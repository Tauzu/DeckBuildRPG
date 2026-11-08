// ゲームの準備（仕様書 4章）
import { freeze } from "immer";
import { type Ctx, drawCards, heroStackId, newCard } from "./context.js";
import type { CardRegistry } from "./data/registry.js";
import { shuffleInPlace } from "./rng.js";
import type { CardInstance, EngineResult, GameState, PlayerState } from "./types.js";

export interface CreateGameParams {
  seed: number;
  players: { id: string; name: string }[];
}

export function createGame(params: CreateGameParams, reg: CardRegistry): EngineResult {
  const { players } = params;
  if (players.length < 1 || players.length > 4) throw new Error("プレイ人数は1～4人です");
  if (new Set(players.map((p) => p.id)).size !== players.length) throw new Error("プレイヤーIDが重複しています");

  const setup = reg.setup;
  const pc = setup.playerCounts[String(players.length)];
  if (!pc) throw new Error(`${players.length}人用の設定がありません`);

  const s: GameState = {
    version: 1,
    seed: params.seed,
    rng: params.seed | 0,
    nextUid: 1,
    config: {
      playerCount: players.length,
      handSize: setup.handSize,
      routeLength: setup.routeLength,
      villageHp: pc.villageHp,
      bossHp: pc.bossHp,
      changeClassExp: setup.changeClassExp,
      persistentDamage: setup.persistentDamage ?? "none",
      lootToDeck: setup.lootToDeck ?? true,
      sellLoot: setup.sellLoot ?? false,
      freeHeroSlots: setup.freeHeroSlots ?? 0,
      levelUpAfterBattle: setup.levelUpAfterBattle ?? false,
    },
    players: [],
    currentPlayer: 0,
    turnCount: 1,
    step: { kind: "chooseAction" },
    turn: null,
    pending: null,
    effectQueue: [],
    village: { stacks: {}, curses: [] },
    enemyDeck: [],
    route: Array.from({ length: setup.routeLength }, () => []),
    villageHp: pc.villageHp,
    trash: [],
    enemyDamage: {},
    result: null,
  };
  const ctx: Ctx = { s, reg, events: [] };

  // 村の在庫
  for (const heroId of setup.heroStock.heroIds) {
    const stack: CardInstance[] = [];
    for (const def of reg.heroLevels(heroId)) {
      const count = setup.heroStock.countsByLevel[String(def.level)] ?? 0;
      for (let i = 0; i < count; i++) stack.push(newCard(s, def.id));
    }
    s.village.stacks[heroStackId(heroId)] = stack;
  }
  for (const item of setup.itemStock) {
    s.village.stacks[item.id] = Array.from({ length: item.count }, () => newCard(s, item.id));
  }
  s.village.curses = Array.from({ length: setup.curseStock }, () => newCard(s, reg.curseId));

  // 敵の山札（仕様書 4.1）
  const early: CardInstance[] = [];
  const late: CardInstance[] = [];
  for (const [id, count] of Object.entries(pc.enemies)) {
    const earlyCount = setup.enemyDeck.earlyFull.includes(id)
      ? count
      : setup.enemyDeck.earlyHalf.includes(id)
        ? Math.floor(count / 2)
        : 0;
    for (let i = 0; i < count; i++) (i < earlyCount ? early : late).push(newCard(s, id));
  }
  shuffleInPlace(s, early);
  shuffleInPlace(s, late);
  const bossGroup = late.splice(0, setup.enemyDeck.bossGroupSize - 1);
  bossGroup.push(newCard(s, setup.enemyDeck.bossId));
  shuffleInPlace(s, bossGroup);
  s.enemyDeck = [...early, ...late, ...bossGroup];

  // プレイヤー
  for (const info of players) {
    const p: PlayerState = {
      id: info.id,
      name: info.name,
      deck: [],
      hand: [],
      field: [],
      discard: [],
      exp: 0,
      totalExp: 0,
      kills: 0,
    };
    for (const e of setup.startingDeck) for (let i = 0; i < e.count; i++) p.deck.push(newCard(s, e.id));
    shuffleInPlace(s, p.deck);
    s.players.push(p);
    drawCards(ctx, p, setup.handSize);
  }

  ctx.events.push({ type: "turnStarted", playerId: players[0]!.id, turnCount: 1 });
  return { state: freeze(s, true), events: ctx.events };
}
