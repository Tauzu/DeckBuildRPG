// 自動プレイのボット（設計書 6章）
// 1人で使う前提の道具なので、PlayerView ではなく GameState を直接見る（他人の手札は見ない）
import {
  type Action,
  type CardInstance,
  type CardRegistry,
  calcDamage,
  currentGold,
  type EnemyDef,
  enemyHp,
  type GameState,
  guardedUids,
  heroStackId,
  type PlayerState,
} from "@deckbuild/core";

export interface Bot {
  name: string;
  choose(s: GameState, playerId: string, reg: CardRegistry): Action;
}

export interface SmartOptions {
  /** 倒せる敵がいても、集落の手前（このマス以上）に敵がいなければ育成を優先する。null なら常に戦う */
  buildUnlessThreatAt: number | null;
  /** 狙う敵：集落に近い敵 / 経験値の多い敵 */
  target: "closest" | "exp";
}

// ---------------------------------------------------------------------------
// 評価の道具

function factor(r: EnemyDef["resistPhysical"]): number {
  return r === "immune" ? 0 : r === "half" ? 0.5 : 1;
}

function attackOf(reg: CardRegistry, c: CardInstance) {
  const d = reg.get(c.defId);
  if (d.type === "hero") return { physical: d.physical, magic: d.magic };
  if (d.type === "weapon") {
    // レベルで伸びる武器は Lv1 の英雄が持つとして見積もる
    const ab = d.ability;
    const pl = ab?.kind === "perLevel" ? ab : { physical: 0, magic: 0 };
    return { physical: d.physical + pl.physical, magic: d.magic + pl.magic, pierce: ab?.kind === "pierce" };
  }
  return { physical: 0, magic: 0 };
}

function isSolo(reg: CardRegistry, c: CardInstance): boolean {
  const d = reg.get(c.defId);
  return d.type === "weapon" && d.ability?.kind === "solo";
}

function valueAgainst(reg: CardRegistry, c: CardInstance, e: EnemyDef): number {
  const a = attackOf(reg, c);
  if ("pierce" in a && a.pierce) return a.physical + a.magic;
  return a.physical * factor(e.resistPhysical) + a.magic * factor(e.resistMagic);
}

function foodOf(reg: CardRegistry, c: CardInstance): number {
  const d = reg.get(c.defId);
  return d.type === "food" ? d.food : 0;
}

/** 手札だけで出せる最大ダメージの見込み（貪欲法） */
export function maxDamage(reg: CardRegistry, hand: CardInstance[], e: EnemyDef, freeSlots = 0): number {
  const slots = hand.reduce((n, c) => n + foodOf(reg, c), freeSlots);
  const heroes = hand
    .filter((c) => reg.get(c.defId).type === "hero")
    .sort((a, b) => valueAgainst(reg, b, e) - valueAgainst(reg, a, e))
    .slice(0, slots);
  const solo = hand.filter((c) => isSolo(reg, c));
  const weapons = hand
    .filter((c) => reg.get(c.defId).type === "weapon" && !isSolo(reg, c))
    .sort((a, b) => valueAgainst(reg, b, e) - valueAgainst(reg, a, e))
    .slice(0, heroes.length);
  return calcDamage([...heroes, ...weapons, ...solo].map((c) => attackOf(reg, c)), e).total;
}

/** デッキ全体（山札・手札・場・捨て札）の構成 */
function deckStats(reg: CardRegistry, p: PlayerState) {
  const all = [...p.deck, ...p.hand, ...p.field, ...p.discard];
  let heroes = 0;
  let food = 0;
  let weapons = 0;
  let physical = 0;
  let magic = 0;
  const heroIds: Record<string, number> = {};
  for (const c of all) {
    const d = reg.get(c.defId);
    if (d.type === "hero") {
      heroes++;
      physical += d.physical;
      magic += d.magic;
      heroIds[d.heroId] = (heroIds[d.heroId] ?? 0) + 1;
    } else if (d.type === "food") food += d.food;
    else if (d.type === "weapon") {
      weapons++;
      physical += d.physical;
      magic += d.magic;
    }
  }
  return { heroes, food, weapons, physical, magic, heroIds, size: all.length };
}

