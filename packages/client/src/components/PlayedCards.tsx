// 手番中の他のプレイヤーが場に出したカード。戦闘のダメージ見込み・村の在庫と同じ場所に出し、すぐ見て分かるようにする
import type { CardInstance } from "@deckbuild/core";
import { reg, useStore } from "../store.js";
import { Card } from "./Card.js";
import { t } from "../i18n.js";

export function PlayedCards() {
  const update = useStore((s) => s.update)!;
  const { view } = update;
  const cur = view.players.find((p) => p.id === view.currentPlayerId);
  if (!cur || cur.id === view.viewerId || view.result || cur.field.length === 0) return null;

  const equips = view.turn?.action === "battle" ? view.turn.equips : {};
  const equipped = new Set(Object.values(equips));
  const byUid = new Map(cur.field.map((c) => [c.uid, c]));
  const type = (c: CardInstance) => reg.get(c.defId).type;
  const card = (c: CardInstance) => <Card key={c.uid} defId={c.defId} small />;

  const foods = cur.field.filter((c) => type(c) === "food");
  const heroes = cur.field.filter((c) => type(c) === "hero");
  const loose = cur.field.filter((c) => type(c) === "weapon" && !equipped.has(c.uid));

  return (
    <div className="played" aria-label={t("played.title", { name: cur.name })}>
      <div className="played-title">{t("played.title", { name: cur.name })}</div>
      <div className="played-cards">
        {foods.map(card)}
        {heroes.map((h) => {
          const w = equips[h.uid] ? byUid.get(equips[h.uid]!) : undefined;
          return w ? (
            <div key={h.uid} className="played-pair">
              {card(h)}
              <span className="played-plus" aria-label={t("played.equip")}>＋</span>
              {card(w)}
            </div>
          ) : (
            card(h)
          );
        })}
        {loose.map(card)}
      </div>
    </div>
  );
}
