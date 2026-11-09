// data/ フォルダの標準データを読み込んだ CardRegistry
import heroes from "../../../../data/heroes.json";
import items from "../../../../data/items.json";
import enemies from "../../../../data/enemies.json";
import setup from "../../../../data/setup.json";
import stages from "../../../../data/stages.json";
import dangers from "../../../../data/dangers.json";
import { createRegistry, type CardRegistry } from "./registry.js";

let cached: CardRegistry | null = null;

export function defaultRegistry(): CardRegistry {
  cached ??= createRegistry({ heroes, items, enemies, setup, stages, dangers });
  return cached;
}