/** 捨てる・廃棄するときに価値が低い順 */
function junkScore(reg: CardRegistry, c: CardInstance): number {
  const d = reg.get(c.defId);
  if (d.type === "curse") return 0;
  if (d.type === "enemy") return 1 + d.gold;
  if (d.id === "weapon_club") return 5;
  if (d.type === "hero" && d.level === 0) return 6;
  if (d.id === "food_bread") return 7;
  return 10 + (d.cost ?? 0);
}

// ---------------------------------------------------------------------------
// 賢いボット

export function smartBot(opts: SmartOptions, name = "smart"): Bot {
  return {
    name,
    choose(s, playerId, reg) {
      const p = s.players.find((x) => x.id === playerId)!;

      // 入力待ち
      if (s.pending?.kind === "discard") {
        const req = s.pending.requests.find((r) => r.playerId === playerId && !r.done)!;
        const uids = [...p.hand].sort((a, b) => junkScore(reg, a) - junkScore(reg, b)).slice(0, req.count).map((c) => c.uid);
        return { type: "discardForEffect", uids };
      }
      if (s.pending?.kind === "target") {
        // 集落に一番近い敵を選ぶ（凍結も後退も、いちばん危ない敵に使う）
        const pend = s.pending;
        const slotOf = (uid: string) => s.route.findIndex((sq) => sq.some((c) => c.uid === uid));
        const uid = [...pend.uids].sort((a, b) => slotOf(b) - slotOf(a))[0]!;
        return { type: "chooseTarget", targetUid: uid };
      }
      if (s.pending?.kind === "trash") {
        // 捨て札から、ゴミ（呪い・金にならない敵カード・若者）を優先して廃棄する。手札は金が減るので触らない
        const max = s.pending.max;
        const uids = [...p.discard]
          .filter((c) => junkScore(reg, c) <= 7)
          .sort((a, b) => junkScore(reg, a) - junkScore(reg, b))
          .slice(0, max)
          .map((c) => c.uid);
        return { type: "resolveTrash", uids };
      }

      switch (s.step.kind) {
        case "chooseAction":
          return chooseAction(s, p, reg, opts);
        case "village":
          return villageStep(s, p, reg);
        case "battle":
          return battleStep(s, p, reg);
        case "afterBattle":
          return afterBattleStep(s, p, reg);
        default:
          throw new Error(`ボットが操作できない段階です: ${s.step.kind}`);
      }
    },
  };
}

function chooseAction(s: GameState, p: PlayerState, reg: CardRegistry, opts: SmartOptions): Action {
  const guarded = guardedUids(s, reg);
  let best: { uid: string; score: number } | null = null;
  s.route.forEach((square, i) => {
    for (const c of square) {
      if (guarded.has(c.uid)) continue;
      const e = reg.enemy(c.defId);
      if ((s.enemyDamage[c.uid] ?? 0) + maxDamage(reg, p.hand, e, s.config.freeHeroSlots) < enemyHp(s, e)) continue;
      const score = opts.target === "closest" ? i * 100 + e.exp : e.exp * 100 + i;
      if (!best || score > best.score) best = { uid: c.uid, score };
    }
  });
  const found = best as { uid: string; score: number } | null;
  if (found) {
    if (opts.buildUnlessThreatAt !== null) {
      const threat = s.route.some((sq, i) => i >= opts.buildUnlessThreatAt! && sq.length > 0);
      const boss = s.route.flat().some((c) => reg.enemy(c.defId).isBoss);
      if (!threat && !boss) return { type: "chooseVillage" };
    }
    return { type: "chooseBattle", targetUid: found.uid };
  }
  // ダメージが残るルールなら、倒せなくても削りに行く
  const mode = s.config.persistentDamage;
  if (mode !== "none") {
    let chip: { uid: string; score: number } | null = null;
    s.route.forEach((square, i) => {
      for (const c of square) {
        if (guarded.has(c.uid)) continue;
        const e = reg.enemy(c.defId);
        if (mode === "boss" && !e.isBoss) continue;
        if (!e.isBoss && i < 3) continue;
        const dmg = maxDamage(reg, p.hand, e, s.config.freeHeroSlots);
        if (dmg < Math.min(4, enemyHp(s, e))) continue;
        const score = (e.isBoss ? 1000 : 0) + i * 10 + dmg;
        if (!chip || score > chip.score) chip = { uid: c.uid, score };
      }
    });
    const found2 = chip as { uid: string; score: number } | null;
    if (found2) return { type: "chooseBattle", targetUid: found2.uid };
  }
  return { type: "chooseVillage" };
}

