// ゲームの準備（仕様書 4章）
import { freeze } from "immer";
import { type Ctx, drawCards, heroStackId, newCard } from "./context.js";
import type { CardRegistry } from "./data/registry.js";
import { shuffleInPlace } from "./rng.js";
import type { CardInstance, EngineResult, GameState, PlayerState } from "./types.js";

export interface CreateGameParams {
  seed: number;
  players: { id: string; name: string }[];
  /** 省略すると最後のステージ（すべてのカードが登場する） */
  stageId?: string;
  /** 危険度（省略すると 0＝通常） */
  danger?: number;
  /** 手番の順番をランダムに決める（ゲーム中は固定）。省略すると渡した順のまま */
  shuffleOrder?: boolean;
}

/** 危険度で敵を減らしても、ボスの束より前に残す敵の数 */
const MIN_ENEMIES_BEFORE_BOSS = 3;

export function createGame(params: CreateGameParams, reg: CardRegistry): EngineResult {
  const players = [...params.players];
  if (players.length < 1 || players.length > 4) throw new Error("プレイ人数は1～4人です");
  if (new Set(players.map((p) => p.id)).size !== players.length) throw new Error("プレイヤーIDが重複しています");

  const setup = reg.setup;
  const stage = reg.stage(params.stageId ?? reg.defaultStageId);
  const pc = stage.playerCounts[String(players.length)];
  if (!pc) throw new Error(`ステージ「${stage.name}」は${players.length}人では遊べません`);
  const danger = params.danger ?? 0;
  if (!Number.isInteger(danger) || danger < 0 || danger > reg.maxDanger) throw new Error(`危険度は 0～${reg.maxDanger} です`);
  if (danger > 0 && stage.tutorial) throw new Error("チュートリアルには危険度がありません");
  const mod = reg.dangerModifiers(danger);
  const villageHp = Math.max(1, pc.villageHp + mod.villageHp);
  const handSize = Math.max(1, setup.handSize + mod.handSize);

  const s: GameState = {
    version: 1,
    seed: params.seed,
    rng: params.seed | 0,
    nextUid: 1,
    config: {
      stageId: stage.id,
      danger,
      enemyHpBonus: mod.enemyHp,
      heroIds: [...stage.heroIds],
      playerCount: players.length,
      handSize,
      routeLength: setup.routeLength,
      villageHp,
      bossHp: Math.round((pc.bossHp * (100 + mod.bossHpPct)) / 100),
      changeClassExp: setup.changeClassExp,
      persistentDamage: setup.persistentDamage ?? "none",
      lootToDeck: setup.lootToDeck ?? true,
      sellLoot: setup.sellLoot ?? false,
      freeHeroSlots: setup.freeHeroSlots ?? 0,
      levelUpAfterBattle: setup.levelUpAfterBattle ?? false,
      marchTiming: setup.marchTiming ?? "turn",
      marchSkip: setup.marchSkip ?? "any",
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
    villageHp,
    trash: [],
    enemyDamage: {},
    roundDefeats: 0,
    result: null,
  };
  const ctx: Ctx = { s, reg, events: [] };

  // 村の在庫
  for (const heroId of stage.heroIds) {
    const stack: CardInstance[] = [];
    for (const def of reg.heroLevels(heroId)) {
      const count = setup.heroStock.countsByLevel[String(def.level)] ?? 0;
      for (let i = 0; i < count; i++) stack.push(newCard(s, def.id));
    }
    s.village.stacks[heroStackId(heroId)] = stack;
  }
  for (const item of setup.itemStock.filter((e) => stage.items.includes(e.id))) {
    s.village.stacks[item.id] = Array.from({ length: item.count }, () => newCard(s, item.id));
  }
  s.village.curses = Array.from({ length: setup.curseStock }, () => newCard(s, reg.curseId));

  // 敵の山札（仕様書 4.1）
  const early: CardInstance[] = [];
  const late: CardInstance[] = [];
  for (const [id, count] of Object.entries(pc.enemies)) {
    const earlyCount = stage.earlyFull.includes(id)
      ? count
      : stage.earlyHalf.includes(id)
        ? Math.floor(count / 2)
        : 0;
    for (let i = 0; i < count; i++) (i < earlyCount ? early : late).push(newCard(s, id));
  }
  shuffleInPlace(s, early);
  shuffleInPlace(s, late);
  const bossGroup = late.splice(0, setup.enemyDeck.bossGroupSize - 1);
  bossGroup.push(newCard(s, stage.bossId));
  shuffleInPlace(s, bossGroup);
  // 危険度：ボスの束の直前の敵を減らし、ボスを早く出す（序盤の敵は少し残す）
  const before = [...early, ...late];
  before.splice(before.length - Math.min(mod.enemyDeckTrim, Math.max(0, before.length - MIN_ENEMIES_BEFORE_BOSS)));
  s.enemyDeck = [...before, ...bossGroup];

  // 手番の順番（ゲーム中は固定）
  if (params.shuffleOrder) shuffleInPlace(s, players);

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
    for (let i = 0; i < mod.startCurses; i++) p.deck.push(newCard(s, reg.curseId));
    shuffleInPlace(s, p.deck);
    s.players.push(p);
    drawCards(ctx, p, handSize);
  }

  ctx.events.push({ type: "turnStarted", playerId: players[0]!.id, turnCount: 1 });
  return { state: freeze(s, true), events: ctx.events };
}
