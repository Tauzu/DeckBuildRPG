import type { Action, CardInstance } from "@deckbuild/core";
import { findOption, reasonText, reg, useStore } from "../store.js";
import { describeEffect, HERO_NAMES } from "../text.js";
import { Card } from "./Card.js";

/** 場と手札 */
export function PlayerArea() {
  const update = useStore((s) => s.update)!;
  const { view } = update;
  const me = view.players.find((p) => p.id === view.viewerId)!;

  return (
    <section className="player-area player-dock panel" aria-label="場と手札">
      <div className="zone">
        <h2>
          場 <HeroSlots />
        </h2>
        <div className="zone-cards">
          {me.field.length === 0 && <div className="zone-empty">（まだ何も出していません）</div>}
          {me.field.map((c) => (
            <FieldCard key={c.uid} card={c} />
          ))}
        </div>
      </div>
      <div className="zone">
        <h2>
          手札 <span className="zone-sub">山札 {me.deckCount}枚 ／ 捨て札 {me.discardCount}枚</span>
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
      hint = `クリックで場に出す（英雄を出せる枠+${def.food}）`;
      const o = option((a) => a.type === "playFood" && a.uid === card.uid);
      onClick = () => send({ type: "playFood", uid: card.uid });
      reason = reasonText(o);
    } else if (def.type === "hero") {
      hint =
        step === "battle"
          ? "クリックで場に出して戦わせる"
          : def.villageEffect
            ? `クリックで場に出す（村効果：${describeEffect(def.villageEffect)}）`
            : "クリックで場に出す（村効果はない。集落では金価値として使う）";
      const o = option((a) => a.type === "playHero" && a.uid === card.uid);
      onClick = () => send({ type: "playHero", uid: card.uid });
      reason = reasonText(o);
    } else if (def.type === "weapon" && step === "battle" && def.ability?.kind === "solo") {
      // 英雄なしで使える武器は、クリックするとそのまま場に出す
      hint = "クリックで、装備せずにそのまま戦闘に加える";
      const o = option((a) => a.type === "useWeapon" && a.weaponUid === card.uid);
      onClick = () => send({ type: "useWeapon", weaponUid: card.uid });
      reason = reasonText(o);
    } else if (def.type === "weapon" && step === "battle") {
      const canEquip = legal.options.some((o) => o.action.type === "equip" && o.action.weaponUid === card.uid && !o.reason);
      onClick = () => selectWeapon(selectedWeapon === card.uid ? null : card.uid);
      hint = selectedWeapon === card.uid ? "クリックで選ぶのをやめる" : "クリックしてから、装備させる英雄（場）をクリック";
      reason = canEquip ? null : "装備できる英雄が場にいません";
    } else {
      reason = step === "village" ? "集落では金価値として使います" : "戦闘では使えません";
    }
  }
  if (step === "village" && active && (def.type === "enemy" || def.type === "weapon")) {
    // クリックはできないが、何に使われるかを伝える
    reason = null;
    onClick = undefined;
    hint = def.type === "enemy" ? `戦利品：金${def.gold}として使われ、訪問の終わりに売却される` : `集落では金${def.gold}として使われる（戦闘で装備する）`;
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
      hint = "クリックでこの英雄に、選んだ武器を装備させる";
      const o = findOption(legal.options, (a) => a.type === "equip" && a.weaponUid === selectedWeapon && a.heroUid === card.uid);
      onClick = () => send({ type: "equip", weaponUid: selectedWeapon, heroUid: card.uid });
      reason = reasonText(o);
      if (!reason) highlight = "equip";
    } else {
      const o = findOption(legal.options, (a) => a.type === "undoBattleCard" && a.uid === card.uid);
      hint = "クリックで手札に戻す";
      onClick = () => send({ type: "undoBattleCard", uid: card.uid });
      reason = reasonText(o);
    }
  }

  const me = view.players.find((p) => p.id === view.viewerId);
  const weaponDefId = weaponOf ? me?.field.find((c) => c.uid === weaponOf)?.defId : undefined;
  const badge = weaponDefId ? (
    <span className="equip-badge">装備：{reg.get(weaponDefId).name}</span>
  ) : equippedTo ? (
    <span className="equip-badge">装備中</span>
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
                  {HERO_NAMES[heroId] ?? heroId}
                </button>
              );
            })}
            <button type="button" className="mini ghost" onClick={() => setClassChange(null)}>
              やめる
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
            転職（経験値{view.config.changeClassExp}）
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
          Lvアップ（経験値{def.nextLevelExp}）
        </button>
      );
    }
  }

  return extra;
}

/** 英雄を出せる枠（使った枠と残りの枠）を並べて見せる */
function HeroSlots() {
  const update = useStore((s) => s.update)!;
  const { view, info } = update;
  const mine = view.currentPlayerId === view.viewerId;
  const step = view.step.kind;
  if (!mine || (step !== "village" && step !== "battle") || !view.turn) return null;
  const { total, used } = info.slots;
  const free = view.config.freeHeroSlots;
  const pips = Array.from({ length: Math.max(total, used) }, (_, i) => i < used);
  return (
    <span
      className="hero-slots"
      title={`英雄は${free}人まで食料なしで出せる。食料を出すと、食糧値の分だけ枠が増える`}
      aria-label={`英雄の枠 ${used} / ${total}`}
    >
      <span className="hero-slots-label">英雄の枠</span>
      {pips.map((filled, i) => (
        <span key={i} className={`hero-slot${filled ? " hero-slot-used" : ""}${i < free ? " hero-slot-free" : ""}`} />
      ))}
      <span className="hero-slots-count">
        残り {Math.max(0, total - used)}
      </span>
      {total - used <= 0 && <span className="hero-slots-tip">食料を出すと枠が増える</span>}
    </span>
  );
}
