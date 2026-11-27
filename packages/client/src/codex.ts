// カード図鑑（企画書 13.4）。ゲームで見たカードを記録し、種類ごとに並べる
import type { CardDef, CardRegistry, PlayerView, StageDef } from "@deckbuild/core";
import type { Progress } from "./progress.js";
import { t } from "./i18n.js";

export interface CodexGroup {
  label: string;
  /** 並べるカード。英雄は種類ごとにレベル順 */
  rows: string[][];
}

/** 図鑑に並べるカード（データにあるすべて。英雄はステージに登場する順） */
export function codexGroups(reg: CardRegistry): CodexGroup[] {
  const all = reg.all();
  const heroOrder: string[] = [];
  for (const e of reg.setup.startingDeck) {
    const d = reg.get(e.id);
    if (d.type === "hero" && !heroOrder.includes(d.heroId)) heroOrder.push(d.heroId);
  }
  for (const st of reg.stages) for (const h of st.heroIds) if (!heroOrder.includes(h)) heroOrder.push(h);
  for (const d of all) if (d.type === "hero" && !heroOrder.includes(d.heroId)) heroOrder.push(d.heroId);

  const bossOrder = [...new Set(reg.stages.map((s) => s.bossId))];
  const ofType = (pred: (d: CardDef) => boolean) => all.filter(pred).map((d) => d.id);
  return [
    { label: t("codex.group.hero"), rows: heroOrder.map((h) => reg.heroLevels(h).map((d) => d.id)) },
    { label: t("codex.group.food"), rows: [ofType((d) => d.type === "food")] },
    { label: t("codex.group.weapon"), rows: [ofType((d) => d.type === "weapon")] },
    { label: t("codex.group.enemy"), rows: [ofType((d) => d.type === "enemy" && !d.isBoss)] },
    { label: t("codex.group.boss"), rows: [[...bossOrder, ...ofType((d) => d.type === "enemy" && d.isBoss && !bossOrder.includes(d.id))]] },
    { label: t("codex.group.curse"), rows: [ofType((d) => d.type === "curse")] },
  ].filter((g) => g.rows.some((r) => r.length > 0));
}

export function codexIds(reg: CardRegistry): string[] {
  return codexGroups(reg).flatMap((g) => g.rows.flat());
}

/** 画面に見えているカード（村の在庫の一番上、進軍ルート、場、自分の手札・捨て札、他の人の捨て札の一番上） */
export function visibleDefIds(view: PlayerView): string[] {
  const ids = new Set<string>();
  for (const st of Object.values(view.village.stacks)) if (st.top) ids.add(st.top.defId);
  for (const sq of view.route) for (const c of sq) ids.add(c.defId);
  for (const p of view.players) {
    for (const c of p.field) ids.add(c.defId);
    for (const c of p.hand ?? []) ids.add(c.defId);
    for (const c of p.discard ?? []) ids.add(c.defId);
    if (p.discardTop) ids.add(p.discardTop.defId);
  }
  return [...ids];
}

/** 見たカードを足す。増えなければ同じものを返す */
export function addSeen(p: Progress, ids: string[]): Progress {
  const fresh = ids.filter((id) => !p.seen.includes(id));
  return fresh.length === 0 ? p : { ...p, seen: [...p.seen, ...fresh] };
}

/** ステージで最初から見えるカード（初期デッキ、在庫、魔物、ボス） */
export function cardsOfStage(reg: CardRegistry, stage: StageDef): string[] {
  const ids = new Set<string>(reg.setup.startingDeck.map((e) => e.id));
  for (const h of stage.heroIds) {
    const lv1 = reg.heroLevels(h)[0];
    if (lv1) ids.add(lv1.id);
  }
  for (const id of stage.items) ids.add(id);
  for (const pc of Object.values(stage.playerCounts)) for (const id of Object.keys(pc?.enemies ?? {})) ids.add(id);
  ids.add(stage.bossId);
  return [...ids];
}

/** 図鑑の記録がない古い進み具合には、クリアしたステージのカードを見たことにする */
export function seedSeen(reg: CardRegistry, p: Progress): Progress {
  if (p.seen.length > 0 || p.cleared.length === 0) return p;
  const ids = p.cleared.filter((id) => reg.stages.some((s) => s.id === id)).flatMap((id) => cardsOfStage(reg, reg.stage(id)));
  return addSeen(p, ids);
}

/** ボスの生命力の目安（1人で遊ぶときの値。図鑑で見せる） */
export function bossHpFor(reg: CardRegistry, bossId: string): number | undefined {
  const st = reg.stages.find((s) => s.bossId === bossId);
  return st ? (st.playerCounts["1"] ?? Object.values(st.playerCounts)[0])?.bossHp : undefined;
}