function villageStep(s: GameState, p: PlayerState, reg: CardRegistry): Action {
  const turn = s.turn;
  if (turn?.action !== "village") throw new Error("訪問中ではありません");

  // 1. レベルアップ（高いレベルから）
  const levelable = p.hand
    .filter((c) => reg.get(c.defId).type === "hero")
    .map((c) => ({ c, d: reg.hero(c.defId) }))
    .filter(({ d }) => d.level > 0 && d.nextLevelExp !== null && p.exp >= d.nextLevelExp)
    .filter(({ d }) => (s.village.stacks[heroStackId(d.heroId)] ?? []).some((x) => reg.hero(x.defId).level === d.level + 1))
    .sort((a, b) => b.d.level - a.d.level);
  const gold = currentGold(s, reg);
  for (const { c, d } of levelable) {
    if (gold - d.gold >= 0) return { type: "levelUp", uid: c.uid };
  }

  // 2. 転職
  const youth = p.hand.find((c) => reg.get(c.defId).type === "hero" && reg.hero(c.defId).level === 0);
  if (youth && p.exp >= s.config.changeClassExp && gold - reg.get(youth.defId).gold >= 0) {
    const heroId = pickHeroId(s, p, reg);
    if (heroId) return { type: "changeClass", uid: youth.uid, heroId };
  }

  // 3. 村効果を持つ英雄を出す（食料が足りなければ先に食料）
  const effectHeroes = p.hand.filter((c) => {
    const d = reg.get(c.defId);
    return d.type === "hero" && d.villageEffect !== null;
  });
  if (effectHeroes.length > 0) {
    if (turn.usedSlots < turn.foodSlots + s.config.freeHeroSlots) {
      const order = ["draw", "multi", "gold", "trash", "exp", "freeze", "push"];
      const next = [...effectHeroes].sort(
        (a, b) => order.indexOf(reg.hero(a.defId).villageEffect!.kind) - order.indexOf(reg.hero(b.defId).villageEffect!.kind),
      )[0]!;
      return { type: "playHero", uid: next.uid };
    }
    const food = p.hand.find((c) => reg.get(c.defId).type === "food");
    if (food) return { type: "playFood", uid: food.uid };
  }

  // 4. 購入
  const buy = pickPurchase(s, p, reg, gold);
  if (buy) return { type: "buy", stackId: buy };

  return { type: "endVisit" };
}

/** 撃破直後：場と手札の英雄を、レベルの高い順にレベルアップ。次に若者の転職 */
function afterBattleStep(s: GameState, p: PlayerState, reg: CardRegistry): Action {
  const heroes = [...p.field, ...p.hand].filter((c) => reg.get(c.defId).type === "hero");
  const levelable = heroes
    .map((c) => ({ c, d: reg.hero(c.defId) }))
    .filter(({ d }) => d.level > 0 && d.nextLevelExp !== null && p.exp >= d.nextLevelExp)
    .filter(({ d }) => (s.village.stacks[heroStackId(d.heroId)] ?? []).some((x) => reg.hero(x.defId).level === d.level + 1))
    .sort((a, b) => b.d.level - a.d.level);
  if (levelable[0]) return { type: "levelUp", uid: levelable[0].c.uid };
  const youth = heroes.find((c) => reg.hero(c.defId).level === 0);
  if (youth && p.exp >= s.config.changeClassExp) {
    const heroId = pickHeroId(s, p, reg);
    if (heroId) return { type: "changeClass", uid: youth.uid, heroId };
  }
  return { type: "finishBattle" };
}

function pickHeroId(s: GameState, p: PlayerState, reg: CardRegistry): string | null {
  const st = deckStats(reg, p);
  const available = (id: string) => (s.village.stacks[heroStackId(id)] ?? []).some((c) => reg.hero(c.defId).level === 1);
  const order = st.magic < st.physical ? ["mage", "hunter", "knight"] : ["knight", "hunter", "mage"];
  return order.find(available) ?? s.config.heroIds.find(available) ?? null;
}

