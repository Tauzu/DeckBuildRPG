import type { CardDef } from "@deckbuild/core";
import type { ReactNode } from "react";
import { PixelArt } from "../art/PixelArt.js";
import { spriteFor } from "../art/sprites.js";
import { useLongPress } from "../hooks.js";
import { reg, useStore } from "../store.js";
import { affinityText, cardName, packText, battleEffectText, cardTitle, describeEffect, describeTrait, describeWeaponAbility, resistText } from "../text.js";
import { t } from "../i18n.js";

interface Props {
  defId: string;
  onClick?: (() => void) | undefined;
  /** できない理由（あれば押せない表示にする） */
  disabledReason?: string | null | undefined;
  highlight?: "target" | "selected" | "equip" | undefined;
  /** 敵の生命力（ボスは人数で変わるため外から渡す） */
  hp?: number | undefined;
  /** 敵に残っているダメージ */
  damage?: number | undefined;
  /** 凍結中の敵。fresh は次の進軍で動かない、thawing は次の進軍で解けて動く */
  frozen?: FrozenState | undefined;
  /** 護衛に守られていて選べない敵 */
  guarded?: boolean | undefined;
  small?: boolean;
  /** 進軍の演出で、同じカードの位置を追うための ID（敵カードに渡す） */
  uid?: string | undefined;
  /** マウスを乗せたときの説明（クリックすると何が起きるか）。押せないときは disabledReason を出す */
  hint?: string | null | undefined;
  badge?: ReactNode;
  children?: ReactNode;
}

export type FrozenState = "fresh" | "thawing";

/** 凍結中の敵の説明（カードのマークと、カードを指したときの説明に使う） */
export function frozenText(state: FrozenState): string {
  return t(`frozen.${state}`);
}

