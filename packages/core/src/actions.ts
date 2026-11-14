// 操作ごとの処理（仕様書 5.2・5.3・5.5）
import {
  assertUnique,
  type Ctx,
  currentPlayer,
  fail,
  findCard,
  forgetEnemy,
  heroStackId,
  newCard,
  playerById,
  takeCard,
} from "./context.js";
import { enqueueEffect } from "./effects.js";
import { endGame } from "./flow.js";
import { battleAttackers, bonusExpOnDefeat, calcDamage, cardsGold, enemyHp, guardedUids, hasChill } from "./rules.js";
import type { Action, CardInstance, Effect, PlayerState } from "./types.js";

export function dispatch(ctx: Ctx, playerId: string, action: Action): void {
  const s = ctx.s;
  if (s.result) fail("GAME_OVER", "ゲームは終了しています");

  // 入力待ちへの回答
  if (action.type === "resolveTrash") return resolveTrash(ctx, playerId, action.uids);
  if (action.type === "discardForEffect") return discardForEffect(ctx, playerId, action.uids);
  if (action.type === "chooseTarget") return chooseTarget(ctx, playerId, action.targetUid);
  if (s.pending) fail("PENDING_INPUT", "入力待ちの選択があります");

  if (currentPlayer(s).id !== playerId) fail("NOT_YOUR_TURN", "手番ではありません");

  switch (action.type) {
    case "chooseVillage":
      return chooseVillage(ctx);
    case "chooseBattle":
      return chooseBattle(ctx, action.targetUid);
    case "cancelAction":
      return cancelAction(ctx);
    case "playFood":
      return playFood(ctx, action.uid);
    case "playHero":
      return playHero(ctx, action.uid);
    case "equip":
      return equip(ctx, action.weaponUid, action.heroUid);
    case "useWeapon":
      return useWeapon(ctx, action.weaponUid);
    case "undoBattleCard":
      return undoBattleCard(ctx, action.uid);
    case "confirmAttack":
      return confirmAttack(ctx);
    case "buy":
      return buy(ctx, action.stackId);
    case "levelUp":
      return levelUp(ctx, action.uid);
    case "changeClass":
      return changeClass(ctx, action.uid, action.heroId);
    case "endVisit":
      return endVisit(ctx);
    case "finishBattle":
      return finishBattle(ctx);
  }
}

// ---------------------------------------------------------------------------
// 共通

function requireStep(ctx: Ctx, ...kinds: ("chooseAction" | "village" | "battle" | "afterBattle")[]): void {
  if (!kinds.includes(ctx.s.step.kind as never)) fail("INVALID_STEP", "今はその操作はできません");
}

function handCard(p: PlayerState, uid: string): CardInstance {
  const c = findCard(p.hand, uid);
  if (!c) fail("CARD_NOT_FOUND", "手札にそのカードがありません");
  return c;
}

/** 手札・場から金価値 lost の分のカードが減っても、所持金が0未満にならないか */
function requireGoldAfterLoss(ctx: Ctx, lost: number): void {
  const s = ctx.s;
  if (s.turn?.action !== "village") return;
  const p = currentPlayer(s);
  const after = cardsGold(p, ctx.reg) - lost + s.turn.bonusGold - s.turn.spentGold;
  if (after < 0) fail("NOT_ENOUGH_GOLD", "使った金が足りなくなるため、そのカードは減らせません");
}

// ---------------------------------------------------------------------------
// 行動の選択（仕様書 5.1）

function chooseVillage(ctx: Ctx): void {
  requireStep(ctx, "chooseAction");
  const s = ctx.s;
  s.turn = { action: "village", foodSlots: 0, usedSlots: 0, bonusGold: 0, spentGold: 0, acted: false };
  s.step = { kind: "village" };
  ctx.events.push({ type: "actionChosen", playerId: currentPlayer(s).id, action: "village" });
}

