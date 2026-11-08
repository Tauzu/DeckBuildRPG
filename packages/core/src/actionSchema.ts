// 外から届く操作の検証（設計書 2.9）
import { z } from "zod";
import type { Action } from "./types.js";

const id = z.string().min(1).max(64);
const uids = z.array(id).max(64);

export const actionSchema: z.ZodType<Action> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chooseVillage") }),
  z.object({ type: z.literal("chooseBattle"), targetUid: id }),
  z.object({ type: z.literal("cancelAction") }),
  z.object({ type: z.literal("playFood"), uid: id }),
  z.object({ type: z.literal("playHero"), uid: id }),
  z.object({ type: z.literal("equip"), weaponUid: id, heroUid: id }),
  z.object({ type: z.literal("undoBattleCard"), uid: id }),
  z.object({ type: z.literal("confirmAttack") }),
  z.object({ type: z.literal("buy"), stackId: id }),
  z.object({ type: z.literal("levelUp"), uid: id }),
  z.object({ type: z.literal("changeClass"), uid: id, heroId: id }),
  z.object({ type: z.literal("endVisit") }),
  z.object({ type: z.literal("finishBattle") }),
  z.object({ type: z.literal("resolveTrash"), uids }),
  z.object({ type: z.literal("discardForEffect"), uids }),
]);
