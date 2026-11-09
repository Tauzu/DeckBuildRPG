// カード定義の一覧（設計書 2.1、3.2）
import type {
  CardDef,
  CardId,
  EnemyDef,
  FoodDef,
  HeroDef,
  HeroId,
  SetupData,
  StageDef,
  WeaponDef,
} from "../types.js";
import { enemiesFileSchema, heroesFileSchema, itemsFileSchema, setupFileSchema, stagesFileSchema } from "./schema.js";

export interface RawData {
  heroes: unknown;
  items: unknown;
  enemies: unknown;
  setup: unknown;
  stages: unknown;
}

export class DataError extends Error {
  constructor(public readonly problems: string[]) {
    super(`カードデータに問題があります:\n- ${problems.join("\n- ")}`);
    this.name = "DataError";
  }
}

export class CardRegistry {
  private readonly defs = new Map<CardId, CardDef>();
  private readonly heroes = new Map<HeroId, HeroDef[]>();
  readonly curseId: CardId;
  readonly hash: string;

  constructor(
    defs: CardDef[],
    readonly setup: SetupData,
    /** ステージ（ファイルに書かれた順。チュートリアル → ステージ1 → …） */
    readonly stages: StageDef[],
  ) {
    for (const d of defs) this.defs.set(d.id, d);
    for (const d of defs) {
      if (d.type !== "hero") continue;
      const list = this.heroes.get(d.heroId) ?? [];
      list.push(d);
      this.heroes.set(d.heroId, list);
    }
    for (const list of this.heroes.values()) list.sort((a, b) => a.level - b.level);
    const curse = defs.find((d) => d.type === "curse");
    this.curseId = curse?.id ?? "curse";
    this.hash = fnv1a(JSON.stringify({ defs, setup, stages }));
  }

  /** ステージの定義。見つからなければ例外 */
  stage(id: string): StageDef {
    const st = this.stages.find((x) => x.id === id);
    if (!st) throw new Error(`未定義のステージ: ${id}`);
    return st;
  }

  /** ステージを指定しないときに使うステージ（最後のステージ＝すべてのカードが登場する） */
  get defaultStageId(): string {
    return this.stages[this.stages.length - 1]!.id;
  }

  has(id: CardId): boolean {
    return this.defs.has(id);
  }

  get(id: CardId): CardDef {
    const d = this.defs.get(id);
    if (!d) throw new Error(`未定義のカードID: ${id}`);
    return d;
  }

  hero(id: CardId): HeroDef {
    const d = this.get(id);
    if (d.type !== "hero") throw new Error(`英雄カードではありません: ${id}`);
    return d;
  }

  enemy(id: CardId): EnemyDef {
    const d = this.get(id);
    if (d.type !== "enemy") throw new Error(`敵カードではありません: ${id}`);
    return d;
  }

  weapon(id: CardId): WeaponDef {
    const d = this.get(id);
    if (d.type !== "weapon") throw new Error(`武器カードではありません: ${id}`);
    return d;
  }

  food(id: CardId): FoodDef {
    const d = this.get(id);
    if (d.type !== "food") throw new Error(`食料カードではありません: ${id}`);
    return d;
  }

  /** その英雄の全レベルの定義（Lv順） */
  heroLevels(heroId: HeroId): HeroDef[] {
    return this.heroes.get(heroId) ?? [];
  }

  all(): CardDef[] {
    return [...this.defs.values()];
  }
}

/** JSONを検証して CardRegistry を作る。問題があれば DataError を投げる */
export function createRegistry(raw: RawData): CardRegistry {
  const problems: string[] = [];
  const parse = <T>(label: string, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown): T | null => {
    const r = schema.safeParse(value);
    if (r.success) return r.data;
    for (const issue of r.error.issues) problems.push(`${label}: ${issue.path.map(String).join(".")} ${issue.message}`);
    return null;
  };

  const heroes = parse("heroes.json", heroesFileSchema, raw.heroes);
  const items = parse("items.json", itemsFileSchema, raw.items);
  const enemies = parse("enemies.json", enemiesFileSchema, raw.enemies);
  const setup = parse("setup.json", setupFileSchema, raw.setup) as SetupData | null;
  const stages = parse("stages.json", stagesFileSchema, raw.stages) as StageDef[] | null;
  if (!heroes || !items || !enemies || !setup || !stages) throw new DataError(problems);

  const defs: CardDef[] = [...heroes, ...items, ...enemies];
  problems.push(...checkConsistency(defs, setup, stages));
  if (problems.length > 0) throw new DataError(problems);
  return new CardRegistry(defs, setup, stages);
}