function chooseBattle(ctx: Ctx, targetUid: string): void {
  requireStep(ctx, "chooseAction");
  const s = ctx.s;
  if (s.route.every((sq) => sq.length === 0)) fail("NO_ENEMY", "進軍ルートに敵がいません");
  if (!s.route.some((sq) => sq.some((c) => c.uid === targetUid))) fail("CARD_NOT_FOUND", "その敵は進軍ルートにいません");
  if (guardedUids(s, ctx.reg).has(targetUid)) fail("GUARDED", "護衛に守られているため、先に護衛を倒す必要があります");
  s.turn = { action: "battle", targetUid, foodSlots: 0, usedSlots: 0, equips: {} };
  s.step = { kind: "battle" };
  ctx.events.push({ type: "actionChosen", playerId: currentPlayer(s).id, action: "battle", targetUid });
}

/** 選んだ行動を取り消して、行動の選択に戻る */
function cancelAction(ctx: Ctx): void {
  requireStep(ctx, "village", "battle");
  const s = ctx.s;
  const p = currentPlayer(s);
  const turn = s.turn;
  if (turn?.action === "village" && turn.acted) fail("CANNOT_CANCEL", "すでに集落で行動したため取り消せません");
  if (turn?.action === "battle" && turn.drewUids?.length) fail("CANNOT_CANCEL", "戦闘中にカードを引いたため選び直せません");
  // 戦闘は確定前なら何も確定していないので、出したカードを手札に戻して取り消せる
  for (const c of p.field.splice(0)) {
    p.hand.push(c);
    ctx.events.push({ type: "cardReturned", playerId: p.id, uid: c.uid, defId: c.defId });
  }
  s.turn = null;
  s.step = { kind: "chooseAction" };
  ctx.events.push({ type: "actionCanceled", playerId: p.id });
}

function markActed(ctx: Ctx): void {
  if (ctx.s.turn?.action === "village") ctx.s.turn.acted = true;
}

// ---------------------------------------------------------------------------
// カードを出す（訪問中・戦闘中）

function playFood(ctx: Ctx, uid: string): void {
  requireStep(ctx, "village", "battle");
  const s = ctx.s;
  const p = currentPlayer(s);
  const card = handCard(p, uid);
  const def = ctx.reg.get(card.defId);
  if (def.type !== "food") fail("WRONG_CARD_TYPE", "食料カードではありません");
  takeCard(p.hand, uid);
  p.field.push(card);
  s.turn!.foodSlots += def.food;
  markActed(ctx);
  ctx.events.push({ type: "cardPlayed", playerId: p.id, uid, defId: card.defId });
  // 食料の効果は村でだけ働く
  if (def.effect && s.turn!.action === "village") enqueueEffect(ctx, def.effect, uid, p.id);
}

function playHero(ctx: Ctx, uid: string): void {
  requireStep(ctx, "village", "battle");
  const s = ctx.s;
  const p = currentPlayer(s);
  const card = handCard(p, uid);
  const def = ctx.reg.get(card.defId);
  if (def.type !== "hero") fail("WRONG_CARD_TYPE", "英雄カードではありません");
  const turn = s.turn!;
  if (turn.usedSlots >= turn.foodSlots + s.config.freeHeroSlots) fail("NO_SLOT", "食料が足りず、英雄を出せません");
  takeCard(p.hand, uid);
  p.field.push(card);
  turn.usedSlots += 1;
  markActed(ctx);
  ctx.events.push({ type: "cardPlayed", playerId: p.id, uid, defId: card.defId });
  if (def.villageEffect) {
    if (turn.action === "village") enqueueEffect(ctx, def.villageEffect, uid, p.id);
    else if (turn.action === "battle") {
      // 戦闘中に出しても、カードを引く・廃棄する効果は働く（吟遊詩人・僧侶）
      // レベル2以上の英雄だけ。効果を使った後は戻せない
      const usable = def.level >= BATTLE_EFFECT_MIN_LEVEL ? battleEffects(def.villageEffect) : [];
      if (usable.length > 0) turn.drewUids = [...(turn.drewUids ?? []), uid];
      for (const e of usable) enqueueEffect(ctx, e, uid, p.id);
    }
  }
}

