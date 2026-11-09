// 記録からの再現（設計書 2.12）
import type { CardRegistry } from "./data/registry.js";
import { applyAction, isEngineError } from "./engine.js";
import { createGame } from "./setup.js";
import type { Action, GameState } from "./types.js";

export interface GameRecord {
  version: 1;
  seed: number;
  players: { id: string; name: string }[];
  stageId: string;
  dataHash: string;
  actions: { playerId: string; action: Action }[];
}

export function newRecord(
  seed: number,
  players: { id: string; name: string }[],
  reg: CardRegistry,
  stageId: string = reg.defaultStageId,
): GameRecord {
  return { version: 1, seed, players, stageId, dataHash: reg.hash, actions: [] };
}

export function replay(record: GameRecord, reg: CardRegistry): GameState {
  if (record.dataHash !== reg.hash) throw new Error("カードデータが記録と異なるため再現できません");
  let state = createGame({ seed: record.seed, players: record.players, stageId: record.stageId }, reg).state;
  record.actions.forEach(({ playerId, action }, i) => {
    const r = applyAction(state, playerId, action, reg);
    if (isEngineError(r)) throw new Error(`記録の ${i} 番目の操作が失敗しました: ${r.error} ${r.message}`);
    state = r.state;
  });
  return state;
}
