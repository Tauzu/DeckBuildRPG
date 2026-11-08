import { findOption, reasonText, useStore } from "../store.js";
import { Card } from "./Card.js";

export function VillageStock() {
  const update = useStore((s) => s.update)!;
  const send = useStore((s) => s.send);
  const { view, legal } = update;
  const visiting = view.step.kind === "village" && legal.waitingForMe && !legal.selection;
  const entries = Object.entries(view.village.stacks);
  const heroes = entries.filter(([id]) => id.startsWith("hero:"));
  const others = entries.filter(([id]) => !id.startsWith("hero:"));

  const renderStack = ([stackId, st]: (typeof entries)[number]) => {
    const opt = findOption(legal.options, (a) => a.type === "buy" && a.stackId === stackId);
    const badge = <span className="stack-count">残{st.count}</span>;
    if (!st.top) {
      return (
        <div key={stackId} className="card-wrap">
          <div className="card card-small card-empty">売り切れ</div>
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
        disabledReason={visiting ? reasonText(opt) : null}
      />
    );
  };

  return (
    <section className="stock panel">
      <h2>村の在庫</h2>
      <div className="stock-row">{heroes.map(renderStack)}</div>
      <div className="stock-row">{others.map(renderStack)}</div>
    </section>
  );
}