/** 戦闘中にも村効果（引く・廃棄）が働く英雄の最低レベル */
export const BATTLE_EFFECT_MIN_LEVEL = 2;

function battleEffects(e: Effect): Effect[] {
  if (e.kind === "draw" || e.kind === "trash") return [e];
  return e.kind === "multi" ? e.effects.flatMap(battleEffects) : [];
}

// ---------------------------------------------------------------------------
// 戦闘（仕様書 5.3）

function battleTurn(ctx: Ctx) {
  const t = ctx.s.turn;
  if (t?.action !== "battle") fail("INVALID_STEP", "戦闘中ではありません");
  return t;
}

function equip(ctx: Ctx, weaponUid: string, heroUid: string): void {
  requireStep(ctx, "battle");
  const turn = battleTurn(ctx);
  const p = currentPlayer(ctx.s);
  const weapon = handCard(p, weaponUid);
  if (ctx.reg.get(weapon.defId).type !== "weapon") fail("WRONG_CARD_TYPE", "武器カードではありません");
  const hero = findCard(p.field, heroUid);
  if (!hero || ctx.reg.get(hero.defId).type !== "hero") fail("CARD_NOT_FOUND", "場にその英雄がいません");
  if (turn.equips[heroUid]) fail("ALREADY_EQUIPPED", "その英雄はすでに武器を装備しています");
  takeCard(p.hand, weaponUid);
  p.field.push(weapon);
  turn.equips[heroUid] = weaponUid;
  ctx.events.push({ type: "weaponEquipped", playerId: p.id, heroUid, weaponUid });
}

/** 英雄なしで使える武器を、装備せずに場に出す */
function useWeapon(ctx: Ctx, weaponUid: string): void {
  requireStep(ctx, "battle");
  battleTurn(ctx);
  const p = currentPlayer(ctx.s);
  const weapon = handCard(p, weaponUid);
  const def = ctx.reg.get(weapon.defId);
  if (def.type !== "weapon") fail("WRONG_CARD_TYPE", "武器カードではありません");
  if (def.ability?.kind !== "solo") fail("WRONG_CARD_TYPE", "この武器は英雄に装備しないと使えません");
  takeCard(p.hand, weaponUid);
  p.field.push(weapon);
  ctx.events.push({ type: "cardPlayed", playerId: p.id, uid: weaponUid, defId: weapon.defId });
}

function undoBattleCard(ctx: Ctx, uid: string): void {
  requireStep(ctx, "battle");
  const turn = battleTurn(ctx);
  const p = currentPlayer(ctx.s);
  const card = findCard(p.field, uid);
  if (!card) fail("CARD_NOT_FOUND", "場にそのカードがありません");
  const def = ctx.reg.get(card.defId);
  if (turn.drewUids?.includes(uid)) fail("CANNOT_UNDO", "カードを引いた英雄は戻せません");
  const returnCard = (u: string) => {
    const c = takeCard(p.field, u);
    if (!c) return;
    p.hand.push(c);
    ctx.events.push({ type: "cardReturned", playerId: p.id, uid: u, defId: c.defId });
  };

  if (def.type === "hero") {
    const weaponUid = turn.equips[uid];
    if (weaponUid) {
      delete turn.equips[uid];
      returnCard(weaponUid);
    }
    turn.usedSlots -= 1;
    returnCard(uid);
  } else if (def.type === "weapon") {
    const heroUid = Object.keys(turn.equips).find((h) => turn.equips[h] === uid);
    if (heroUid) delete turn.equips[heroUid];
    returnCard(uid);
  } else if (def.type === "food") {
    if (turn.foodSlots - def.food + ctx.s.config.freeHeroSlots < turn.usedSlots) fail("CANNOT_UNDO", "先に英雄を戻してください");
    turn.foodSlots -= def.food;
    returnCard(uid);
  } else {
    fail("CANNOT_UNDO", "そのカードは戻せません");
  }
}

