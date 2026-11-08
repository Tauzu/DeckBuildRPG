// ゲーム全体で使う型の定義（設計書 2章）

export type CardId = string;
export type HeroId = string;
/** 村の在庫の束のID。英雄は "hero:knight"、それ以外はカードIDそのもの */
export type StackId = string;
export type Resist = "none" | "half" | "immune";

// ---------------------------------------------------------------------------
// 効果（仕様書 3.6、設計書 2.6）

export type Effect =
  | { kind: "draw"; count: number }
  | { kind: "gold"; amount: number }
  | { kind: "exp"; amount: number }
  | { kind: "trash"; count: number }
  | { kind: "multi"; effects: Effect[] }
  | { kind: "discardHand"; count: number; target: "all" | "next" }
  | { kind: "addCurse"; count: number };

// ---------------------------------------------------------------------------
// カード定義（仕様書 2章）

interface BaseDef {
  id: CardId;
  name: string;
  cost: number | null;
  gold: number;
}

export interface HeroDef extends BaseDef {
  type: "hero";
  heroId: HeroId;
  level: number;
  physical: number;
  magic: number;
  villageEffect: Effect | null;
  nextLevelExp: number | null;
}

export interface WeaponDef extends BaseDef {
  type: "weapon";
  physical: number;
  magic: number;
}

export interface FoodDef extends BaseDef {
  type: "food";
  food: number;
}

export interface EnemyDef extends BaseDef {
  type: "enemy";
  /** ボスは null（人数で決まる。GameConfig.bossHp） */
  hp: number | null;
  resistPhysical: Resist;
  resistMagic: Resist;
  exp: number;
  /** ボスは null */
  invasion: number | null;
  isBoss: boolean;
  onReveal: Effect | null;
  onMarch: Effect | null;
}

export interface CurseDef extends BaseDef {
  type: "curse";
}

export type CardDef = HeroDef | WeaponDef | FoodDef | EnemyDef | CurseDef;

/** ゲーム中の1枚1枚のカード */
export interface CardInstance {
  uid: string;
  defId: CardId;
}

// ---------------------------------------------------------------------------
// 準備用データ（data/setup.json）

export interface PlayerCountSetup {
  villageHp: number;
  bossHp: number;
  enemies: Record<CardId, number>;
}

export interface SetupData {
  handSize: number;
  routeLength: number;
  changeClassExp: number;
  curseStock: number;
  startingDeck: { id: CardId; count: number }[];
  heroStock: { heroIds: HeroId[]; countsByLevel: Record<string, number> };
  itemStock: { id: CardId; count: number }[];
  enemyDeck: { bossId: CardId; bossGroupSize: number; earlyFull: CardId[]; earlyHalf: CardId[] };
  playerCounts: Record<string, PlayerCountSetup>;
}

// ---------------------------------------------------------------------------
// ゲーム状態（設計書 2.2）

export interface GameConfig {
  playerCount: number;
  handSize: number;
  routeLength: number;
  villageHp: number;
  bossHp: number;
  changeClassExp: number;
}

export interface PlayerState {
  id: string;
  name: string;
  deck: CardInstance[];
  hand: CardInstance[];
  field: CardInstance[];
  discard: CardInstance[];
  /** 所持経験値 */
  exp: number;
  /** 総獲得経験値 */
  totalExp: number;
  kills: number;
}

export type Step =
  | { kind: "chooseAction" }
  | { kind: "village" }
  | { kind: "battle" }
  | { kind: "turnEnd" }
  | { kind: "march"; phase: "move" | "onMarch" | "reveal" }
  | { kind: "nextTurn" }
  | { kind: "finished" };

export type TurnState =
  | { action: "village"; foodSlots: number; usedSlots: number; bonusGold: number; spentGold: number }
  | {
      action: "battle";
      targetUid: string;
      foodSlots: number;
      usedSlots: number;
      /** 英雄の uid → 武器の uid */
      equips: Record<string, string>;
    };

export type Pending =
  | { kind: "trash"; playerId: string; max: number }
  | { kind: "discard"; requests: { playerId: string; count: number; done: boolean }[] };

export interface QueuedEffect {
  effect: Effect;
  sourceUid: string;
  /** 効果を使ったプレイヤー。敵の能力なら null */
  ownerId: string | null;
}

export interface VillageState {
  /** 先頭が一番上 */
  stacks: Record<StackId, CardInstance[]>;
  curses: CardInstance[];
}

