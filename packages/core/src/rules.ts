// 状態を変えずに値を計算する関数（設計書 2.8）
import type { CardRegistry } from "./data/registry.js";
import type { EnemyDef, GameState, HeroDef, PlayerState, Resist, WeaponDef } from "./types.js";

/** 今の所持金（仕様書 5.2）。訪問中以外は 0 */
export function currentGold(s: GameState, reg: CardRegistry): number {
  if (s.turn?.action !== "village") return 0;
  const p = s.players[s.currentPlayer];
  if (!p) return 0;
  return cardsGold(p, reg) + s.turn.bonusGold - s.turn.spentGold;
}

/** 手札と場のカードの金価値の合計 */
export function cardsGold(p: PlayerState, reg: CardRegistry): number {
  let sum = 0;
  for (const c of p.hand) sum += reg.get(c.defId).gold;
  for (const c of p.field) sum += reg.get(c.defId).gold;
  return sum;
}

/** 英雄を出せる枠 */
export function heroSlots(s: GameState): { total: number; used: number; left: number } {
  if (!s.turn) return { total: 0, used: 0, left: 0 };
  const { foodSlots, usedSlots } = s.turn;
  const total = foodSlots + s.config.freeHeroSlots;
  return { total, used: usedSlots, left: total - usedSlots };
}

export function enemyHp(s: GameState, def: EnemyDef): number {
  return def.isBoss ? s.config.bossHp : (def.hp ?? 0);
}

export interface DamageBreakdown {
  physical: number;
  magic: number;
  physicalAfter: number;
  magicAfter: number;
  total: number;
}

function applyResist(value: number, resist: Resist): number {
  if (resist === "immune") return 0;
  if (resist === "half") return Math.floor(value / 2);
  return value;
}

/** 攻撃に加わる1人（または英雄なしの武器1枚）の攻撃力。pierce なら耐性を受けない */
export interface Attacker {
  physical: number;
  magic: number;
  pierce?: boolean;
}

/** ダメージの計算（仕様書 5.3.1）。耐性は、耐性を受ける攻撃の合計にかける */
export function calcDamage(attackers: Attacker[], target: Pick<EnemyDef, "resistPhysical" | "resistMagic">): DamageBreakdown {
  let physical = 0;
  let magic = 0;
  let piercePhysical = 0;
  let pierceMagic = 0;
  for (const a of attackers) {
    if (a.pierce) {
      piercePhysical += a.physical;
      pierceMagic += a.magic;
    } else {
      physical += a.physical;
      magic += a.magic;
    }
  }
  const physicalAfter = applyResist(physical, target.resistPhysical) + piercePhysical;
  const magicAfter = applyResist(magic, target.resistMagic) + pierceMagic;
  return {
    physical: physical + piercePhysical,
    magic: magic + pierceMagic,
    physicalAfter,
    magicAfter,
    total: physicalAfter + magicAfter,
  };
}

/** 英雄が武器を装備したときの攻撃力（武器の能力を含む） */
export function equippedAttack(hero: HeroDef, weapon: WeaponDef | null): Attacker {
  let physical = hero.physical;
  let magic = hero.magic;
  let pierce = false;
  if (weapon) {
    physical += weapon.physical;
    magic += weapon.magic;
    const ab = weapon.ability;
    if (ab?.kind === "perLevel") {
      physical += ab.physical * hero.level;
      magic += ab.magic * hero.level;
    }
    if (ab?.kind === "pierce") pierce = true;
  }
  return { physical, magic, pierce };
}

/** 戦闘中の場の英雄と武器から攻撃力の一覧を作る。装備していない武器は、英雄なしで使える武器だけが加わる */
export function battleAttackers(s: GameState, reg: CardRegistry): Attacker[] {
  if (s.turn?.action !== "battle") return [];
  const p = s.players[s.currentPlayer];
  if (!p) return [];
  const turn = s.turn;
  const equipped = new Set(Object.values(turn.equips));
  const list: Attacker[] = [];
  for (const c of p.field) {
    const d = reg.get(c.defId);
    if (d.type === "hero") {
      const weaponUid = turn.equips[c.uid];
      const w = weaponUid ? p.field.find((x) => x.uid === weaponUid) : undefined;
      list.push(equippedAttack(d, w ? reg.weapon(w.defId) : null));
    } else if (d.type === "weapon" && !equipped.has(c.uid) && d.ability?.kind === "solo") {
      list.push({ physical: d.physical, magic: d.magic });
    }
  }
  return list;
}

/** 撃破したときに増える経験値（武器の defeatExp）。場で使われている武器だけ数える */
export function bonusExpOnDefeat(s: GameState, reg: CardRegistry): number {
  if (s.turn?.action !== "battle") return 0;
  const p = s.players[s.currentPlayer];
  if (!p) return 0;
  let sum = 0;
  for (const c of p.field) {
    const d = reg.get(c.defId);
    if (d.type === "weapon" && d.ability?.kind === "defeatExp") sum += d.ability.amount;
  }
  return sum;
}

/** 戦闘中のダメージの見込み。戦闘中でなければ null */
export function battlePreview(
  s: GameState,
  reg: CardRegistry,
): (DamageBreakdown & { hp: number; prevDamage: number }) | null {
  if (s.turn?.action !== "battle") return null;
  const targetUid = s.turn.targetUid;
  const target = s.route.flat().find((c) => c.uid === targetUid);
  if (!target) return null;
  const def = reg.enemy(target.defId);
  return { ...calcDamage(battleAttackers(s, reg), def), hp: enemyHp(s, def), prevDamage: s.enemyDamage[targetUid] ?? 0 };
}