function confirmAttack(ctx: Ctx): void {
  requireStep(ctx, "battle");
  const s = ctx.s;
  const turn = battleTurn(ctx);
  const p = currentPlayer(s);
  const squareIndex = s.route.findIndex((sq) => sq.some((c) => c.uid === turn.targetUid));
  const square = s.route[squareIndex];
  const target = square ? findCard(square, turn.targetUid) : undefined;
  if (!square || !target) fail("CARD_NOT_FOUND", "その敵は進軍ルートにいません");

  const def = ctx.reg.enemy(target.defId);
  const hp = enemyHp(s, def);
  const { total } = calcDamage(battleAttackers(s, ctx.reg), def);
  const prevDamage = s.enemyDamage[target.uid] ?? 0;
  const defeated = prevDamage + total >= hp;
  ctx.events.push({
    type: "attackResolved",
    playerId: p.id,
    targetUid: target.uid,
    targetDefId: target.defId,
    damage: total,
    prevDamage,
    hp,
    defeated,
  });
  const keep = s.config.persistentDamage === "all" || (s.config.persistentDamage === "boss" && def.isBoss);
  if (defeated) {
    delete s.enemyDamage[target.uid];
    forgetEnemy(s, target.uid);
  } else if (keep && total > 0) s.enemyDamage[target.uid] = prevDamage + total;

  if (!defeated) {
    // 撃破に失敗したときの効果：chill の武器で凍結、split の敵は分身を出す（仕様書 5.3.3）
    if (!def.isBoss && hasChill(s, ctx.reg) && !s.frozen.includes(target.uid)) {
      s.frozen.push(target.uid);
      ctx.events.push({ type: "enemyFrozen", uid: target.uid, defId: target.defId });
    }
    if (def.traits.includes("split") && def.splitInto && !s.split.includes(target.uid)) {
      const child = newCard(s, def.splitInto);
      s.route[0]!.push(child);
      s.split.push(target.uid);
      ctx.events.push({ type: "enemySplit", parentUid: target.uid, uid: child.uid, defId: child.defId });
    }
  }

  if (defeated) {
    takeCard(square, target.uid);
    if (s.config.lootToDeck) p.discard.push(target);
    else s.trash.push(target);
    const exp = def.exp + bonusExpOnDefeat(s, ctx.reg);
    p.exp += exp;
    p.totalExp += exp;
    p.kills += 1;
    ctx.events.push({ type: "expGained", playerId: p.id, amount: exp });
    if (def.isBoss) {
      endGame(ctx, "win", "bossDefeated");
      return;
    }
    if (s.config.levelUpAfterBattle) {
      s.step = { kind: "afterBattle" };
      return;
    }
  }
  s.step = { kind: "turnEnd", defeated };
}

// ---------------------------------------------------------------------------
// 集落（仕様書 5.2）

function buy(ctx: Ctx, stackId: string): void {
  requireStep(ctx, "village");
  const s = ctx.s;
  const p = currentPlayer(s);
  const stack = s.village.stacks[stackId];
  if (!stack) fail("UNKNOWN_STACK", "その在庫はありません");
  const top = stack[0];
  if (!top) fail("STOCK_EMPTY", "在庫が残っていません");
  const def = ctx.reg.get(top.defId);
  if (def.cost === null) fail("NOT_FOR_SALE", "そのカードは購入できません");
  const turn = s.turn;
  if (turn?.action !== "village") fail("INVALID_STEP", "訪問中ではありません");
  const gold = cardsGold(p, ctx.reg) + turn.bonusGold - turn.spentGold;
  if (gold < def.cost) fail("NOT_ENOUGH_GOLD", "金が足りません");
  stack.shift();
  turn.spentGold += def.cost;
  turn.acted = true;
  p.discard.push(top);
  ctx.events.push({ type: "cardBought", playerId: p.id, uid: top.uid, defId: top.defId, cost: def.cost });
}

