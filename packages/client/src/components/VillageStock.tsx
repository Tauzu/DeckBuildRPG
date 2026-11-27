import { findOption, reasonText, reg, useStore } from "../store.js";
import { Card } from "./Card.js";
import { PlayedCards } from "./PlayedCards.js";
import { t } from "../i18n.js";

export function VillageStock() {
  const update = useStore((s) => s.update)!;
  const send = useStore((s) => s.send);
  const { view, legal } = update;
  const visiting = view.step.kind === "village" && legal.waitingForMe && !legal.selection;
  const choosing = view.step.kind === "chooseAction" && legal.waitingForMe && !legal.selection;
  const entries = Object.entries(view.village.stacks);
  const heroes = entries.filter(([id]) => id.startsWith("hero:"));
  const foods = entries.filter(([id]) => id.startsWith("food_"));
  const weapons = entries.filter(([id]) => !id.startsWith("hero:") && !id.startsWith("food_"));

  const renderStack = ([stackId, st]: (typeof entries)[number]) => {
    const opt = findOption(legal.options, (a) => a.type === "buy" && a.stackId === stackId);
    const badge = <span className="stack-count">{t("stock.left", { n: st.count })}</span>;
    if (!st.top) {
      return (
        <div key={stackId} className="card-wrap">
          <div className="card card-small card-empty">{t("stock.soldOut")}</div>
        </div>
      );
    }
    return (
      <Card
        key={stackId}
        defId={st.top.defId}
        small
        badge={badge}
        onClick={visiting ? () => send({ type: "buy", stackId }) : undefined}
        hint={
          visiting
            ? t("stock.buyHint", { cost: reg.get(st.top.defId).cost ?? 0 })
            : choosing
              ? t("stock.visitHint")
              : null
        }
        disabledReason={visiting ? reasonText(opt) : null}
      />
    );
  };

  return (
    <section className="stock panel">
      <PlayedCards />
      <h2>{t("stock.title")}</h2>
      <div className="stock-row">{heroes.map(renderStack)}</div>
      <div className="stock-row">{foods.map(renderStack)}</div>
      <div className="stock-row">{weapons.map(renderStack)}</div>
    </section>
  );
}
