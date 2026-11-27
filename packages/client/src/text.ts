// 画面の文言（設計書 4.3：文言は1か所にまとめる）。言葉そのものは locales/ にあり、ここは組み立てだけ
import type { CardDef, CardRegistry, DangerDef, Effect, EnemyTrait, ErrorCode, GameEvent, PlayerView, Resist, StageDef, WeaponAbility, WeaponAffinity } from "@deckbuild/core";
import { getLang, joinList, t, td } from "./i18n.js";

export function errorText(code: ErrorCode): string {
  return t(`error.${code}`, { guard: td("card.enemy_frost_guard", "氷の盾兵") });
}

/** 名前を locales に持っている英雄 */
const HERO_IDS = ["knight", "mage", "hunter", "priest", "thief", "bard", "militia", "frost", "youth"] as const;
type KnownHero = (typeof HERO_IDS)[number];
function isKnownHero(id: string): id is KnownHero {
  return (HERO_IDS as readonly string[]).includes(id);
}

export function heroName(heroId: string): string {
  return isKnownHero(heroId) ? t(`hero.${heroId}`) : heroId;
}

/** カードの名前（レベルは付けない） */
export function cardName(def: CardDef): string {
  if (def.type === "hero") return isKnownHero(def.heroId) ? heroName(def.heroId) : def.name;
  return td(`card.${def.id}`, def.name);
}

export function stageName(st: StageDef): string {
  return td(`stage.${st.id}.name`, st.name);
}

export function stageDescription(st: StageDef): string {
  return td(`stage.${st.id}.desc`, st.description);
}

export function dangerText(d: DangerDef): string {
  return td(`danger.${d.level}`, d.text);
}

function statParts(b: { physical: number; magic: number }): string {
  return [b.physical > 0 && t("stat.physical", { n: b.physical }), b.magic > 0 && t("stat.magic", { n: b.magic })]
    .filter((s): s is string => !!s)
    .join(t("list.dot"));
}

/** 武器の能力の説明 */
export function describeWeaponAbility(a: WeaponAbility): string {
  switch (a.kind) {
    case "pierce":
      return t("weapon.pierce");
    case "perLevel":
      return t("weapon.perLevel", { parts: statParts(a) });
    case "defeatExp":
      return t("weapon.defeatExp", { n: a.amount });
    case "solo":
      return t("weapon.solo");
    case "chill":
      return t("weapon.chill");
  }
}

/** 武器の得意英雄の説明 */
export function affinityText(a: WeaponAffinity): string {
  return t("weapon.affinity", { heroes: a.heroes.map(heroName).join(t("list.dot")), parts: statParts(a) });
}

/** 英雄の「群れ」ボーナスの説明 */
export function packText(b: { physical: number; magic: number }, name: string): string {
  return t("hero.pack", { name, parts: statParts(b) });
}

/** 敵の特性の説明 */
export function describeTrait(tr: EnemyTrait): string {
  return t(`trait.${tr}`);
}

export function describeEffect(e: Effect): string {
  switch (e.kind) {
    case "draw":
      return t("effect.draw", { n: e.count });
    case "drawPack":
      return t("effect.drawPack");
    case "gold":
      return t("effect.gold", { n: e.amount });
    case "exp":
      return t("effect.exp", { n: e.amount });
    case "trash":
      return t("effect.trash", { n: e.count });
    case "multi":
      return joinList(e.effects.map(describeEffect));
    case "discardHand":
      return t(e.target === "all" ? "effect.discardAll" : "effect.discardRandom", { n: e.count });
    case "addCurse":
      return t("effect.addCurse", { n: e.count });
    case "freeze":
      return t("effect.freeze", { n: e.count });
    case "push":
      return t("effect.push", { n: e.count });
    case "rally":
      return t("effect.rally");
  }
}

export function resistText(r: Resist): string | null {
  return r === "half" ? t("resist.half") : r === "immune" ? t("resist.immune") : null;
}

/** カードの見出し（英雄はレベルを付ける） */
export function cardTitle(def: CardDef): string {
  if (def.type === "hero" && def.level > 0) return t("card.level", { name: cardName(def), n: def.level });
  return cardName(def);
}

/** ログ用：画面から見える uid → カードID の対応 */
export function buildLookup(view: PlayerView): Map<string, string> {
  const m = new Map<string, string>();
  const add = (c: { uid: string; defId: string } | null | undefined) => {
    if (c) m.set(c.uid, c.defId);
  };
  for (const p of view.players) {
    p.hand?.forEach(add);
    p.discard?.forEach(add);
    p.field.forEach(add);
    add(p.discardTop);
  }
  view.route.flat().forEach(add);
  for (const st of Object.values(view.village.stacks)) add(st.top);
  return m;
}

