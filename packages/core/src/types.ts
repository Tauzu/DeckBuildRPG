// ゲーム全体で使う型の定義（設計書 2章）

export type CardId = string;
export type HeroId = string;
/** 村の在庫の束のID。英雄は "hero:knight"、それ以外はカードIDそのもの */
export type StackId = string;
export type Resist = "none" | "half" | "immune";
export type PersistentDamage = "none" | "boss" | "all";

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

/** 武器の特殊能力（仕様書 3.2） */
export type WeaponAbility =
  /** 装備した英雄の攻撃は耐性を受けない */
  | { kind: "pierce" }
  /** 装備した英雄のレベル1つにつき攻撃力が増える */
  | { kind: "perLevel"; physical: number; magic: number }
  /** この武器で戦って撃破すると経験値が増える */
  | { kind: "defeatExp"; amount: number }
  /** 英雄がいなくても、武器だけで攻撃に加われる */
  | { kind: "solo" };

export interface WeaponDef extends BaseDef {
  type: "weapon";
  physical: number;
  magic: number;
  ability: WeaponAbility | null;
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
  /** 敵に与えたダメージを次の手番に残すか（none：残らない／boss：ボスだけ残る／all：すべて残る） */
  persistentDamage?: PersistentDamage;
  /** 倒した敵を捨て札に加えるか（false なら取り除く。調整用） */
  lootToDeck?: boolean;
  /** 集落を訪れた手番の終わりに、手札の敵カード（戦利品）を売却して取り除くか */
  sellLoot?: boolean;
  /** 食料なしで出せる英雄の数（毎手番） */
  freeHeroSlots?: number;
  /** 敵を撃破した直後に、戦った英雄や手札の英雄をレベルアップ・転職できるか */
  levelUpAfterBattle?: boolean;
  /** 敵が進軍する時機（turn：1人の手番ごと／round：全員の手番が終わるごと） */
  marchTiming?: MarchTiming;
  /** 進軍をやめる条件（any：その回に誰かが撃破した／all：その回の全員が撃破した／none：やめない） */
  marchSkip?: MarchSkip;
  curseStock: number;
  startingDeck: { id: CardId; count: number }[];
  /** 英雄在庫のレベルごとの枚数（登場する英雄はステージで決まる） */
  heroStock: { countsByLevel: Record<string, number> };
  /** 食料・武器の在庫の枚数（登場するカードはステージで決まる） */
  itemStock: { id: CardId; count: number }[];
  enemyDeck: { bossGroupSize: number };
}

// ---------------------------------------------------------------------------
// ステージ（data/stages.json。企画書 12章）

export interface StageDef {
  id: string;
  name: string;
  description: string;
  /** チュートリアル（画面に案内を出す） */
  tutorial?: boolean;
  /** 毎回同じ展開にするときのシード値（チュートリアル） */
  fixedSeed?: number;
  /** 進軍ルートの背景の種類（画面の art/backdrops.ts） */
  backdrop?: string;
  /** 登場する英雄 */
  heroIds: HeroId[];
  /** 村で買える食料・武器（枚数は setup.json の itemStock） */
  items: CardId[];
  bossId: CardId;
  /** 序盤の束にすべて入れる敵 */
  earlyFull: CardId[];
  /** 序盤の束に半分入れる敵 */
  earlyHalf: CardId[];
  /** 遊べる人数ごとの設定（書かれていない人数では遊べない） */
  playerCounts: Record<string, PlayerCountSetup>;
}

// ---------------------------------------------------------------------------
// 危険度（data/dangers.json。企画書 13章）

/** 危険度の1段階で足される不利な条件。危険度 N では 1～N の段階の条件をすべて足し合わせる */
export interface DangerModifiers {
  /** ボスの生命力を増やす割合（%） */
  bossHpPct?: number;
  /** 集落の耐久値の増減 */
  villageHp?: number;
  /** ボス以外の敵の生命力の増減 */
  enemyHp?: number;
  /** 最初の山札に入る呪いの枚数 */
  startCurses?: number;
  /** 敵の山札（ボスより前）から取り除く枚数。ボスが早く現れる */
  enemyDeckTrim?: number;
  /** 手札の枚数の増減 */
  handSize?: number;
}

export interface DangerDef {
  level: number;
  /** 画面に出す説明（この段階で足される条件） */
  text: string;
  add: DangerModifiers;
}

