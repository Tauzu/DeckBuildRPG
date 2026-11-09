// バランス調整の候補（カードデータを書き換えた版）
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type CardRegistry, createRegistry, type RawData } from "@deckbuild/core";

const dataDir = fileURLToPath(new URL("../../../data/", import.meta.url));

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
interface Data {
  heroes: Json[];
  items: Json[];
  enemies: Json[];
  setup: Json;
}

export function loadData(): Data {
  const read = (f: string) => JSON.parse(readFileSync(dataDir + f, "utf8")) as Json;
  return { heroes: read("heroes.json"), items: read("items.json"), enemies: read("enemies.json"), setup: read("setup.json") };
}

/** 候補の名前 → データの書き換え */
export const VARIANTS: Record<string, (d: Data) => void> = {
  base: () => {},

  // --- レベルアップを早める候補 ---
  /** 必要経験値を下げる（Lv1→2: 3→2、Lv2→3: 5→4） */
  cheapLv: (d) => {
    for (const h of d.heroes) {
      if (h.level === 1) h.nextLevelExp = 2;
      if (h.level === 2) h.nextLevelExp = 4;
    }
  },
  /** 必要経験値をさらに下げる（2 / 3） */
  cheaperLv: (d) => {
    for (const h of d.heroes) {
      if (h.level === 1) h.nextLevelExp = 2;
      if (h.level === 2) h.nextLevelExp = 3;
    }
  },
  /** 転職を経験値1に */
  cheapClass: (d) => {
    d.setup.changeClassExp = 1;
  },
  /** ボス以外の敵の経験値 +1 */
  moreExp: (d) => {
    for (const e of d.enemies) if (!e.isBoss) e.exp += 1;
  },
  /** 序盤の敵（ゴブリン・狼）の経験値を 2 に */
  earlyExp: (d) => {
    for (const e of d.enemies) if (e.id === "enemy_goblin" || e.id === "enemy_wolf") e.exp = 2;
  },

  // --- 手札の強さ ---
  hand6: (d) => {
    d.setup.handSize = 6;
  },
  hand7: (d) => {
    d.setup.handSize = 7;
  },
  /** 食料の食糧値 +1（黒パン2・干し肉3・葡萄酒2・祝宴4） */
  food1: (d) => {
    for (const i of d.items) if (i.type === "food") i.food += 1;
  },
  /** 黒パンだけ食糧値2 */
  bread2: (d) => {
    for (const i of d.items) if (i.id === "food_bread") i.food = 2;
  },

  // --- 敵の強さ ---
  /** ボスの生命力を下げる（1人15、以降+4） */
  bossLow: (d) => {
    for (const [n, pc] of Object.entries(d.setup.playerCounts) as [string, Json][]) pc.bossHp = 15 + (Number(n) - 1) * 4;
  },
  /** ボスの生命力を少し下げる（1人20、以降+5） */
  bossMid: (d) => {
    for (const [n, pc] of Object.entries(d.setup.playerCounts) as [string, Json][]) pc.bossHp = 20 + (Number(n) - 1) * 5;
  },
  /** ボス以外の敵の生命力 -1 */
  enemyHp1: (d) => {
    for (const e of d.enemies) if (!e.isBoss) e.hp -= 1;
  },
  /** ボスに与えたダメージが残る */
  dmgBoss: (d) => {
    d.setup.persistentDamage = "boss";
  },
  /** すべての敵に与えたダメージが残る */
  dmgAll: (d) => {
    d.setup.persistentDamage = "all";
  },
  /** ボスの生命力を大きく下げる（1人10、以降+3） */
  bossTiny: (d) => {
    for (const [n, pc] of Object.entries(d.setup.playerCounts) as [string, Json][]) pc.bossHp = 10 + (Number(n) - 1) * 3;
  },
  /** 倒した敵をデッキに入れない */
  noLoot: (d) => {
    d.setup.lootToDeck = false;
  },
  /** 英雄の攻撃力を上げる（主な攻撃力 +1） */
  heroPow: (d) => {
    for (const h of d.heroes) {
      if (h.level === 0) continue;
      if (h.physical >= h.magic) h.physical += 1;
      else h.magic += 1;
    }
  },
  /** 戦利品は集落で売却される（手札にあれば訪問の終わりに取り除く） */
  sell: (d) => {
    d.setup.sellLoot = true;
  },
  /** 戦利品の金価値 +1 */
  lootGold: (d) => {
    for (const e of d.enemies) if (!e.isBoss) e.gold += 1;
  },
  /** ボスの生命力 +5 */
  bossUp: (d) => {
    for (const pc of Object.values(d.setup.playerCounts) as Json[]) pc.bossHp += 5;
  },
  /** ボスの生命力 +10 */
  bossUp2: (d) => {
    for (const pc of Object.values(d.setup.playerCounts) as Json[]) pc.bossHp += 10;
  },
  /** 食料なしでも英雄を1人出せる */
  free1: (d) => {
    d.setup.freeHeroSlots = 1;
  },
  /** 吟遊詩人 Lv1 の村効果を2枚ドローに */
  bard2: (d) => {
    for (const h of d.heroes) if (h.id === "hero_bard_1") h.villageEffect = { kind: "draw", count: 2 };
  },
  /** 敵を撃破した直後にもレベルアップ・転職できる */
  lvBattle: (d) => {
    d.setup.levelUpAfterBattle = true;
  },
  /** 手札5枚に戻す */
  hand5: (d) => {
    d.setup.handSize = 5;
  },
  /** 敵の進軍を1ラウンドに1回（撃破で進軍をやめる条件は marchSkip） */
  round: (d) => {
    d.setup.marchTiming = "round";
  },
  /** ラウンドの全員が撃破したときだけ進軍しない */
  skipAll: (d) => {
    d.setup.marchSkip = "all";
  },
  /** 撃破しても進軍する */
  skipNone: (d) => {
    d.setup.marchSkip = "none";
  },
  /** 集落の耐久値 +5 */
  village5: (d) => {
    for (const pc of Object.values(d.setup.playerCounts) as Json[]) pc.villageHp += 5;
  },
};

export function buildRegistry(names: string[]): CardRegistry {
  const d = loadData();
  for (const n of names) {
    const f = VARIANTS[n] ?? perCount(n);
    if (!f) throw new Error(`未知の候補: ${n}（${Object.keys(VARIANTS).join(", ")}）`);
    f(d);
  }
  return createRegistry(d as RawData);
}

/** 人数ごとの数値を直接指定する候補。例：bossHp_35_60_80_100、villageHp_15_10_10_10（1／2／3／4人） */
function perCount(name: string): ((d: Data) => void) | undefined {
  const m = /^(bossHp|villageHp)_(\d+)_(\d+)_(\d+)_(\d+)$/.exec(name);
  if (!m) return undefined;
  const key = m[1]!;
  const values = m.slice(2).map(Number);
  return (d) => {
    for (const [n, pc] of Object.entries(d.setup.playerCounts) as [string, Json][]) pc[key] = values[Number(n) - 1];
  };
}
