import type { Action, CardInstance } from "@deckbuild/core";
import { findOption, reasonText, reg, useStore } from "../store.js";
import { battleEffectText, cardName, describeEffect, heroName } from "../text.js";
import { t } from "../i18n.js";
import { Card } from "./Card.js";

/** 場と手札 */
export function PlayerArea() {
  const update = useStore((s) => s.update)!;
  const { view } = update;
  const me = view.players.find((p) => p.id === view.viewerId)!;
  const buys = useStore((s) => s.buys);
  // 食料は枠を増やすだけなので、左に重ねて置き、英雄と武器を見やすくする
  const foods = me.field.filter((c) => reg.get(c.defId).type === "food");
  const others = me.field.filter((c) => reg.get(c.defId).type !== "food");

  return (
    <section className="player-area player-dock panel" aria-label={t("player.areaLabel")}>
      <div className="zone">
        <h2>
          {t("player.field")} <HeroSlots />
        </h2>
        <div className="zone-cards">
          {foods.length > 0 && (
            <div className="field-foods" title={t("player.foodsTitle")}>
              {foods.map((c) => (
                <FieldCard key={c.uid} card={c} />
              ))}
            </div>
          )}
          {others.map((c) => (
            <FieldCard key={c.uid} card={c} />
          ))}
          <EmptySlots />
          {me.field.length === 0 && !slotsShown(update) && <div className="zone-empty">{t("player.fieldEmpty")}</div>}
        </div>
      </div>
      <div className="zone">
        <h2>
          {t("player.hand", { n: me.hand?.length ?? 0 })}{" "}
          <span className="zone-sub">
            {t("player.deck", { n: me.deckCount })}{" "}
            <span key={buys} className={buys > 0 ? "discard-pulse" : undefined}>
              {t("player.discard", { n: me.discardCount })}
            </span>
          </span>
        </h2>
        <div className="zone-cards">
          {me.hand?.map((c) => (
            <HandCard key={c.uid} card={c} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HandCard({ card }: { card: CardInstance }) {
  const update = useStore((s) => s.update)!;
  const send = useStore((s) => s.send);
  const selectedWeapon = useStore((s) => s.selectedWeapon);
  const selectWeapon = useStore((s) => s.selectWeapon);
  const { view, legal } = update;
  const def = reg.get(card.defId);
  const step = view.step.kind;
  const active = legal.waitingForMe && !legal.selection && (step === "village" || step === "battle");

  const option = (pred: (a: Action) => boolean) => findOption(legal.options, pred);

  let onClick: (() => void) | undefined;
  let reason: string | null = null;
  let hint: string | null = null;
  if (active) {
    if (def.type === "food") {
      hint = t("hint.playFood", { n: def.food });
      const o = option((a) => a.type === "playFood" && a.uid === card.uid);
      onClick = () => send({ type: "playFood", uid: card.uid });
      reason = reasonText(o);
    } else if (def.type === "hero") {
      hint =
        step === "battle"
          ? t("hint.playHeroBattle", { effect: def.battleEffect && battleEffectText(def.battleEffect) ? t("hint.playHeroBattleEffect", { text: battleEffectText(def.battleEffect)! }) : "" })
          : def.villageEffect
            ? t("hint.playHeroVillage", { text: describeEffect(def.villageEffect) })
            : t("hint.playHeroNoEffect");
      const o = option((a) => a.type === "playHero" && a.uid === card.uid);
      onClick = () => send({ type: "playHero", uid: card.uid });
      reason = reasonText(o);
    } else if (def.type === "weapon" && step === "battle" && def.ability?.kind === "solo") {
      // 英雄なしで使える武器は、クリックするとそのまま場に出す
      hint = t("hint.soloWeapon");
      const o = option((a) => a.type === "useWeapon" && a.weaponUid === card.uid);
      onClick = () => send({ type: "useWeapon", weaponUid: card.uid });
      reason = reasonText(o);
    } else if (def.type === "weapon" && step === "battle") {
      const canEquip = legal.options.some((o) => o.action.type === "equip" && o.action.weaponUid === card.uid && !o.reason);
      onClick = () => selectWeapon(selectedWeapon === card.uid ? null : card.uid);
      hint = selectedWeapon === card.uid ? t("hint.unselectWeapon") : t("hint.selectWeapon");
      reason = canEquip ? null : t("reason.noHeroToEquip");
    } else {
      reason = step === "village" ? t("reason.goldInVillage") : t("reason.notInBattle");
    }
  }
  if (step === "village" && active && (def.type === "enemy" || def.type === "weapon")) {
    // クリックはできないが、何に使われるかを伝える
    reason = null;
    onClick = undefined;
    hint = def.type === "enemy" ? t("hint.loot", { n: def.gold }) : t("hint.goldCard", { n: def.gold });
  }

  // 集落・撃破直後：レベルアップ・転職のボタン
  const extra = <GrowthButtons card={card} />;

  return (
    <Card
      defId={card.defId}
      small
      onClick={onClick}
      disabledReason={reason}
      hint={hint}
      highlight={selectedWeapon === card.uid ? "selected" : undefined}
    >
      {extra}
    </Card>
  );
}

function FieldCard({ card }: { card: CardInstance }) {
  const update = useStore((s) => s.update)!;
  const send = useStore((s) => s.send);
  const selectedWeapon = useStore((s) => s.selectedWeapon);
  const { view, legal } = update;
  const def = reg.get(card.defId);
  const battle = view.step.kind === "battle" && legal.waitingForMe && view.turn?.action === "battle";
  const equips = view.turn?.action === "battle" ? view.turn.equips : {};
  const equippedTo = Object.entries(equips).find(([, w]) => w === card.uid)?.[0];
  const weaponOf = equips[card.uid];

  let onClick: (() => void) | undefined;
  let reason: string | null = null;
  let highlight: "equip" | undefined;
  let hint: string | null = null;
  if (battle) {
    if (selectedWeapon && def.type === "hero") {
      hint = t("hint.equipHere");
      const o = findOption(legal.options, (a) => a.type === "equip" && a.weaponUid === selectedWeapon && a.heroUid === card.uid);
      onClick = () => send({ type: "equip", weaponUid: selectedWeapon, heroUid: card.uid });
      reason = reasonText(o);
      if (!reason) highlight = "equip";
    } else {
      const o = findOption(legal.options, (a) => a.type === "undoBattleCard" && a.uid === card.uid);
      hint = t("hint.returnToHand");
      onClick = () => send({ type: "undoBattleCard", uid: card.uid });
      reason = reasonText(o);
    }
  }

  const me = view.players.find((p) => p.id === view.viewerId);
  const weaponDefId = weaponOf ? me?.field.find((c) => c.uid === weaponOf)?.defId : undefined;
  const badge = weaponDefId ? (
    <span className="equip-badge" title={t("player.equipped", { name: cardName(reg.get(weaponDefId)) })}>
      {t("player.equipped", { name: cardName(reg.get(weaponDefId)) })}
    </span>
  ) : equippedTo ? (
    <span className="equip-badge">{t("player.equippedBadge")}</span>
  ) : null;

  return (
    <Card defId={card.defId} small onClick={onClick} disabledReason={reason} hint={hint} highlight={highlight} badge={badge}>
      {view.step.kind === "afterBattle" ? <GrowthButtons card={card} /> : null}
    </Card>
  );
}

/** レベルアップ・転職のボタン（集落の手札、撃破直後の手札と場） */
function GrowthButtons({ card }: { card: CardInstance }) {
  const update = useStore((s) => s.update)!;
  const send = useStore((s) => s.send);
  const classChangeFor = useStore((s) => s.classChangeFor);
  const setClassChange = useStore((s) => s.setClassChange);
  const { view, legal } = update;
  const def = reg.get(card.defId);
  const step = view.step.kind;
  const growing = legal.waitingForMe && !legal.selection && (step === "village" || step === "afterBattle");
  const option = (pred: (a: Action) => boolean) => findOption(legal.options, pred);

  let extra = null;
  if (growing && def.type === "hero") {
    if (def.level === 0) {
      const any = legal.options.find((o) => o.action.type === "changeClass" && o.action.uid === card.uid && !o.reason);
      const first = legal.options.find((o) => o.action.type === "changeClass" && o.action.uid === card.uid);
      extra =
        classChangeFor === card.uid ? (
          <div className="class-picker">
            {view.config.heroIds.map((heroId) => {
              const o = option((a) => a.type === "changeClass" && a.uid === card.uid && a.heroId === heroId);
              const r = reasonText(o);
              return (
                <button
                  key={heroId}
                  type="button"
                  className="mini"
                  disabled={!!r}
                  title={r ?? undefined}
                  onClick={() => send({ type: "changeClass", uid: card.uid, heroId })}
                >
                  {heroName(heroId)}
                </button>
              );
            })}
            <button type="button" className="mini ghost" onClick={() => setClassChange(null)}>
              {t("player.cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="mini"
            disabled={!any}
            title={any ? undefined : (reasonText(first) ?? undefined)}
            onClick={() => setClassChange(card.uid)}
          >
            {t("player.changeClass", { n: view.config.changeClassExp })}
          </button>
        );
    } else if (def.nextLevelExp !== null) {
      const o = option((a) => a.type === "levelUp" && a.uid === card.uid);
      const r = reasonText(o);
      extra = (
        <button
          type="button"
          className="mini"
          disabled={!!r}
          title={r ?? undefined}
          onClick={() => send({ type: "levelUp", uid: card.uid })}
        >
          {t("player.levelUp", { n: def.nextLevelExp })}
        </button>
      );
    }
  }

  return extra;
}

/** 英雄の枠を見せる場面か（自分の手番で、集落か戦闘中） */
function slotsShown(u: { view: { currentPlayerId: string; viewerId: string; step: { kind: string }; turn: unknown } }): boolean {
  const { view } = u;
  return view.currentPlayerId === view.viewerId && (view.step.kind === "village" || view.step.kind === "battle") && !!view.turn;
}

/** 見出しの横：英雄の枠の数 */
function HeroSlots() {
  const update = useStore((s) => s.update)!;
  if (!slotsShown(update)) return null;
  const { total, used } = update.info.slots;
  return (
    <span className="hero-slots" aria-label={t("slots.label", { used, total })}>
      {t("slots.title")} <strong>{used}</strong> / {total}
    </span>
  );
}

/** 場に、空いている英雄の枠をカードと同じ形で並べる。枠がなければ「食料で増える」枠を1つ出す */
function EmptySlots() {
  const update = useStore((s) => s.update)!;
  if (!slotsShown(update)) return null;
  const { total, used } = update.info.slots;
  const free = update.view.config.freeHeroSlots;
  const left = Math.max(0, total - used);
  if (left === 0) {
    return (
      <div className="card-wrap">
        <div className="card card-small slot-card slot-card-none" title={t("slots.noneTitle")}>
          <span className="slot-card-title">{t("slots.none")}</span>
          <span className="slot-card-text">{t("slots.noneText")}</span>
        </div>
      </div>
    );
  }
  return (
    <>
      {Array.from({ length: left }, (_, i) => (
        <div key={i} className="card-wrap">
          <div
            className="card card-small slot-card"
            title={t("slots.freeTitle", { n: free })}
          >
            <span className="slot-card-title">{t("slots.title")}</span>
            <span className="slot-card-text">{t("slots.emptyText")}</span>
          </div>
        </div>
      ))}
    </>
  );
}