// ---------------------------------------------------------------------------
// ゲーム状態（設計書 2.2）

export interface GameConfig {
  stageId: string;
  /** 危険度（0 は通常） */
  danger: number;
  /** ボス以外の敵の生命力の増減（危険度） */
  enemyHpBonus: number;
  /** このステージに登場する英雄（転職先） */
  heroIds: HeroId[];
  playerCount: number;
  handSize: number;
  routeLength: number;
  villageHp: number;
  bossHp: number;
  changeClassExp: number;
  persistentDamage: PersistentDamage;
  lootToDeck: boolean;
  sellLoot: boolean;
  freeHeroSlots: number;
  levelUpAfterBattle: boolean;
  marchTiming: MarchTiming;
  marchSkip: MarchSkip;
}

export type MarchTiming = "turn" | "round";
export type MarchSkip = "any" | "all" | "none";

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
  /** 敵を撃破した直後のレベルアップ（config.levelUpAfterBattle） */
  | { kind: "afterBattle" }
  /** defeated：この手番に敵を撃破したか（進軍をやめるかの判定に使う。仕様書 5.4） */
  | { kind: "turnEnd"; defeated: boolean }
  | { kind: "march"; phase: "move" | "onMarch" | "reveal" }
  | { kind: "nextTurn" }
  | { kind: "finished" };

export type TurnState =
  | {
      action: "village";
      foodSlots: number;
      usedSlots: number;
      bonusGold: number;
      spentGold: number;
      /** 取り消せない操作（カードを出す・購入・レベルアップ・転職）をしたか */
      acted: boolean;
    }
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
  /** 敵に残っているダメージ（uid → ダメージ）。config.persistentDamage が none なら常に空 */
  enemyDamage: Record<string, number>;
  /** 今の進軍の回（ラウンド）で、敵を撃破した手番の数 */
  roundDefeats: number;
  result: GameResult | null;
}

// ---------------------------------------------------------------------------
// 操作（仕様書 8.2、設計書 2.9）

export type Action =
  | { type: "chooseVillage" }
  | { type: "chooseBattle"; targetUid: string }
  | { type: "cancelAction" }
  | { type: "playFood"; uid: string }
  | { type: "playHero"; uid: string }
  | { type: "equip"; weaponUid: string; heroUid: string }
  /** 英雄なしで使える武器（solo）を、装備せずに場に出す */
  | { type: "useWeapon"; weaponUid: string }
  | { type: "undoBattleCard"; uid: string }
  | { type: "confirmAttack" }
  | { type: "buy"; stackId: StackId }
  | { type: "levelUp"; uid: string }
  | { type: "changeClass"; uid: string; heroId: HeroId }
  | { type: "endVisit" }
  | { type: "finishBattle" }
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
  | "CANNOT_CANCEL"
  | "INVALID_SELECTION";

// ---------------------------------------------------------------------------
// イベント（設計書 2.7）

export type GameEvent =
  | { type: "turnStarted"; playerId: string; turnCount: number }
  | { type: "actionChosen"; playerId: string; action: "village" | "battle"; targetUid?: string }
  | { type: "actionCanceled"; playerId: string }
  | { type: "marchSkipped"; playerId: string }
  | { type: "cardPlayed"; playerId: string; uid: string; defId: CardId }
  | { type: "cardReturned"; playerId: string; uid: string; defId: CardId }
  | { type: "weaponEquipped"; playerId: string; heroUid: string; weaponUid: string }
  | { type: "effectResolved"; playerId: string | null; sourceUid: string; effect: Effect }
  | { type: "cardsDrawn"; playerId: string; count: number; uids: string[] }
  | { type: "deckShuffled"; playerId: string }
  | { type: "cardBought"; playerId: string; uid: string; defId: CardId; cost: number }
  | { type: "cardTrashed"; playerId: string; uid: string; defId: CardId }
  | { type: "lootSold"; playerId: string; uids: string[]; defIds: CardId[] }
  | { type: "leveledUp"; playerId: string; fromDefId: CardId; toDefId: CardId; exp: number }
  | {
      type: "attackResolved";
      playerId: string;
      targetUid: string;
      targetDefId: CardId;
      damage: number;
      /** 攻撃前に残っていたダメージ */
      prevDamage: number;
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
