// カードデータの Zod スキーマ（設計書 3.2）
import { z } from "zod";
import type { Effect } from "../types.js";

const nonNeg = z.number().int().min(0);
const positive = z.number().int().min(1);

export const effectSchema: z.ZodType<Effect> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("draw"), count: positive }),
    z.object({ kind: z.literal("gold"), amount: positive }),
    z.object({ kind: z.literal("exp"), amount: positive }),
    z.object({ kind: z.literal("trash"), count: positive }),
    z.object({ kind: z.literal("multi"), effects: z.array(effectSchema).min(1) }),
    z.object({ kind: z.literal("discardHand"), count: positive, target: z.enum(["all", "next"]) }),
    z.object({ kind: z.literal("addCurse"), count: positive }),
  ]),
);

const base = {
  id: z.string().min(1),
  name: z.string().min(1),
  cost: nonNeg.nullable(),
  gold: nonNeg,
};

const resist = z.enum(["none", "half", "immune"]);

export const heroDefSchema = z.object({
  ...base,
  type: z.literal("hero"),
  heroId: z.string().min(1),
  level: nonNeg,
  physical: nonNeg,
  magic: nonNeg,
  villageEffect: effectSchema.nullable(),
  nextLevelExp: positive.nullable(),
});

export const weaponDefSchema = z.object({
  ...base,
  type: z.literal("weapon"),
  physical: nonNeg,
  magic: nonNeg,
});

export const foodDefSchema = z.object({
  ...base,
  type: z.literal("food"),
  food: positive,
});

export const curseDefSchema = z.object({
  ...base,
  type: z.literal("curse"),
});

export const enemyDefSchema = z.object({
  ...base,
  type: z.literal("enemy"),
  hp: positive.nullable(),
  resistPhysical: resist,
  resistMagic: resist,
  exp: nonNeg,
  invasion: positive.nullable(),
  isBoss: z.boolean(),
  onReveal: effectSchema.nullable(),
  onMarch: effectSchema.nullable(),
});

export const heroesFileSchema = z.array(heroDefSchema);
export const itemsFileSchema = z.array(z.discriminatedUnion("type", [weaponDefSchema, foodDefSchema, curseDefSchema]));
export const enemiesFileSchema = z.array(enemyDefSchema);

const countEntry = z.object({ id: z.string().min(1), count: positive });

export const setupFileSchema = z.object({
  handSize: positive,
  routeLength: positive,
  changeClassExp: positive,
  persistentDamage: z.enum(["none", "boss", "all"]).optional(),
  lootToDeck: z.boolean().optional(),
  sellLoot: z.boolean().optional(),
  freeHeroSlots: nonNeg.optional(),
  levelUpAfterBattle: z.boolean().optional(),
  curseStock: nonNeg,
  startingDeck: z.array(countEntry).min(1),
  heroStock: z.object({
    heroIds: z.array(z.string().min(1)).min(1),
    countsByLevel: z.record(z.string(), positive),
  }),
  itemStock: z.array(countEntry),
  enemyDeck: z.object({
    bossId: z.string().min(1),
    bossGroupSize: positive,
    earlyFull: z.array(z.string()),
    earlyHalf: z.array(z.string()),
  }),
  playerCounts: z.record(
    z.enum(["1", "2", "3", "4"]),
    z.object({
      villageHp: positive,
      bossHp: positive,
      enemies: z.record(z.string(), positive),
    }),
  ),
});