export type Rank = "S" | "A" | "B" | "C";

export interface GameResult {
  outcome: "win" | "lose";
  reason: "bossDefeated" | "villageDestroyed" | "bossArrived";
  rank: Rank;
  villageHp: number;
  /** 2人以上のときのみ。それ以外は空 */
  mvp: string[];
  /** 2人以上のときのみ。playerId → 称号 */
  titles: Record<string, string>;
}

export interface GameState {
  version: 1;
  seed: number;
  rng: number;
  nextUid: number;
  config: GameConfig;
  players: PlayerState[];
  currentPlayer: number;
  turnCount: number;
  step: Step;
  turn: TurnState | null;
  pending: Pending | null;
  effectQueue: QueuedEffect[];
  village: VillageState;
  /** 先頭が一番上 */
  enemyDeck: CardInstance[];
  /** route[0] が1マス目 */
  route: CardInstance[][];
  villageHp: number;
  /** 廃棄されたカード・集落に着いて取り除かれた敵 */
  trash: CardInstance[];
  result: GameResult | null;
}

// ---------------------------------------------------------------------------
// 操作（仕様書 8.2、設計書 2.9）

export type Action =
  | { type: "chooseVillage" }
  | { type: "chooseBattle"; targetUid: string }
  | { type: "playFood"; uid: string }
  | { type: "playHero"; uid: string }
  | { type: "equip"; weaponUid: string; heroUid: string }
  | { type: "undoBattleCard"; uid: string }
  | { type: "confirmAttack" }
  | { type: "buy"; stackId: StackId }
  | { type: "levelUp"; uid: string }
  | { type: "changeClass"; uid: string; heroId: HeroId }
  | { type: "endVisit" }
  | { type: "resolveTrash"; uids: string[] }
  | { type: "discardForEffect"; uids: string[] };

export type ErrorCode =
  | "GAME_OVER"
  | "NOT_YOUR_TURN"
  | "PENDING_INPUT"
  | "NOT_PENDING"
  | "INVALID_STEP"
  | "CARD_NOT_FOUND"
  | "WRONG_CARD_TYPE"
  | "NO_SLOT"
  | "NOT_ENOUGH_GOLD"
  | "NOT_ENOUGH_EXP"
  | "STOCK_EMPTY"
  | "UNKNOWN_STACK"
  | "NOT_FOR_SALE"
  | "MAX_LEVEL"
  | "ALREADY_EQUIPPED"
  | "NO_ENEMY"
  | "CANNOT_UNDO"
  | "INVALID_SELECTION";

// ---------------------------------------------------------------------------
// イベント（設計書 2.7）

export type GameEvent =
  | { type: "turnStarted"; playerId: string; turnCount: number }
  | { type: "actionChosen"; playerId: string; action: "village" | "battle"; targetUid?: string }
  | { type: "cardPlayed"; playerId: string; uid: string; defId: CardId }
  | { type: "cardReturned"; playerId: string; uid: string; defId: CardId }
  | { type: "weaponEquipped"; playerId: string; heroUid: string; weaponUid: string }
  | { type: "effectResolved"; playerId: string | null; sourceUid: string; effect: Effect }
  | { type: "cardsDrawn"; playerId: string; count: number; uids: string[] }
  | { type: "deckShuffled"; playerId: string }
  | { type: "cardBought"; playerId: string; uid: string; defId: CardId; cost: number }
  | { type: "cardTrashed"; playerId: string; uid: string; defId: CardId }
  | { type: "leveledUp"; playerId: string; fromDefId: CardId; toDefId: CardId; exp: number }
  | {
      type: "attackResolved";
      playerId: string;
      targetUid: string;
      targetDefId: CardId;
      damage: number;
      hp: number;
      defeated: boolean;
    }
  | { type: "expGained"; playerId: string; amount: number }
  | { type: "enemyMoved"; moves: { uid: string; from: number; to: number }[] }
  | { type: "enemyArrived"; uid: string; defId: CardId; damage: number; villageHp: number }
  | { type: "enemyRevealed"; uid: string; defId: CardId }
  | { type: "cardsDiscarded"; playerId: string; uids: string[]; defIds: CardId[] }
  | { type: "curseAdded"; playerId: string; uid: string }
  | { type: "turnEnded"; playerId: string }
  | { type: "gameEnded"; result: GameResult };

export interface EngineResult {
  state: GameState;
  events: GameEvent[];
}

export interface EngineError {
  error: ErrorCode;
  message: string;
}
