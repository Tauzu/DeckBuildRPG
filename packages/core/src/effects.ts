// 村効果・敵の能力の処理（設計書 2.6、仕様書 5.5）
import { type Ctx, drawCards, playerById } from "./context.js";
import type { Effect, QueuedEffect } from "./types.js";

type Result = "done" | "waiting";
type Handler<K extends Effect["kind"]> = (ctx: Ctx, effect: Extract<Effect, { kind: K }>, q: QueuedEffect) => Result;

/** 効果をキューの末尾に積む（multi は分解する） */
export function enqueueEffect(ctx: Ctx, effect: Effect, sourceUid: string, ownerId: string | null): void {
  for (const e of flatten(effect)) ctx.s.effectQueue.push({ effect: e, sourceUid, ownerId });
}

function flatten(effect: Effect): Effect[] {
  return effect.kind === "multi" ? effect.effects.flatMap(flatten) : [effect];
}

function owner(ctx: Ctx, q: QueuedEffect) {
  if (!q.ownerId) throw new Error(`効果 ${q.effect.kind} には使用者が必要です`);
  return playerById(ctx.s, q.ownerId);
}

const handlers: { [K in Effect["kind"]]: Handler<K> } = {
  draw(ctx, e, q) {
    drawCards(ctx, owner(ctx, q), e.count);
    return "done";
  },

  gold(ctx, e) {
    if (ctx.s.turn?.action === "village") ctx.s.turn.bonusGold += e.amount;
    return "done";
  },

  exp(ctx, e, q) {
    const p = owner(ctx, q);
    p.exp += e.amount;
    p.totalExp += e.amount;
    ctx.events.push({ type: "expGained", playerId: p.id, amount: e.amount });
    return "done";
  },

  trash(ctx, e, q) {
    const p = owner(ctx, q);
    if (p.hand.length === 0 && p.discard.length === 0) return "done";
    ctx.s.pending = { kind: "trash", playerId: p.id, max: e.count };
    return "waiting";
  },

  multi(ctx, e, q) {
    // enqueueEffect で分解済みのため通常は来ないが、念のため先頭に展開する
    ctx.s.effectQueue.unshift(...e.effects.map((effect) => ({ ...q, effect })));
    return "done";
  },

  discardHand(ctx, e) {
    const s = ctx.s;
    const targets =
      e.target === "all" ? s.players : [s.players[s.turnQueue[0] ?? (s.currentPlayer + 1) % s.players.length]].filter((p) => p !== undefined);
    const requests = targets
      .filter((p) => p.hand.length > 0)
      .map((p) => ({ playerId: p.id, count: Math.min(e.count, p.hand.length), done: false }));
    if (requests.length === 0) return "done";
    s.pending = { kind: "discard", requests };
    return "waiting";
  },

  addCurse(ctx, e) {
    const s = ctx.s;
    for (let i = 0; i < e.count; i++) {
      for (const p of s.players) {
        const curse = s.village.curses.shift();
        if (!curse) return "done";
        p.discard.push(curse);
        ctx.events.push({ type: "curseAdded", playerId: p.id, uid: curse.uid });
      }
    }
    return "done";
  },
};

/** キューの先頭の効果を1つ処理する。入力待ちになったら "waiting" */
export function processNextEffect(ctx: Ctx): Result {
  const q = ctx.s.effectQueue.shift();
  if (!q) return "done";
  const handler = handlers[q.effect.kind] as Handler<Effect["kind"]>;
  const result = handler(ctx, q.effect, q);
  ctx.events.push({ type: "effectResolved", playerId: q.ownerId, sourceUid: q.sourceUid, effect: structuredCloneEffect(q.effect) });
  return result;
}

/** イベントに draft を混ぜないための複製 */
function structuredCloneEffect(e: Effect): Effect {
  return JSON.parse(JSON.stringify(e)) as Effect;
}
