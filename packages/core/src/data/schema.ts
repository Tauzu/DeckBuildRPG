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
    z.object({ kind: z.literal("freeze"), count: positive }),
    z.object({ kind: z.literal("push"), count: positive }),
    z.object({ kind: z.literal("rally") }),
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

const weaponAbilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pierce") }),
  z.object({ kind: z.literal("perLevel"), physical: nonNeg, magic: nonNeg }),
  z.object({ kind: z.literal("defeatExp"), amount: positive }),
  z.object({ kind: z.literal("solo") }),
  z.object({ kind: z.literal("chill") }),
]);

export const weaponDefSchema = z.object({
  ...base,
  type: z.literal("weapon"),
  physical: nonNeg,
  magic: nonNeg,
  ability: weaponAbilitySchema.nullable().default(null),
});

export const foodDefSchema = z.object({
  ...base,
  type: z.literal("food"),
  food: positive,
  effect: effectSchema.nullable().default(null),
  effectInBattle: z.boolean().default(false),
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
  traits: z.array(z.enum(["guard", "split", "sprint"])).default([]),
  splitInto: z.string().min(1).nullable().default(null),
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
  marchTiming: z.enum(["turn", "round"]).optional(),
  marchSkip: z.enum(["any", "all", "none"]).optional(),
  curseStock: nonNeg,
  startingDeck: z.array(countEntry).min(1),
  heroStock: z.object({
    countsByLevel: z.record(z.string(), positive),
  }),
  itemStock: z.array(countEntry),
  enemyDeck: z.object({
    bossGroupSize: positive,
  }),
});

export const dangersFileSchema = z.array(
  z.object({
    level: positive,
    text: z.string().min(1),
    add: z.object({
      bossHpPct: z.number().int().optional(),
      villageHp: z.number().int().optional(),
      enemyHp: z.number().int().optional(),
      startCurses: nonNeg.optional(),
      enemyDeckTrim: nonNeg.optional(),
      handSize: z.number().int().optional(),
    }),
  }),
);

export const stagesFileSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string(),
      tutorial: z.boolean().optional(),
      extra: z.boolean().optional(),
      fixedSeed: z.number().int().optional(),
      backdrop: z.string().min(1).optional(),
      heroIds: z.array(z.string().min(1)).min(1),
      items: z.array(z.string().min(1)),
      bossId: z.string().min(1),
      earlyFull: z.array(z.string()),
      earlyHalf: z.array(z.string()),
      playerCounts: z.partialRecord(
        z.enum(["1", "2", "3", "4"]),
        z.object({
          villageHp: positive,
          bossHp: positive,
          enemies: z.record(z.string(), positive),
        }),
      ),
    }),
  )
  .min(1);
