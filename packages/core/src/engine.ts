// エンジンの入口（設計書 2.3）
import { produce } from "immer";
import { dispatch } from "./actions.js";
import { type Ctx, RuleError, heroStackId } from "./context.js";
import type { CardRegistry } from "./data/registry.js";
import { advance } from "./flow.js";
import { rngStep } from "./rng.js";
import type { Action, EngineError, EngineResult, ErrorCode, GameEvent, GameState } from "./types.js";

/** 操作を1つ実行し、自動で進められるところまで進める。ルール違反なら状態を変えずにエラーを返す */
export function applyAction(
  state: GameState,
  playerId: string,
  action: Action,
  reg: CardRegistry,
): EngineResult | EngineError {
  const events: GameEvent[] = [];
  try {
    const next = produce(state, (draft) => {
      const ctx: Ctx = { s: draft as GameState, reg, events };
      dispatch(ctx, playerId, action);
      advance(ctx);
    });
    return { state: next, events };
  } catch (e) {
    if (e instanceof RuleError) return { error: e.code, message: e.message };
    throw e;
  }
}

export function isEngineError(r: EngineResult | EngineError): r is EngineError {
  return "error" in r;
}

/** 操作ができるかだけを調べる。できるなら null、できないなら理由 */
export function checkAction(state: GameState, playerId: string, action: Action, reg: CardRegistry): ErrorCode | null {
  const r = applyAction(state, playerId, action, reg);
  return isEngineError(r) ? r.error : null;
}

export interface ActionOption {
  action: Action;
  /** できない理由。できるなら null */
  reason: ErrorCode | null;
}

export interface LegalActions {
  /** 今このプレイヤーの入力を待っているか */
  waitingForMe: boolean;
  /** 1回で決まる操作の一覧（選択式の入力待ちは含まない） */
  options: ActionOption[];
  /** 選択式の入力待ち（廃棄・手札を捨てる） */
  selection: { kind: "trash"; max: number; from: ("hand" | "discard")[] } | { kind: "discard"; count: number } | null;
}

/** 今そのプレイヤーができる操作の一覧（設計書 2.8）。判定は applyAction と同じ処理で行う */
export function legalActions(state: GameState, playerId: string, reg: CardRegistry): LegalActions {
  const none: LegalActions = { waitingForMe: false, options: [], selection: null };
  if (state.result) return none;

  const pending = state.pending;
  if (pending) {
    if (pending.kind === "trash" && pending.playerId === playerId) {
      return { waitingForMe: true, options: [], selection: { kind: "trash", max: pending.max, from: ["hand", "discard"] } };
    }
    if (pending.kind === "discard") {
      const req = pending.requests.find((r) => r.playerId === playerId && !r.done);
      if (req) return { waitingForMe: true, options: [], selection: { kind: "discard", count: req.count } };
    }
    return none;
  }

  const me = state.players[state.currentPlayer];
  if (!me || me.id !== playerId) return none;

  const candidates: Action[] = [];
  switch (state.step.kind) {
    case "chooseAction":
      candidates.push({ type: "chooseVillage" });
      for (const c of state.route.flat()) candidates.push({ type: "chooseBattle", targetUid: c.uid });
      break;
    case "village":
      candidates.push({ type: "cancelAction" });
      for (const c of me.hand) {
        const t = reg.get(c.defId).type;
        if (t === "food") candidates.push({ type: "playFood", uid: c.uid });
        if (t === "hero") {
          candidates.push({ type: "playHero", uid: c.uid });
          const hd = reg.hero(c.defId);
          if (hd.level === 0) {
            for (const heroId of state.config.heroIds) candidates.push({ type: "changeClass", uid: c.uid, heroId });
          } else {
            candidates.push({ type: "levelUp", uid: c.uid });
          }
        }
      }
      for (const stackId of Object.keys(state.village.stacks)) candidates.push({ type: "buy", stackId });
      candidates.push({ type: "endVisit" });
      break;
    case "battle": {
      candidates.push({ type: "cancelAction" });
      const heroesOnField = me.field.filter((c) => reg.get(c.defId).type === "hero");
      for (const c of me.hand) {
        const t = reg.get(c.defId).type;
        if (t === "food") candidates.push({ type: "playFood", uid: c.uid });
        if (t === "hero") candidates.push({ type: "playHero", uid: c.uid });
        if (t === "weapon") for (const h of heroesOnField) candidates.push({ type: "equip", weaponUid: c.uid, heroUid: h.uid });
      }
      for (const c of me.field) candidates.push({ type: "undoBattleCard", uid: c.uid });
      candidates.push({ type: "confirmAttack" });
      break;
    }
    case "afterBattle":
      for (const c of [...me.field, ...me.hand]) {
        if (reg.get(c.defId).type !== "hero") continue;
        const hd = reg.hero(c.defId);
        if (hd.level === 0) {
          for (const heroId of state.config.heroIds) candidates.push({ type: "changeClass", uid: c.uid, heroId });
        } else {
          candidates.push({ type: "levelUp", uid: c.uid });
        }
      }
      candidates.push({ type: "finishBattle" });
      break;
    default:
      return none;
  }

  return {
    waitingForMe: true,
    options: candidates.map((action) => ({ action, reason: checkAction(state, playerId, action, reg) })),
    selection: null,
  };
}

/** 入力待ちが時間切れになったとき、または接続が切れた人の手番で使う代わりの操作（設計書 2.5） */
export function timeoutAction(state: GameState, playerId: string): Action | null {
  if (state.result) return null;
  const pending = state.pending;
  if (pending) {
    if (pending.kind === "trash" && pending.playerId === playerId) return { type: "resolveTrash", uids: [] };
    if (pending.kind === "discard") {
      const req = pending.requests.find((r) => r.playerId === playerId && !r.done);
      const p = state.players.find((x) => x.id === playerId);
      if (!req || !p) return null;
      // ゲームの乱数の状態から決まる「ランダムな」選択。状態は進めない（記録に操作が残るので再現できる）
      const pool = p.hand.map((c) => c.uid);
      const chosen: string[] = [];
      let rng = state.rng;
      for (let i = 0; i < req.count && pool.length > 0; i++) {
        const r = rngStep(rng);
        rng = r.next;
        const idx = Math.floor(r.value * pool.length);
        chosen.push(...pool.splice(idx, 1));
      }
      return { type: "discardForEffect", uids: chosen };
    }
    return null;
  }
  const me = state.players[state.currentPlayer];
  if (!me || me.id !== playerId) return null;
  switch (state.step.kind) {
    case "chooseAction":
      return { type: "chooseVillage" };
    case "village":
      return { type: "endVisit" };
    case "battle":
      return { type: "confirmAttack" };
    case "afterBattle":
      return { type: "finishBattle" };
    default:
      return null;
  }
}

export { heroStackId };