export function Card({ defId, onClick, disabledReason, highlight, hp, damage, frozen, guarded, small, uid, hint, badge, children }: Props) {
  const def = reg.get(defId);
  const clickable = !!onClick && !disabledReason;
  const classes = [
    "card",
    `card-${def.type}`,
    def.type === "enemy" && def.isBoss ? "card-boss" : "",
    small ? "card-small" : "",
    clickable ? "card-clickable" : "",
    onClick && disabledReason ? "card-disabled" : "",
    highlight ? `card-${highlight}` : "",
    frozen ? "card-frozen" : "",
    guarded ? "card-guarded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const tip = onClick && disabledReason ? disabledReason : hint;
  const showDetail = useStore((s) => s.showDetail);
  const openDetail = () => showDetail({ defId, hp, damage, tip });
  const press = useLongPress(openDetail);
  return (
    <div className="card-wrap" data-uid={uid} onContextMenu={(e) => e.preventDefault()}>
      <button
        type="button"
        className={classes}
        {...press.handlers}
        onClick={(e) => {
          // 長押しで詳細を開いたときは、指を離したときのクリックを無視する
          if (press.fired()) {
            e.preventDefault();
            return;
          }
          if (clickable) onClick?.();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          openDetail();
        }}
        aria-disabled={!clickable}
        aria-description={tip ?? undefined}
      >
        <div className="card-head">
          <span className="card-type">{t(`type.${def.type}`)}</span>
          {def.cost !== null && <span className="card-cost" title={t("card.cost")}>{def.cost}</span>}
        </div>
        <div className="card-name">{cardTitle(def)}</div>
        <CardArt def={def} />
        <CardBody def={def} hp={hp} damage={damage} />
        <div className="card-foot">
          <span className="card-gold" title={t("card.goldValue")}>
            {t("card.gold", { n: def.gold })}
          </span>
          {frozen && (
            <span className={`card-state card-state-frozen${frozen === "thawing" ? " card-state-thawing" : ""}`} title={frozenText(frozen)}>
              {frozen === "thawing" ? t("card.thawing") : t("card.frozen")}
            </span>
          )}
          {guarded && <span className="card-state card-state-guarded" title={t("card.guardedTitle")}>{t("card.guarded")}</span>}
          {badge}
        </div>
      </button>
      {tip && (
        <span className={`card-tip${onClick && disabledReason ? " card-tip-ng" : ""}`} role="tooltip">
          {tip}
          <span className="card-tip-hint">{t("card.zoomHint")}</span>
        </span>
      )}
      {children && <div className="card-extra">{children}</div>}
    </div>
  );
}

function CardBody({ def, hp, damage }: { def: CardDef; hp?: number | undefined; damage?: number | undefined }) {
  switch (def.type) {
    case "hero":
      return (
        <div className="card-body">
          <div className="stats">
            <span className="stat-phys" title={t("card.physicalTitle")}>{t("card.physical", { n: def.physical })}</span>
            <span className="stat-mag" title={t("card.magicTitle")}>{t("card.magic", { n: def.magic })}</span>
          </div>
          {def.villageEffect && <div className="card-text">{t("card.village", { text: describeEffect(def.villageEffect) })}</div>}
          {def.battleEffect && battleEffectText(def.battleEffect) && <div className="card-text">{t("card.battle", { text: battleEffectText(def.battleEffect)! })}</div>}
          {def.goldAttackDiv > 0 && (
            <div className="card-text">{def.goldAttackDiv === 2 ? t("card.goldAttackHalf") : t("card.goldAttackDiv", { n: def.goldAttackDiv })}</div>
          )}
          {def.packBonus && <div className="card-text">{packText(def.packBonus, cardName(def))}</div>}
          {def.defeatExp > 0 && <div className="card-text">{t("card.defeatExp", { n: def.defeatExp })}</div>}
          {def.ignoreHalfResist && <div className="card-text">{t("card.ignoreHalf")}</div>}
          {def.nextLevelExp !== null && <div className="card-note">{t("card.nextLevel", { n: def.nextLevelExp })}</div>}
          {def.level === 0 && <div className="card-note">{t("card.promote")}</div>}
        </div>
      );
    case "weapon":
      return (
        <div className="card-body">
          <div className="stats">
            {def.physical > 0 && <span className="stat-phys">{t("card.physicalPlus", { n: def.physical })}</span>}
            {def.magic > 0 && <span className="stat-mag">{t("card.magicPlus", { n: def.magic })}</span>}
          </div>
          {def.ability && <div className="card-text">{describeWeaponAbility(def.ability)}</div>}
          {def.affinity && <div className="card-text">{affinityText(def.affinity)}</div>}
          <div className="card-note">{def.ability?.kind === "solo" ? t("card.soloWeapon") : t("card.equipOne")}</div>
        </div>
      );
    case "food":
      return (
        <div className="card-body">
          <div className="stats">
            <span className="stat-food">{t("card.food", { n: def.food })}</span>
          </div>
          {def.effect && <div className="card-text">{t("card.village", { text: describeEffect(def.effect) })}</div>}
          {def.effect && def.effectInBattle && <div className="card-text">{t("card.battle", { text: describeEffect(def.effect) })}</div>}
          <div className="card-note">{t("card.foodNote", { n: def.food })}</div>
        </div>
      );
    case "enemy": {
      const rp = resistText(def.resistPhysical);
      const rm = resistText(def.resistMagic);
      return (
        <div className="card-body">
          <div className="stats">
            <span className="stat-hp" title={t("card.hpTitle")}>
              {t("card.hp", { n: damage ? `${(hp ?? def.hp ?? 0) - damage}/${hp ?? def.hp}` : (hp ?? def.hp ?? "") })}
            </span>
            {def.invasion !== null && <span title={t("card.invasionTitle")}>{t("card.invasion", { n: def.invasion })}</span>}
            <span title={t("card.expTitle")}>{t("card.exp", { n: def.exp })}</span>
          </div>
          {(rp || rm) && (
            <div className="card-text resist">
              {rp && <span>{t("card.resistPhysical", { r: rp })}</span>}
              {rm && <span>{t("card.resistMagic", { r: rm })}</span>}
            </div>
          )}
          {def.traits.map((tr) => (
            <div key={tr} className="card-text">{describeTrait(tr)}</div>
          ))}
          {def.onReveal && <div className="card-text">{t("card.onReveal", { text: describeEffect(def.onReveal) })}</div>}
          {def.onMarch && <div className="card-text">{t("card.onMarch", { text: describeEffect(def.onMarch) })}</div>}
          {def.isBoss && hp !== undefined && (
            <div className="boss-gauge" title={t("card.bossHpTitle", { n: hp - (damage ?? 0), hp })}>
              <div style={{ width: `${Math.max(0, ((hp - (damage ?? 0)) / hp) * 100)}%` }} />
            </div>
          )}
          {def.isBoss && <div className="card-note">{t("card.bossNote")}</div>}
          {!def.isBoss && <div className="card-note">{t("card.lootNote")}</div>}
        </div>
      );
    }
    case "curse":
      return (
        <div className="card-body">
          <div className="card-text">{t("card.curseText")}</div>
        </div>
      );
  }
}

/** カードの絵（ドット絵） */
function CardArt({ def }: { def: CardDef }) {
  const sprite = spriteFor(def.id, def.type === "hero" ? def.heroId : undefined);
  if (!sprite) return null;
  return (
    <div className="card-art">
      <PixelArt sprite={sprite} />
    </div>
  );
}
