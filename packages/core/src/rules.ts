// 状態を変えずに値を計算する関数（設計書 2.8）
import type { CardRegistry } from "./data/registry.js";
import type { EnemyDef, GameState, PlayerState, Resist } from "./types.js";

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
  return { total: foodSlots, used: usedSlots, left: foodSlots - usedSlots };
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

/** ダメージの計算（仕様書 5.3.1） */
export function calcDamage(
  attackers: { physical: number; magic: number }[],
  target: Pick<EnemyDef, "resistPhysical" | "resistMagic">,
): DamageBreakdown {
  let physical = 0;
  let magic = 0;
  for (const a of attackers) {
    physical += a.physical;
    magic += a.magic;
  }
  const physicalAfter = applyResist(physical, target.resistPhysical);
  const magicAfter = applyResist(magic, target.resistMagic);
  return { physical, magic, physicalAfter, magicAfter, total: physicalAfter + magicAfter };
}

/** 戦闘中の場の英雄と武器から攻撃力の一覧を作る */
export function battleAttackers(s: GameState, reg: CardRegistry): { physical: number; magic: number }[] {
  if (s.turn?.action !== "battle") return [];
  const p = s.players[s.currentPlayer];
  if (!p) return [];
  const turn = s.turn;
  const list: { physical: number; magic: number }[] = [];
  for (const c of p.field) {
    const d = reg.get(c.defId);
    if (d.type !== "hero") continue;
    let physical = d.physical;
    let magic = d.magic;
    const weaponUid = turn.equips[c.uid];
    if (weaponUid) {
      const w = p.field.find((x) => x.uid === weaponUid);
      if (w) {
        const wd = reg.weapon(w.defId);
        physical += wd.physical;
        magic += wd.magic;
      }
    }
    list.push({ physical, magic });
  }
  return list;
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