function pickPurchase(s: GameState, p: PlayerState, reg: CardRegistry, gold: number): string | null {
  const st = deckStats(reg, p);
  const top = (stackId: string) => s.village.stacks[stackId]?.[0];
  const affordable = (stackId: string) => {
    const t = top(stackId);
    return t && (reg.get(t.defId).cost ?? Infinity) <= gold ? stackId : null;
  };
  const first = (...ids: string[]) => ids.map(affordable).find((x) => x !== null) ?? null;

  // 弱いカード（黒パン・木の棍棒・葡萄酒）は買わない。デッキが薄まるため
  const needFood = st.food < st.heroes;
  const magicFirst = st.magic < st.physical * 0.6;
  const heroOrder = () => {
    const support = (st.heroIds["thief"] ?? 0) + (st.heroIds["bard"] ?? 0) + (st.heroIds["priest"] ?? 0) + (st.heroIds["frost"] ?? 0);
    const attack = magicFirst ? ["mage", "hunter", "knight"] : ["knight", "hunter", "mage"];
    return (support * 4 < st.heroes ? ["bard", "priest", "frost", ...attack] : attack).map(heroStackId);
  };
  const bigWeapon = magicFirst
    ? ["weapon_tome", "weapon_mithril", "weapon_amulet", "weapon_sage", "weapon_axe", "weapon_hammer"]
    : ["weapon_axe", "weapon_mithril", "weapon_hammer", "weapon_tome", "weapon_amulet"];
  const smallWeapon = magicFirst
    ? ["weapon_frost", "weapon_staff", "weapon_bow", "weapon_sword", "weapon_javelin"]
    : ["weapon_sword", "weapon_bow", "weapon_javelin", "weapon_staff", "weapon_frost"];

  if (needFood) return first("food_feast", "food_jerky");
  if (gold >= 5 && st.weapons * 2 < st.heroes) return first(...bigWeapon, ...heroOrder());
  if (gold >= 4) return first(...heroOrder(), ...bigWeapon);
  if (gold >= 3 && st.weapons * 2 < st.heroes) return first(...smallWeapon);
  if (gold >= 3 && st.food < st.heroes + 2) return first("food_jerky");
  return null;
}

function battleStep(s: GameState, p: PlayerState, reg: CardRegistry): Action {
  const turn = s.turn;
  if (turn?.action !== "battle") throw new Error("戦闘中ではありません");
  const target = s.route.flat().find((c) => c.uid === turn.targetUid)!;
  const e = reg.enemy(target.defId);

  const food = p.hand.find((c) => reg.get(c.defId).type === "food");
  if (food) return { type: "playFood", uid: food.uid };

  if (turn.usedSlots < turn.foodSlots + s.config.freeHeroSlots) {
    const hero = p.hand
      .filter((c) => reg.get(c.defId).type === "hero")
      .sort((a, b) => valueAgainst(reg, b, e) - valueAgainst(reg, a, e))[0];
    if (hero) return { type: "playHero", uid: hero.uid };
  }

  const solo = p.hand.find((c) => isSolo(reg, c) && valueAgainst(reg, c, e) > 0);
  if (solo) return { type: "useWeapon", weaponUid: solo.uid };
  const unequipped = p.field.filter((c) => reg.get(c.defId).type === "hero" && !turn.equips[c.uid]);
  const weapon = p.hand
    .filter((c) => reg.get(c.defId).type === "weapon" && !isSolo(reg, c))
    .sort((a, b) => valueAgainst(reg, b, e) - valueAgainst(reg, a, e))[0];
  if (weapon && unequipped[0] && valueAgainst(reg, weapon, e) > 0) {
    return { type: "equip", weaponUid: weapon.uid, heroUid: unequipped[0].uid };
  }
  return { type: "confirmAttack" };
}

// ---------------------------------------------------------------------------
// 何もしないボット（比較用）：毎手番、集落を訪れて買えるものを買うだけ

export const passiveBot: Bot = {
  name: "passive",
  choose(s, playerId, reg) {
    const bot = smartBot({ buildUnlessThreatAt: 99, target: "closest" });
    if (s.step.kind === "chooseAction" && !s.pending) return { type: "chooseVillage" };
    return bot.choose(s, playerId, reg);
  },
};
