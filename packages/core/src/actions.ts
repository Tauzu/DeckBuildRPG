// 操作ごとの処理（仕様書 5.2・5.3・5.5）
import {
  assertUnique,
  type Ctx,
  currentPlayer,
  fail,
  findCard,
  heroStackId,
  playerById,
  takeCard,
} from "./context.js";
import { enqueueEffect } from "./effects.js";
import { endGame } from "./flow.js";
import { battleAttackers, calcDamage, cardsGold, enemyHp } from "./rules.js";
import type { Action, CardInstance, PlayerState } from "./types.js";

export function dispatch(ctx: Ctx, playerId: string, action: Action): void {
  const s = ctx.s;
  if (s.result) fail("GAME_OVER", "ゲームは終了しています");

  // 入力待ちへの回答
  if (action.type === "resolveTrash") return resolveTrash(ctx, playerId, action.uids);
  if (action.type === "discardForEffect") return discardForEffect(ctx, playerId, action.uids);
  if (s.pending) fail("PENDING_INPUT", "入力待ちの選択があります");

  if (currentPlayer(s).id !== playerId) fail("NOT_YOUR_TURN", "手番ではありません");

  switch (action.type) {
    case "chooseVillage":
      return chooseVillage(ctx);
    case "chooseBattle":
      return chooseBattle(ctx, action.targetUid);
    case "playFood":
      return playFood(ctx, action.uid);
    case "playHero":
      return playHero(ctx, action.uid);
    case "equip":
      return equip(ctx, action.weaponUid, action.heroUid);
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
  }
}

// ---------------------------------------------------------------------------
// 共通

function requireStep(ctx: Ctx, ...kinds: ("chooseAction" | "village" | "battle")[]): void {
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
  s.turn = { action: "village", foodSlots: 0, usedSlots: 0, bonusGold: 0, spentGold: 0 };
  s.step = { kind: "village" };
  ctx.events.push({ type: "actionChosen", playerId: currentPlayer(s).id, action: "village" });
}

function chooseBattle(ctx: Ctx, targetUid: string): void {
  requireStep(ctx, "chooseAction");
  const s = ctx.s;
  if (s.route.every((sq) => sq.length === 0)) fail("NO_ENEMY", "進軍ルートに敵がいません");
  if (!s.route.some((sq) => sq.some((c) => c.uid === targetUid))) fail("CARD_NOT_FOUND", "その敵は進軍ルートにいません");
  s.turn = { action: "battle", targetUid, foodSlots: 0, usedSlots: 0, equips: {} };
  s.step = { kind: "battle" };
  ctx.events.push({ type: "actionChosen", playerId: currentPlayer(s).id, action: "battle", targetUid });
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
  ctx.events.push({ type: "cardPlayed", playerId: p.id, uid, defId: card.defId });
}

function playHero(ctx: Ctx, uid: string): void {
  requireStep(ctx, "village", "battle");
  const s = ctx.s;
  const p = currentPlayer(s);
  const card = handCard(p, uid);
  const def = ctx.reg.get(card.defId);
  if (def.type !== "hero") fail("WRONG_CARD_TYPE", "英雄カードではありません");
  const turn = s.turn!;
  if (turn.usedSlots >= turn.foodSlots) fail("NO_SLOT", "食料が足りず、英雄を出せません");
  takeCard(p.hand, uid);
  p.field.push(card);
  turn.usedSlots += 1;
  ctx.events.push({ type: "cardPlayed", playerId: p.id, uid, defId: card.defId });
  if (turn.action === "village" && def.villageEffect) enqueueEffect(ctx, def.villageEffect, uid, p.id);
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

function undoBattleCard(ctx: Ctx, uid: string): void {
  requireStep(ctx, "battle");
  const turn = battleTurn(ctx);
  const p = currentPlayer(ctx.s);
  const card = findCard(p.field, uid);
  if (!card) fail("CARD_NOT_FOUND", "場にそのカードがありません");
  const def = ctx.reg.get(card.defId);
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
    if (turn.foodSlots - def.food < turn.usedSlots) fail("CANNOT_UNDO", "先に英雄を戻してください");
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
  const defeated = total >= hp;
  ctx.events.push({
    type: "attackResolved",
    playerId: p.id,
    targetUid: target.uid,
    targetDefId: target.defId,
    damage: total,
    hp,
    defeated,
  });

  if (defeated) {
    takeCard(square, target.uid);
    p.discard.push(target);
    p.exp += def.exp;
    p.totalExp += def.exp;
    p.kills += 1;
    ctx.events.push({ type: "expGained", playerId: p.id, amount: def.exp });
    if (def.isBoss) {
      endGame(ctx, "win", "bossDefeated");
      return;
    }
  }
  s.step = { kind: "turnEnd" };
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
  p.discard.push(top);
  ctx.events.push({ type: "cardBought", playerId: p.id, uid: top.uid, defId: top.defId, cost: def.cost });
}

function levelUp(ctx: Ctx, uid: string): void {
  requireStep(ctx, "village");
  const s = ctx.s;
  const p = currentPlayer(s);
  const card = handCard(p, uid);
  const def = ctx.reg.get(card.defId);
  if (def.type !== "hero" || def.level === 0) fail("WRONG_CARD_TYPE", "レベルアップできる英雄ではありません");
  if (def.nextLevelExp === null) fail("MAX_LEVEL", "最大レベルです");
  if (p.exp < def.nextLevelExp) fail("NOT_ENOUGH_EXP", "経験値が足りません");
  const stack = s.village.stacks[heroStackId(def.heroId)] ?? [];
  const nextIndex = stack.findIndex((c) => ctx.reg.hero(c.defId).level === def.level + 1);
  if (nextIndex < 0) fail("STOCK_EMPTY", "次のレベルのカードが在庫にありません");
  requireGoldAfterLoss(ctx, def.gold);

  const [next] = stack.splice(nextIndex, 1);
  takeCard(p.hand, uid);
  s.trash.push(card);
  p.exp -= def.nextLevelExp;
  p.discard.push(next!);
  ctx.events.push({ type: "leveledUp", playerId: p.id, fromDefId: card.defId, toDefId: next!.defId, exp: def.nextLevelExp });
}

function changeClass(ctx: Ctx, uid: string, heroId: string): void {
  requireStep(ctx, "village");
  const s = ctx.s;
  const p = currentPlayer(s);
  const card = handCard(p, uid);
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
  takeCard(p.hand, uid);
  s.trash.push(card);
  p.exp -= cost;
  p.discard.push(next!);
  ctx.events.push({ type: "leveledUp", playerId: p.id, fromDefId: card.defId, toDefId: next!.defId, exp: cost });
}

function endVisit(ctx: Ctx): void {
  requireStep(ctx, "village");
  ctx.s.step = { kind: "turnEnd" };
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
