// 演出（撃破・レベルアップ・ボス出現・集落への被害）。イベントから作り、少しの間だけ画面の中央に出す
import type { GameEvent } from "@deckbuild/core";
import type { Sfx } from "../audio.js";
import { useEffect } from "react";
import { PixelArt } from "../art/PixelArt.js";
import { spriteFor } from "../art/sprites.js";
import { reg, useStore } from "../store.js";
import { cardName, cardTitle } from "../text.js";
import { t } from "../i18n.js";

export interface FxItem {
  id: number;
  kind: "defeat" | "hit" | "levelup" | "boss" | "village" | "turnEnd" | "march" | "skip" | "turn" | "buy";
  title: string;
  sub: string;
  /** 絵を出すカード */
  defId: string | null;
  /** 表示を始めるまでの時間（ミリ秒）。一度に起きたことを順番に見せる */
  delay: number;
}

/** 表示する時間（ミリ秒） */
const DURATION: Record<FxItem["kind"], number> = {
  defeat: 1700,
  hit: 1300,
  levelup: 1800,
  boss: 2000,
  village: 1500,
  turnEnd: 1000,
  march: 1400,
  skip: 1400,
  turn: 1300,
  buy: 1100,
};

/** 続けて起きた演出の間隔 */
export const FX_STAGGER = 650;

let fxId = 0;

/** イベントの列から演出を作る。viewerId 以外の人の行動には名前を付ける */
export function effectsFrom(events: GameEvent[], viewerId: string, nameOf: (id: string) => string): Omit<FxItem, "id" | "delay">[] {
  const out: Omit<FxItem, "id" | "delay">[] = [];
  const who = (playerId: string) => (playerId === viewerId ? "" : t("fx.who", { name: nameOf(playerId) }));
  events.forEach((e, i) => {
    switch (e.type) {
      case "attackResolved": {
        const enemy = reg.enemy(e.targetDefId);
        if (e.defeated) {
          const exp = events.slice(i + 1).find((x) => x.type === "expGained");
          out.push({
            kind: "defeat",
            title: t("fx.defeated", { who: who(e.playerId) }),
            sub: `${cardName(enemy)}${exp?.type === "expGained" ? t("fx.exp", { n: exp.amount }) : ""}`,
            defId: e.targetDefId,
          });
        } else {
          const rest = e.hp - e.prevDamage - e.damage;
          out.push({
            kind: "hit",
            title: t("fx.damage", { who: who(e.playerId), n: e.damage }),
            sub: enemy.isBoss && e.damage > 0 ? t("fx.bossLeft", { enemy: cardName(enemy), n: rest }) : t("fx.notDefeated", { enemy: cardName(enemy) }),
            defId: e.targetDefId,
          });
        }
        break;
      }
      case "leveledUp": {
        const from = reg.hero(e.fromDefId);
        const to = reg.hero(e.toDefId);
        out.push({
          kind: "levelup",
          title: t(from.level === 0 ? "fx.promoted" : "fx.leveledUp", { who: who(e.playerId) }),
          sub: `${cardTitle(from)} → ${cardTitle(to)}`,
          defId: e.toDefId,
        });
        break;
      }
      case "enemyRevealed": {
        const d = reg.enemy(e.defId);
        if (d.isBoss) out.push({ kind: "boss", title: t("fx.boss"), sub: cardName(d), defId: e.defId });
        break;
      }
      case "enemyArrived":
        if (e.damage > 0) {
          out.push({ kind: "village", title: t("fx.villageHit", { n: e.damage }), sub: t("fx.villageHitSub", { enemy: cardName(reg.get(e.defId)), hp: Math.max(0, e.villageHp) }), defId: e.defId });
        }
        break;
      case "cardBought": {
        const d = reg.get(e.defId);
        out.push({ kind: "buy", title: t("fx.bought", { who: who(e.playerId) }), sub: t("fx.boughtSub", { card: cardTitle(d), cost: e.cost }), defId: e.defId });
        break;
      }
      case "turnEnded":
        out.push({ kind: "turnEnd", title: t("fx.turnEnd"), sub: e.playerId === viewerId ? t("fx.yourTurnEnded") : t("fx.theirTurnEnded", { name: nameOf(e.playerId) }), defId: null });
        break;
      case "enemyMoved":
        if (e.moves.length > 0) out.push({ kind: "march", title: t("fx.march"), sub: t("fx.marchSub", { n: e.moves.length }), defId: null });
        break;
      case "marchSkipped":
        out.push({ kind: "skip", title: t("fx.skip"), sub: t("fx.skipSub"), defId: null });
        break;
      case "turnStarted":
        out.push({
          kind: "turn",
          title: e.playerId === viewerId ? t("fx.yourTurn") : t("fx.theirTurn", { name: nameOf(e.playerId) }),
          sub: t("fx.turnN", { n: e.turnCount }),
          defId: null,
        });
        break;
      default:
        break;
    }
  });
  return out;
}

