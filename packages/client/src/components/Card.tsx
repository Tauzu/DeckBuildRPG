import type { CardDef } from "@deckbuild/core";
import type { ReactNode } from "react";
import { PixelArt } from "../art/PixelArt.js";
import { spriteFor } from "../art/sprites.js";
import { reg } from "../store.js";
import { cardTitle, describeEffect, describeWeaponAbility, resistText } from "../text.js";

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
  small?: boolean;
  /** マウスを乗せたときの説明（クリックすると何が起きるか）。押せないときは disabledReason を出す */
  hint?: string | null | undefined;
  badge?: ReactNode;
  children?: ReactNode;
}

const TYPE_LABEL: Record<CardDef["type"], string> = {
  hero: "英雄",
  weapon: "武器",
  food: "食料",
  enemy: "敵",
  curse: "呪い",
};

export function Card({ defId, onClick, disabledReason, highlight, hp, damage, small, hint, badge, children }: Props) {
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
  ]
    .filter(Boolean)
    .join(" ");

  const tip = onClick && disabledReason ? disabledReason : hint;
  return (
    <div className="card-wrap">
      <button
        type="button"
        className={classes}
        onClick={clickable ? onClick : undefined}
        aria-disabled={!clickable}
        aria-description={tip ?? undefined}
      >
        <div className="card-head">
          <span className="card-type">{TYPE_LABEL[def.type]}</span>
          {def.cost !== null && <span className="card-cost" title="コスト">{def.cost}</span>}
        </div>
        <div className="card-name">{cardTitle(def)}</div>
        <CardArt def={def} />
        <CardBody def={def} hp={hp} damage={damage} />
        <div className="card-foot">
          <span className="card-gold" title="金価値">
            金 {def.gold}
          </span>
          {badge}
        </div>
      </button>
      {tip && (
        <span className={`card-tip${onClick && disabledReason ? " card-tip-ng" : ""}`} role="tooltip">
          {tip}
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
            <span className="stat-phys" title="物理攻撃力">物 {def.physical}</span>
            <span className="stat-mag" title="魔法攻撃力">魔 {def.magic}</span>
          </div>
          {def.villageEffect && <div className="card-text">村：{describeEffect(def.villageEffect)}</div>}
          {def.nextLevelExp !== null && <div className="card-note">次のLvまで 経験値{def.nextLevelExp}</div>}
          {def.level === 0 && <div className="card-note">経験値2で転職できる</div>}
        </div>
      );
    case "weapon":
      return (
        <div className="card-body">
          <div className="stats">
            {def.physical > 0 && <span className="stat-phys">物 +{def.physical}</span>}
            {def.magic > 0 && <span className="stat-mag">魔 +{def.magic}</span>}
          </div>
          {def.ability && <div className="card-text">{describeWeaponAbility(def.ability)}</div>}
          <div className="card-note">{def.ability?.kind === "solo" ? "装備せずにそのまま出す" : "英雄1人に1枚装備"}</div>
        </div>
      );
    case "food":
      return (
        <div className="card-body">
          <div className="stats">
            <span className="stat-food">食糧 {def.food}</span>
          </div>
          <div className="card-note">英雄を追加で{def.food}人出せる</div>
        </div>
      );
    case "enemy": {
      const rp = resistText(def.resistPhysical);
      const rm = resistText(def.resistMagic);
      return (
        <div className="card-body">
          <div className="stats">
            <span className="stat-hp" title="生命力">
              命 {damage ? `${(hp ?? def.hp ?? 0) - damage}/${hp ?? def.hp}` : (hp ?? def.hp)}
            </span>
            {def.invasion !== null && <span title="侵攻力（集落に着いたときに減らす耐久値）">侵 {def.invasion}</span>}
            <span title="経験値">経 {def.exp}</span>
          </div>
          {(rp || rm) && (
            <div className="card-text resist">
              {rp && <span>物理{rp}</span>}
              {rm && <span>魔法{rm}</span>}
            </div>
          )}
          {def.onReveal && <div className="card-text">出現：{describeEffect(def.onReveal)}</div>}
          {def.onMarch && <div className="card-text">進軍：{describeEffect(def.onMarch)}</div>}
          {def.isBoss && hp !== undefined && (
            <div className="boss-gauge" title={`残り生命力 ${hp - (damage ?? 0)} / ${hp}`}>
              <div style={{ width: `${Math.max(0, ((hp - (damage ?? 0)) / hp) * 100)}%` }} />
            </div>
          )}
          {def.isBoss && <div className="card-note">ダメージは残る</div>}
          {!def.isBoss && <div className="card-note">倒すと戦利品になる</div>}
        </div>
      );
    }
    case "curse":
      return (
        <div className="card-body">
          <div className="card-text">何の効果もない。僧侶で廃棄できる</div>
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