export function eventText(
  e: GameEvent,
  reg: CardRegistry,
  lookup: Map<string, string>,
  playerName: (id: string) => string,
): string | null {
  const name = (defId: string | undefined) => (defId ? cardTitle(reg.get(defId)) : t("unknown"));
  const byUid = (uid: string) => name(lookup.get(uid));
  switch (e.type) {
    case "turnStarted":
      return t("log.turnStarted", { n: e.turnCount, player: playerName(e.playerId) });
    case "actionChosen":
      return e.action === "village" ? t("log.village") : t("log.challenge", { target: byUid(e.targetUid ?? "") });
    case "actionCanceled":
      return t("log.canceled");
    case "marchSkipped":
      return t("log.marchSkipped");
    case "cardPlayed":
      return t("log.played", { card: name(e.defId) });
    case "cardReturned":
      return t("log.returned", { card: name(e.defId) });
    case "weaponEquipped":
      return t("log.equipped", { hero: byUid(e.heroUid), weapon: byUid(e.weaponUid) });
    case "cardBought":
      return t("log.bought", { card: name(e.defId), cost: e.cost });
    case "lootSold":
      return t("log.lootSold", { cards: joinList(e.defIds.map(name)) });
    case "cardTrashed":
      return t("log.trashed", { card: name(e.defId) });
    case "leveledUp": {
      const from = reg.hero(e.fromDefId);
      return t(from.level === 0 ? "log.classChange" : "log.levelUp", { from: name(e.fromDefId), to: name(e.toDefId), n: e.exp });
    }
    case "attackResolved": {
      const sum = e.prevDamage > 0 ? t("log.attackTotal", { total: e.prevDamage + e.damage, hp: e.hp }) : t("log.attackHp", { hp: e.hp });
      const boss = reg.enemy(e.targetDefId).isBoss;
      const rest =
        boss && !e.defeated && e.damage > 0
          ? t("log.attackBossLeft", { n: e.hp - e.prevDamage - e.damage })
          : t(e.defeated ? "log.attackDefeated" : "log.attackFailed");
      return t("log.attack", { target: name(e.targetDefId), n: e.damage, sum, rest });
    }
    case "expGained":
      return t("effect.exp", { n: e.amount });
    case "enemyRevealed": {
      const d = reg.enemy(e.defId);
      return d.onReveal ? t("log.revealedAbility", { enemy: cardName(d), text: describeEffect(d.onReveal) }) : t("log.revealed", { enemy: cardName(d) });
    }
    case "enemyArrived": {
      const d = reg.enemy(e.defId);
      return d.isBoss ? t("log.bossArrived", { enemy: cardName(d) }) : t("log.enemyArrived", { enemy: cardName(d), n: e.damage, hp: e.villageHp });
    }
    case "enemyFrozen":
      return t("log.frozen", { card: name(e.defId) });
    case "enemyPushed":
      return t("log.pushed", { card: name(e.defId), from: e.from + 1, to: e.to + 1 });
    case "enemySplit":
      return t("log.split", { card: name(e.defId) });
    case "cardsDiscarded":
      return t("log.discarded", { player: playerName(e.playerId), cards: joinList(e.defIds.map(name)) });
    case "curseAdded":
      return t("log.curse", { player: playerName(e.playerId) });
    case "deckShuffled":
      return t("log.shuffled");
    case "gameEnded":
      return t(e.result.outcome === "win" ? "log.win" : "log.lose");
    case "effectResolved": {
      if (e.playerId !== null) return null;
      const src = lookup.get(e.sourceUid);
      if (!src) return null;
      const d = reg.get(src);
      if (d.type === "enemy" && d.isBoss && e.effect.kind === "discardHand" && e.effect.target === "random") {
        return t("log.intimidate", { enemy: cardName(d), text: describeEffect(e.effect) });
      }
      if (d.type === "enemy" && e.effect.kind === "rally") return t("log.rally", { enemy: cardName(d), text: describeEffect(e.effect) });
      return null;
    }
    case "cardsDrawn":
    case "turnEnded":
    case "enemyMoved":
      return null;
  }
}

/** 結果の説明。boss はそのステージのボスの名前 */
export function resultReason(reason: string, boss: string): string {
  switch (reason) {
    case "bossDefeated":
      return t("result.bossDefeated", { boss });
    case "villageDestroyed":
      return t("result.villageDestroyed");
    case "bossArrived":
      return t("result.bossArrived", { boss });
    default:
      return "";
  }
}

/** 結果の称号（core が日本語で付ける） */
export function rankTitle(ja: string): string {
  return td(`rankTitle.${ja}`, ja);
}

/** タッチ操作の端末では「クリック」を「タップ」と言い換える */
export function touchText(s: string): string {
  const touch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
  if (!touch) return s;
  return getLang() === "ja" ? s.replaceAll("クリック", "タップ") : s.replace(/\bclick/g, "tap").replace(/\bClick/g, "Tap");
}

/** 英雄が戦闘中に出したときの効果の説明（なければ null） */
export function battleEffectText(e: Effect | null): string | null {
  return e ? describeEffect(e) : null;
}
