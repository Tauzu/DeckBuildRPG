// 他のプレイヤーの情報（仕様書 10.2「横」）。マルチのときだけ表示する
import type { CardInstance } from "@deckbuild/core";
import { PixelArt } from "../art/PixelArt.js";
import { spriteFor } from "../art/sprites.js";
import { STAMPS } from "../art/stamps.js";
import { useState } from "react";
import { reg, useStore } from "../store.js";
import { cardTitle } from "../text.js";
import { t } from "../i18n.js";

/** 他のプレイヤーが場に出したカード。英雄には装備した武器を添える */
function FieldCards({ field, equips }: { field: CardInstance[]; equips: Record<string, string> }) {
  const showDetail = useStore((s) => s.showDetail);
  const equipped = new Set(Object.values(equips));
  const byUid = new Map(field.map((c) => [c.uid, c]));
  const mini = (c: CardInstance, extra?: CardInstance) => {
    const def = reg.get(c.defId);
    const sprite = spriteFor(def.id, def.type === "hero" ? def.heroId : undefined);
    const stat =
      def.type === "hero"
        ? [def.physical > 0 && t("others.phys", { n: def.physical }), def.magic > 0 && t("others.mag", { n: def.magic })].filter(Boolean).join(" ")
        : def.type === "weapon"
          ? [def.physical > 0 && t("others.physPlus", { n: def.physical }), def.magic > 0 && t("others.magPlus", { n: def.magic })].filter(Boolean).join(" ")
          : def.type === "food"
            ? t("others.food", { n: def.food })
            : "";
    return (
      <button key={c.uid} type="button" className={`mini-card mini-${def.type}`} title={cardTitle(def)} onClick={() => showDetail({ defId: c.defId })}>
        {sprite && <PixelArt sprite={sprite} className="mini-art" />}
        <span className="mini-name">{cardTitle(def)}</span>
        <span className="mini-stat">{stat}</span>
        {extra && <span className="mini-equip">＋{cardTitle(reg.get(extra.defId))}</span>}
      </button>
    );
  };
  const foods = field.filter((c) => reg.get(c.defId).type === "food");
  const heroes = field.filter((c) => reg.get(c.defId).type === "hero");
  const loose = field.filter((c) => reg.get(c.defId).type === "weapon" && !equipped.has(c.uid));
  return (
    <div className="others-field-cards" aria-label={t("others.fieldLabel")}>
      {foods.map((c) => mini(c))}
      {heroes.map((c) => mini(c, equips[c.uid] ? byUid.get(equips[c.uid]!) : undefined))}
      {loose.map((c) => mini(c))}
    </div>
  );
}

/** スタンプを選んで送る（複数人のゲーム中だけ） */
function StampPicker() {
  const [open, setOpen] = useState(false);
  const send = useStore((s) => s.sendStamp);
  const hide = useStore((s) => s.hideStamps);
  const setHide = useStore((s) => s.setHideStamps);
  return (
    <div className="stamp-picker">
      <button type="button" className="ghost stamp-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t("others.stamp")}
      </button>
      {open && (
        <div className="stamp-panel" role="group" aria-label={t("others.stamp")}>
          <div className="stamp-grid">
            {STAMPS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="stamp-btn"
                title={s.label}
                onClick={() => {
                  send(s.id);
                  setOpen(false);
                }}
              >
                <PixelArt sprite={s.sprite} className="stamp-art" />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
          <label className="stamp-mute">
            <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
            {t("others.muteStamps")}
          </label>
        </div>
      )}
    </div>
  );
}

export function OthersPanel() {
  const update = useStore((s) => s.update)!;
  const room = useStore((s) => s.room);
  const { view } = update;
  if (view.players.length < 2) return null;
  return (
    <section className="others panel" aria-label={t("others.title")}>
      <h2>{t("others.title")}</h2>
      {!view.result && room && <StampPicker />}
      <ul className="others-list">
        {view.players.map((p) => {
          const m = room?.members.find((x) => x.id === p.id);
          const turn = view.currentPlayerId === p.id && !view.result;
          const me = p.id === view.viewerId;
          return (
            <li key={p.id} className={`others-item${turn ? " others-turn" : ""}`}>
              <div className="others-name">
                {turn && (
                  <span className="others-mark" aria-label={t("others.turnMark")}>
                    ▶
                  </span>
                )}
                {p.name}
                {me && <span className="others-you">{t("lobby.you")}</span>}
                {m && (m.auto || !m.connected) && <span className="others-off">{m.auto ? t("others.auto") : t("lobby.waitingConnect")}</span>}
              </div>
              <div className="others-stats">
                {t("others.stats", { exp: p.exp, total: p.totalExp, kills: p.kills, hand: p.handCount, deck: p.deckCount, discard: p.discardCount })}
              </div>
              {!me && p.field.length > 0 && <FieldCards field={p.field} equips={view.currentPlayerId === p.id && view.turn?.action === "battle" ? view.turn.equips : {}} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
