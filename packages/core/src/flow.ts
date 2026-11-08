// 自動進行：手番の終了、敵の進軍、次の手番、勝敗（設計書 2.4、仕様書 5.1・5.4・7章）
import { type Ctx, currentPlayer, drawCards } from "./context.js";
import { enqueueEffect, processNextEffect } from "./effects.js";
import type { GameResult, GameState, Rank } from "./types.js";

/** プレイヤーの操作が必要になるまで、または入力待ち・終了まで進める */
export function advance(ctx: Ctx): void {
  const s = ctx.s;
  for (;;) {
    if (s.result) {
      s.step = { kind: "finished" };
      s.pending = null;
      s.effectQueue = [];
      return;
    }
    if (s.pending) return;
    if (s.effectQueue.length > 0) {
      processNextEffect(ctx);
      continue;
    }
    const step = s.step;
    switch (step.kind) {
      case "chooseAction":
      case "village":
      case "battle":
      case "finished":
        return;
      case "turnEnd":
        endTurn(ctx);
        s.step = { kind: "march", phase: "move" };
        break;
      case "march":
        if (step.phase === "move") {
          moveEnemies(ctx);
          s.step = { kind: "march", phase: "onMarch" };
        } else if (step.phase === "onMarch") {
          queueOnMarch(ctx);
          s.step = { kind: "march", phase: "reveal" };
        } else {
          revealEnemy(ctx);
          s.step = { kind: "nextTurn" };
        }
        break;
      case "nextTurn":
        s.currentPlayer = (s.currentPlayer + 1) % s.players.length;
        s.turnCount += 1;
        s.step = { kind: "chooseAction" };
        ctx.events.push({ type: "turnStarted", playerId: currentPlayer(s).id, turnCount: s.turnCount });
        return;
    }
  }
}

/** 手番の終了処理（仕様書 5.1） */
function endTurn(ctx: Ctx): void {
  const s = ctx.s;
  const p = currentPlayer(s);
  p.discard.push(...p.hand.splice(0), ...p.field.splice(0));
  s.turn = null;
  ctx.events.push({ type: "turnEnded", playerId: p.id });
  drawCards(ctx, p, s.config.handSize);
}

/** 移動と集落への到達（仕様書 5.4 の1・2） */
function moveEnemies(ctx: Ctx): void {
  const s = ctx.s;
  const last = s.route.length - 1;
  const moves: { uid: string; from: number; to: number }[] = [];
  const arrived = s.route[last] ?? [];
  for (let i = last; i >= 0; i--) {
    for (const c of s.route[i] ?? []) moves.push({ uid: c.uid, from: i, to: i + 1 });
  }
  const newRoute = [[], ...s.route.slice(0, last)];
  s.route = newRoute;
  if (moves.length > 0) ctx.events.push({ type: "enemyMoved", moves });

  for (const enemy of arrived) {
    const def = ctx.reg.enemy(enemy.defId);
    if (def.isBoss) {
      ctx.events.push({ type: "enemyArrived", uid: enemy.uid, defId: enemy.defId, damage: 0, villageHp: s.villageHp });
      endGame(ctx, "lose", "bossArrived");
      return;
    }
    const damage = def.invasion ?? 0;
    s.villageHp -= damage;
    s.trash.push(enemy);
    ctx.events.push({ type: "enemyArrived", uid: enemy.uid, defId: enemy.defId, damage, villageHp: s.villageHp });
    if (s.villageHp <= 0) {
      endGame(ctx, "lose", "villageDestroyed");
      return;
    }
  }
}

/** 進軍時の能力を、集落に近い敵から順にキューに積む（仕様書 5.4 の3） */
function queueOnMarch(ctx: Ctx): void {
  const s = ctx.s;
  for (let i = s.route.length - 1; i >= 0; i--) {
    for (const c of s.route[i] ?? []) {
      const def = ctx.reg.enemy(c.defId);
      if (def.onMarch) enqueueEffect(ctx, def.onMarch, c.uid, null);
    }
  }
}

/** 公開（仕様書 5.4 の4） */
function revealEnemy(ctx: Ctx): void {
  const s = ctx.s;
  const card = s.enemyDeck.shift();
  if (!card) return;
  const first = s.route[0];
  if (!first) throw new Error("進軍ルートがありません");
  first.push(card);
  ctx.events.push({ type: "enemyRevealed", uid: card.uid, defId: card.defId });
  const def = ctx.reg.enemy(card.defId);
  if (def.onReveal) enqueueEffect(ctx, def.onReveal, card.uid, null);
}

/** 勝敗を決める（仕様書 7章） */
export function endGame(ctx: Ctx, outcome: "win" | "lose", reason: GameResult["reason"]): void {
  const s = ctx.s;
  const result = computeResult(s, outcome, reason);
  s.result = result;
  s.step = { kind: "finished" };
  s.pending = null;
  s.effectQueue = [];
  ctx.events.push({ type: "gameEnded", result: JSON.parse(JSON.stringify(result)) as GameResult });
}

const TITLES = ["英雄王", "聖騎士", "勇者", "見習い"];

export function computeResult(s: GameState, outcome: "win" | "lose", reason: GameResult["reason"]): GameResult {
  let rank: Rank = "C";
  if (outcome === "win") {
    const ratio = s.villageHp / s.config.villageHp;
    rank = ratio >= 0.8 ? "S" : ratio >= 0.5 ? "A" : "B";
  }
  const mvp: string[] = [];
  const titles: Record<string, string> = {};
  if (s.players.length >= 2) {
    const best = Math.max(...s.players.map((p) => p.totalExp));
    const top = s.players.filter((p) => p.totalExp === best);
    const bestKills = Math.max(...top.map((p) => p.kills));
    for (const p of top) if (p.kills === bestKills) mvp.push(p.id);
    for (const p of s.players) {
      const rankIndex = s.players.filter((q) => q.totalExp > p.totalExp).length;
      titles[p.id] = TITLES[rankIndex] ?? TITLES[TITLES.length - 1]!;
    }
  }
  return { outcome, reason, rank, villageHp: Math.max(0, s.villageHp), mvp, titles };
}
