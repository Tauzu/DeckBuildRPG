// 戦闘中は村の在庫の代わりに、戦っている相手とダメージの見込みを大きく出す
import { enemyHp } from "@deckbuild/core";
import { reg, useStore } from "../store.js";
import { Card } from "./Card.js";
import { PlayedCards } from "./PlayedCards.js";
import { t } from "../i18n.js";

export function BattlePanel() {
  const update = useStore((s) => s.update)!;
  const { view, info } = update;
  const turn = view.turn;
  const cur = view.players.find((p) => p.id === view.currentPlayerId);
  const who = cur && cur.id !== view.viewerId ? t("battle.titleOf", { name: cur.name }) : t("battle.title");

  if (view.step.kind === "afterBattle") {
    return (
      <section className="battle-panel panel">
        <h2>{who}</h2>
        <p className="battle-result battle-win">{t("battle.defeated")}</p>
        <p className="dialog-note">{t("battle.afterNote")}</p>
        <PlayedCards />
      </section>
    );
  }

  const target = turn?.action === "battle" ? view.route.flat().find((c) => c.uid === turn.targetUid) : undefined;
  if (!target) return null;
  const def = reg.enemy(target.defId);
  const p = info.preview;
  const hp = p?.hp ?? def.hp ?? 0;
  const prev = p?.prevDamage ?? 0;
  const dmg = p?.total ?? 0;
  const rest = Math.max(0, hp - prev - dmg);
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / Math.max(1, hp)) * 100))}%`;
  const ok = prev + dmg >= hp;

  return (
    <section className="battle-panel panel">
      <h2>{who}</h2>
      <div className="battle-body">
        <Card defId={target.defId} hp={enemyHp(view, def)} damage={view.enemyDamage[target.uid]} highlight="target" />
        <div className="battle-numbers">
          <div className="battle-row">
            <span>{t("battle.hp")}</span>
            <strong>{hp}</strong>
          </div>
          {prev > 0 && (
            <div className="battle-row">
              <span>{t("battle.prevDamage")}</span>
              <strong>{prev}</strong>
            </div>
          )}
          <div className="battle-row">
            <span>{t("battle.expected")}</span>
            <strong className={ok ? "info-ok" : ""}>{dmg}</strong>
          </div>
          <div className="battle-bar" aria-hidden="true">
            <div className="battle-bar-prev" style={{ width: pct(prev) }} />
            <div className="battle-bar-now" style={{ width: pct(Math.min(dmg, hp - prev)) }} />
          </div>
          <p className={`battle-result ${ok ? "battle-win" : ""}`}>
            {ok ? t("battle.ok") : def.isBoss ? t("battle.bossLeft", { n: rest }) : t("battle.short", { n: rest })}
          </p>
          {p && (p.physical !== p.physicalAfter || p.magic !== p.magicAfter) && (
            <p className="dialog-note">
              {t("battle.resist", { p1: p.physical, p2: p.physicalAfter, m1: p.magic, m2: p.magicAfter })}
            </p>
          )}
          {p && p.frozenBonus > 0 && <p className="dialog-note">{t("battle.frozen", { n: p.frozenBonus })}</p>}
        </div>
      </div>
      <PlayedCards />
    </section>
  );
}