/** レベルアップ・転職の対象。訪問中は手札、撃破直後は手札か場（戦った英雄） */
function growthCard(ctx: Ctx, p: PlayerState, uid: string): { card: CardInstance; from: CardInstance[] } {
  if (ctx.s.step.kind === "afterBattle") {
    const inField = findCard(p.field, uid);
    if (inField) return { card: inField, from: p.field };
  }
  return { card: handCard(p, uid), from: p.hand };
}

function levelUp(ctx: Ctx, uid: string): void {
  requireStep(ctx, "village", "afterBattle");
  const s = ctx.s;
  const p = currentPlayer(s);
  const { card, from } = growthCard(ctx, p, uid);
  const def = ctx.reg.get(card.defId);
  if (def.type !== "hero" || def.level === 0) fail("WRONG_CARD_TYPE", "レベルアップできる英雄ではありません");
  if (def.nextLevelExp === null) fail("MAX_LEVEL", "最大レベルです");
  if (p.exp < def.nextLevelExp) fail("NOT_ENOUGH_EXP", "経験値が足りません");
  const stack = s.village.stacks[heroStackId(def.heroId)] ?? [];
  const nextIndex = stack.findIndex((c) => ctx.reg.hero(c.defId).level === def.level + 1);
  if (nextIndex < 0) fail("STOCK_EMPTY", "次のレベルのカードが在庫にありません");
  requireGoldAfterLoss(ctx, def.gold);

  const [next] = stack.splice(nextIndex, 1);
  takeCard(from, uid);
  s.trash.push(card);
  p.exp -= def.nextLevelExp;
  markActed(ctx);
  p.discard.push(next!);
  ctx.events.push({ type: "leveledUp", playerId: p.id, fromDefId: card.defId, toDefId: next!.defId, exp: def.nextLevelExp });
}

function changeClass(ctx: Ctx, uid: string, heroId: string): void {
  requireStep(ctx, "village", "afterBattle");
  const s = ctx.s;
  const p = currentPlayer(s);
  const { card, from } = growthCard(ctx, p, uid);
  const def = ctx.reg.get(card.defId);
  if (def.type !== "hero" || def.level !== 0) fail("WRONG_CARD_TYPE", "転職できるのは村の若者だけです");
  const stack = s.village.stacks[heroStackId(heroId)];
  if (!stack) fail("UNKNOWN_STACK", "その英雄はいません");
  const cost = s.config.changeClassExp;
  if (p.exp < cost) fail("NOT_ENOUGH_EXP", "経験値が足りません");
  const nextIndex = stack.findIndex((c) => ctx.reg.hero(c.defId).level === 1);
  if (nextIndex < 0) fail("STOCK_EMPTY", "その英雄の Lv1 が在庫にありません");
  requireGoldAfterLoss(ctx, def.gold);

  const [next] = stack.splice(nextIndex, 1);
  takeCard(from, uid);
  s.trash.push(card);
  p.exp -= cost;
  markActed(ctx);
  p.discard.push(next!);
  ctx.events.push({ type: "leveledUp", playerId: p.id, fromDefId: card.defId, toDefId: next!.defId, exp: cost });
}

function endVisit(ctx: Ctx): void {
  requireStep(ctx, "village");
  const s = ctx.s;
  if (s.config.sellLoot) {
    // 戦利品の売却：手札の敵カードは金として使われたものとして取り除く
    const p = currentPlayer(s);
    const loot = p.hand.filter((c) => ctx.reg.get(c.defId).type === "enemy");
    if (loot.length > 0) {
      for (const c of loot) {
        takeCard(p.hand, c.uid);
        s.trash.push(c);
      }
      ctx.events.push({ type: "lootSold", playerId: p.id, uids: loot.map((c) => c.uid), defIds: loot.map((c) => c.defId) });
    }
  }
  ctx.s.step = { kind: "turnEnd", defeated: false };
}

