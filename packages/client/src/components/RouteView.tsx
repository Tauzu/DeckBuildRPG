import { findOption, reasonText, reg, useStore } from "../store.js";
import { enemyHp } from "@deckbuild/core";
import { PixelArt } from "../art/PixelArt.js";
import { fortSprite, villageSprite } from "../art/sprites.js";
import { Card } from "./Card.js";

export function RouteView() {
  const update = useStore((s) => s.update)!;
  const send = useStore((s) => s.send);
  const { view, legal } = update;
  const choosing = view.step.kind === "chooseAction" && legal.waitingForMe;
  const target = view.turn?.action === "battle" ? view.turn.targetUid : null;
  const villageHits = useStore((s) => s.villageHits);
  const marches = useStore((s) => s.marches);

  return (
    <section className="route panel">
      <div className="route-end route-fort">
        <PixelArt sprite={fortSprite} className="route-end-art" />
        <div className="route-end-title">魔物の砦</div>
        <div className="route-end-sub">敵の山札 残り {view.enemyDeckCount}枚</div>
      </div>
      <div key={`march-${marches}`} className={`route-squares${marches > 0 ? " route-marching" : ""}`}>
        {view.route.map((square, i) => (
          <div key={i} className={`route-square ${i === view.route.length - 1 ? "route-square-last" : ""}`}>
            <div className="route-square-label">{i + 1}</div>
            <div className="route-square-cards">
              {square.map((c) => {
                const def = reg.enemy(c.defId);
                const opt = findOption(legal.options, (a) => a.type === "chooseBattle" && a.targetUid === c.uid);
                return (
                  <Card
                    key={c.uid}
                    defId={c.defId}
                    small
                    hp={enemyHp(view, def)}
                    damage={view.enemyDamage[c.uid]}
                    highlight={target === c.uid ? "target" : undefined}
                    onClick={choosing ? () => send({ type: "chooseBattle", targetUid: c.uid }) : undefined}
                    hint={
                      target === c.uid
                        ? "戦闘中の相手"
                        : choosing
                          ? def.isBoss
                            ? "クリックでこのボスと戦う（与えたダメージは次の手番も残る）"
                            : "クリックでこの魔物と戦う"
                          : null
                    }
                    disabledReason={choosing ? reasonText(opt) : null}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div key={`village-${villageHits}`} className={`route-end route-village${villageHits > 0 ? " village-hit" : ""}`}>
        <PixelArt sprite={villageSprite} className="route-end-art" />
        <div className="route-end-title">エルム村</div>
        <div className={`village-hp ${view.villageHp <= view.config.villageHp / 3 ? "danger" : ""}`}>
          耐久値 {Math.max(0, view.villageHp)} / {view.config.villageHp}
        </div>
      </div>
    </section>
  );
}