export function nextFxId(): number {
  return ++fxId;
}

export function Effects() {
  const fx = useStore((s) => s.fx);
  // 一度にたくさん出たときは新しいものから3つまで
  const shown = fx.slice(-5);
  return (
    <div className="fx-layer" aria-live="polite">
      {shown.map((f) => (
        <FxCard key={f.id} item={f} />
      ))}
    </div>
  );
}

function FxCard({ item }: { item: FxItem }) {
  const remove = useStore((s) => s.removeFx);
  useEffect(() => {
    const t = setTimeout(() => remove(item.id), item.delay + DURATION[item.kind]);
    return () => clearTimeout(t);
  }, [item.id, item.kind, item.delay, remove]);
  const def = item.defId ? reg.get(item.defId) : null;
  const sprite = def ? spriteFor(def.id, def.type === "hero" ? def.heroId : undefined) : null;
  return (
    <div className={`fx fx-${item.kind}`} style={{ animationDuration: `${DURATION[item.kind]}ms`, animationDelay: `${item.delay}ms` }} role="status">
      {sprite && (
        <div className="fx-art">
          <PixelArt sprite={sprite} />
          {item.kind === "defeat" && <span className="fx-slash" />}
          {item.kind === "levelup" && <span className="fx-sparkle" />}
        </div>
      )}
      <div className="fx-text">
        <div className="fx-title">{item.title}</div>
        <div className="fx-sub">{item.sub}</div>
      </div>
    </div>
  );
}

/** イベントから効果音を選ぶ。演出と同じ順番・間隔で鳴らす */
export function soundsFrom(events: GameEvent[], viewerId: string): { name: Sfx; delay: number }[] {
  const out: { name: Sfx; delay: number }[] = [];
  let order = 0;
  /** 手番の終わりに手札を引き直した分は鳴らさない（効果で引いたときだけ鳴らす） */
  let refill = false;
  const staged = (name: Sfx) => out.push({ name, delay: order++ * FX_STAGGER });
  const now = (name: Sfx) => out.push({ name, delay: order * FX_STAGGER });
  for (const ev of events) {
    switch (ev.type) {
      case "cardPlayed":
        out.push({ name: "play", delay: 0 });
        break;
      case "weaponEquipped":
        out.push({ name: "equip", delay: 0 });
        break;
      case "cardBought":
        staged("buy");
        break;
      case "attackResolved":
        staged(ev.defeated ? "defeat" : "hit");
        break;
      case "leveledUp":
        staged("levelup");
        break;
      case "enemyRevealed":
        if (reg.enemy(ev.defId).isBoss) staged("boss");
        else out.push({ name: "reveal", delay: order * FX_STAGGER });
        break;
      case "enemyArrived":
        if (ev.damage > 0) staged("village");
        break;
      case "turnEnded":
        order++;
        refill = true;
        break;
      case "cardsDrawn":
        if (!refill && ev.count > 0) now("draw");
        break;
      case "cardTrashed":
        now("trash");
        break;
      case "lootSold":
        if (ev.uids.length > 0) now("sell");
        break;
      case "enemyFrozen":
        staged("freeze");
        break;
      case "enemyPushed":
        staged("push");
        break;
      case "enemySplit":
        staged("split");
        break;
      case "cardsDiscarded":
        if (ev.uids.length > 0) staged("discard");
        break;
      case "curseAdded":
        staged("curse");
        break;
      case "enemyMoved":
        if (ev.moves.length > 0) staged("march");
        break;
      case "marchSkipped":
        staged("skip");
        break;
      case "turnStarted":
        if (ev.playerId === viewerId) staged("myturn");
        else order++;
        break;
      case "gameEnded":
        out.push({ name: ev.result.outcome === "win" ? "win" : "lose", delay: order * FX_STAGGER });
        break;
      default:
        break;
    }
  }
  return out;
}
