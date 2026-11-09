// 演出（撃破・レベルアップ・ボス出現・集落への被害）。イベントから作り、少しの間だけ画面の中央に出す
import type { GameEvent } from "@deckbuild/core";
import { useEffect } from "react";
import { PixelArt } from "../art/PixelArt.js";
import { spriteFor } from "../art/sprites.js";
import { reg, useStore } from "../store.js";
import { cardTitle } from "../text.js";

export interface FxItem {
  id: number;
  kind: "defeat" | "hit" | "levelup" | "boss" | "village" | "turnEnd" | "march" | "skip" | "turn";
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
};

/** 続けて起きた演出の間隔 */
export const FX_STAGGER = 650;

let fxId = 0;

/** イベントの列から演出を作る。viewerId 以外の人の行動には名前を付ける */
export function effectsFrom(events: GameEvent[], viewerId: string, nameOf: (id: string) => string): Omit<FxItem, "id" | "delay">[] {
  const out: Omit<FxItem, "id" | "delay">[] = [];
  const who = (playerId: string) => (playerId === viewerId ? "" : `${nameOf(playerId)}：`);
  events.forEach((e, i) => {
    switch (e.type) {
      case "attackResolved": {
        const enemy = reg.enemy(e.targetDefId);
        if (e.defeated) {
          const exp = events.slice(i + 1).find((x) => x.type === "expGained");
          out.push({
            kind: "defeat",
            title: `${who(e.playerId)}撃破！`,
            sub: `${enemy.name}${exp?.type === "expGained" ? `　経験値+${exp.amount}` : ""}`,
            defId: e.targetDefId,
          });
        } else {
          const rest = e.hp - e.prevDamage - e.damage;
          out.push({
            kind: "hit",
            title: `${who(e.playerId)}${e.damage}ダメージ`,
            sub: enemy.isBoss && e.damage > 0 ? `${enemy.name}の残り生命力 ${rest}` : `${enemy.name}を倒せなかった`,
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
          title: `${who(e.playerId)}${from.level === 0 ? "転職！" : "レベルアップ！"}`,
          sub: `${cardTitle(from)} → ${cardTitle(to)}`,
          defId: e.toDefId,
        });
        break;
      }
      case "enemyRevealed": {
        const d = reg.enemy(e.defId);
        if (d.isBoss) out.push({ kind: "boss", title: "ボス出現！", sub: d.name, defId: e.defId });
        break;
      }
      case "enemyArrived":
        if (e.damage > 0) {
          out.push({ kind: "village", title: `集落に${e.damage}ダメージ`, sub: `${reg.get(e.defId).name}が集落に着いた（耐久値 ${Math.max(0, e.villageHp)}）`, defId: e.defId });
        }
        break;
      case "turnEnded":
        out.push({ kind: "turnEnd", title: "手番終了", sub: e.playerId === viewerId ? "あなたの手番が終わった" : `${nameOf(e.playerId)}の手番が終わった`, defId: null });
        break;
      case "enemyMoved":
        if (e.moves.length > 0) out.push({ kind: "march", title: "敵の進軍！", sub: `${e.moves.length}体が集落へ1マス進んだ`, defId: null });
        break;
      case "marchSkipped":
        out.push({ kind: "skip", title: "敵は進軍しなかった", sub: "敵を撃破したため、進軍を止めた", defId: null });
        break;
      case "turnStarted":
        out.push({
          kind: "turn",
          title: e.playerId === viewerId ? "あなたの手番" : `${nameOf(e.playerId)}の手番`,
          sub: `手番 ${e.turnCount}`,
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