/** 撃破直後のレベルアップを終えて、手番を終える（撃破したので進軍しない） */
function finishBattle(ctx: Ctx): void {
  requireStep(ctx, "afterBattle");
  ctx.s.step = { kind: "turnEnd", defeated: true };
}

// ---------------------------------------------------------------------------
// 入力待ちへの回答

function resolveTrash(ctx: Ctx, playerId: string, uids: string[]): void {
  const s = ctx.s;
  const pending = s.pending;
  if (pending?.kind !== "trash" || pending.playerId !== playerId) fail("NOT_PENDING", "廃棄の選択を求められていません");
  assertUnique(uids);
  if (uids.length > pending.max) fail("INVALID_SELECTION", `廃棄できるのは${pending.max}枚までです`);
  const p = playerById(s, playerId);
  let lostGold = 0;
  for (const uid of uids) {
    const inHand = findCard(p.hand, uid);
    if (!inHand && !findCard(p.discard, uid)) fail("CARD_NOT_FOUND", "手札か捨て札にあるカードを選んでください");
    if (inHand) lostGold += ctx.reg.get(inHand.defId).gold;
  }
  requireGoldAfterLoss(ctx, lostGold);
  for (const uid of uids) {
    const c = takeCard(p.hand, uid) ?? takeCard(p.discard, uid);
    if (!c) continue;
    s.trash.push(c);
    ctx.events.push({ type: "cardTrashed", playerId, uid, defId: c.defId });
  }
  s.pending = null;
}

function chooseTarget(ctx: Ctx, playerId: string, targetUid: string): void {
  const s = ctx.s;
  const pending = s.pending;
  if (pending?.kind !== "target" || pending.playerId !== playerId) fail("NOT_PENDING", "対象の選択を求められていません");
  if (!pending.uids.includes(targetUid)) fail("INVALID_SELECTION", "その敵は選べません");
  const index = s.route.findIndex((sq) => sq.some((c) => c.uid === targetUid));
  const card = findCard(s.route[index]!, targetUid)!;
  if (pending.mode === "freeze") {
    s.frozen.push(targetUid);
    ctx.events.push({ type: "enemyFrozen", uid: targetUid, defId: card.defId });
  } else {
    takeCard(s.route[index]!, targetUid);
    s.route[index - 1]!.push(card);
    ctx.events.push({ type: "enemyPushed", uid: targetUid, defId: card.defId, from: index, to: index - 1 });
  }
  s.pending = null;
}

function discardForEffect(ctx: Ctx, playerId: string, uids: string[]): void {
  const s = ctx.s;
  const pending = s.pending;
  const req = pending?.kind === "discard" ? pending.requests.find((r) => r.playerId === playerId && !r.done) : undefined;
  if (!pending || !req) fail("NOT_PENDING", "手札を捨てる選択を求められていません");
  assertUnique(uids);
  if (uids.length !== req.count) fail("INVALID_SELECTION", `${req.count}枚選んでください`);
  const p = playerById(s, playerId);
  for (const uid of uids) if (!findCard(p.hand, uid)) fail("CARD_NOT_FOUND", "手札にあるカードを選んでください");
  const defIds: string[] = [];
  for (const uid of uids) {
    const c = takeCard(p.hand, uid)!;
    p.discard.push(c);
    defIds.push(c.defId);
  }
  req.done = true;
  ctx.events.push({ type: "cardsDiscarded", playerId, uids: [...uids], defIds });
  if (pending.kind === "discard" && pending.requests.every((r) => r.done)) s.pending = null;
}