/** データ同士の整合性チェック（設計書 3.2） */
function checkConsistency(defs: CardDef[], setup: SetupData, stages: StageDef[]): string[] {
  const problems: string[] = [];
  const byId = new Map<CardId, CardDef>();
  for (const d of defs) {
    if (byId.has(d.id)) problems.push(`カードIDが重複しています: ${d.id}`);
    byId.set(d.id, d);
  }
  const need = (id: CardId, where: string) => {
    if (!byId.has(id)) problems.push(`${where} で未定義のカードIDが使われています: ${id}`);
  };

  for (const e of setup.startingDeck) need(e.id, "startingDeck");
  for (const e of setup.itemStock) {
    need(e.id, "itemStock");
    const d = byId.get(e.id);
    if (d && d.cost === null) problems.push(`itemStock のカードにコストがありません: ${e.id}`);
  }

  // 英雄：Lv1から順にそろっているか、在庫のレベルが定義されているか
  const levels = Object.keys(setup.heroStock.countsByLevel).map(Number);
  const heroIds = [...new Set(stages.flatMap((st) => st.heroIds))];
  for (const heroId of heroIds) {
    const list = defs.filter((d): d is HeroDef => d.type === "hero" && d.heroId === heroId).sort((a, b) => a.level - b.level);
    if (list.length === 0) {
      problems.push(`英雄が定義されていません: ${heroId}`);
      continue;
    }
    list.forEach((h, i) => {
      if (h.level !== i + 1) problems.push(`英雄 ${heroId} のレベルが Lv1 から順にそろっていません`);
      if (h.cost === null) problems.push(`在庫の英雄にコストがありません: ${h.id}`);
      const isMax = i === list.length - 1;
      if (isMax !== (h.nextLevelExp === null)) problems.push(`英雄 ${h.id} の nextLevelExp が最大レベルと合っていません`);
    });
    for (const lv of levels) {
      if (!list.some((h) => h.level === lv)) problems.push(`英雄 ${heroId} に Lv${lv} がありません`);
    }
  }

  for (const d of defs) {
    if (d.type !== "enemy") continue;
    if (!d.isBoss && (d.hp === null || d.invasion === null)) problems.push(`ボス以外の敵には hp と invasion が必要です: ${d.id}`);
  }

  // 呪い
  if (!defs.some((d) => d.type === "curse")) problems.push("呪いカードが定義されていません");

  // ステージ
  const stageIds = new Set<string>();
  for (const st of stages) {
    const at = `stages.${st.id}`;
    if (stageIds.has(st.id)) problems.push(`ステージIDが重複しています: ${st.id}`);
    stageIds.add(st.id);
    const boss = byId.get(st.bossId);
    if (!boss || boss.type !== "enemy" || !boss.isBoss) problems.push(`${at}.bossId がボスではありません: ${st.bossId}`);
    for (const id of st.items) {
      need(id, `${at}.items`);
      if (!setup.itemStock.some((e) => e.id === id)) problems.push(`${at}.items のカードが itemStock にありません: ${id}`);
    }
    for (const id of [...st.earlyFull, ...st.earlyHalf]) need(id, at);
    const counts = Object.entries(st.playerCounts);
    if (counts.length === 0) problems.push(`${at} に遊べる人数の設定がありません`);
    for (const [n, pc] of counts) {
      if (!pc) continue;
      let total = 0;
      for (const [id, count] of Object.entries(pc.enemies)) {
        need(id, `${at}.playerCounts.${n}.enemies`);
        const d = byId.get(id);
        if (d && (d.type !== "enemy" || d.isBoss)) problems.push(`${at}.playerCounts.${n}.enemies にボス以外の敵ではないカードがあります: ${id}`);
        total += count;
      }
      if (total < setup.enemyDeck.bossGroupSize - 1) problems.push(`${at} の ${n}人 の敵の枚数が少なすぎます`);
    }
  }

  return problems;
}

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
