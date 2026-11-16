import { useLayoutEffect, useRef } from "react";
import { findOption, reasonText, reg, useStore } from "../store.js";
import { enemyHp, guardedUids } from "@deckbuild/core";
import { PixelArt } from "../art/PixelArt.js";
import { fortSprite, villageSprite } from "../art/sprites.js";
import { StageBackdrop } from "../art/StageBackdrop.js";
import { Card } from "./Card.js";

export function RouteView() {
  const update = useStore((s) => s.update)!;
  const send = useStore((s) => s.send);
  const { view, legal } = update;
  const choosing = view.step.kind === "chooseAction" && legal.waitingForMe;
  const target = view.turn?.action === "battle" ? view.turn.targetUid : null;
  // 凍結・後退の対象を、進軍ルートの敵から選ぶ
  const picking = legal.waitingForMe && legal.selection?.kind === "target" ? legal.selection : null;
  const guarded = guardedUids(view, reg);
  const villageHits = useStore((s) => s.villageHits);
  const marches = useStore((s) => s.marches);
  const squaresRef = useRef<HTMLDivElement>(null);
  useMarchMotion(squaresRef, view.route, marches);

  return (
    <section className="route panel">
      <StageBackdrop name={reg.stage(view.config.stageId).backdrop ?? "plains"} />
      <div className="route-end route-fort">
        <PixelArt sprite={fortSprite} className="route-end-art" />
        <div className="route-end-title">魔物の砦</div>
        <div className="route-end-sub">敵の山札 残り {view.enemyDeckCount}枚</div>
      </div>
      <div ref={squaresRef} className="route-squares">
        {marches > 0 && <div key={`sweep-${marches}`} className="route-sweep" />}
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
                    uid={c.uid}
                    hp={enemyHp(view, def)}
                    damage={view.enemyDamage[c.uid]}
                    frozen={view.frozen.includes(c.uid)}
                    guarded={guarded.has(c.uid)}
                    highlight={target === c.uid ? "target" : picking?.uids.includes(c.uid) ? "selected" : undefined}
                    onClick={
                      picking
                        ? picking.uids.includes(c.uid)
                          ? () => send({ type: "chooseTarget", targetUid: c.uid })
                          : undefined
                        : choosing
                          ? () => send({ type: "chooseBattle", targetUid: c.uid })
                          : undefined
                    }
                    hint={
                      target === c.uid
                        ? "戦闘中の相手"
                        : picking
                          ? picking.uids.includes(c.uid)
                            ? picking.mode === "freeze"
                              ? "クリックで凍結する（次の進軍で動かない）"
                              : "クリックで1マス戻す"
                            : "この敵は選べません"
                          : choosing
                          ? def.isBoss
                            ? "クリックでこのボスと戦う（与えたダメージは次の手番も残る）"
                            : "クリックでこの魔物と戦う"
                          : null
                    }
                    disabledReason={picking ? (picking.uids.includes(c.uid) ? null : "この敵は選べません") : choosing ? reasonText(opt) : null}
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

/**
 * 進軍の演出：敵カードを uid で追い、前の位置から今の位置へ滑らせる（全部消えて出直すのではなく、隣のマスへ移る）。
 * 新しく出た敵は、進軍のときは砦の側（左）から入ってくる。倒された敵は、そのまま消える。
 */
function useMarchMotion(ref: React.RefObject<HTMLDivElement | null>, route: unknown, marches: number) {
  const prev = useRef<Map<string, { x: number; y: number }> | null>(null);
  const prevMarches = useRef(marches);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    // 動いている途中の演出は止めてから、本来の位置を測る
    const cards = [...box.querySelectorAll<HTMLElement>(".card-wrap[data-uid]")];
    for (const el of cards) el.getAnimations?.().forEach((a) => a.cancel());
    const origin = box.getBoundingClientRect();
    const now = new Map<string, { x: number; y: number }>();
    for (const el of cards) {
      const r = el.getBoundingClientRect();
      now.set(el.dataset.uid!, { x: r.left - origin.left, y: r.top - origin.top });
    }
    const before = prev.current;
    const marched = marches !== prevMarches.current;
    prev.current = now;
    prevMarches.current = marches;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!before || reduced || typeof cards[0]?.animate !== "function") return;
    const delay = marched ? 450 : 0; // 撃破の演出が終わるのを待ってから動く
    for (const el of cards) {
      const was = before.get(el.dataset.uid!);
      const at = now.get(el.dataset.uid!)!;
      if (was) {
        const dx = was.x - at.x;
        const dy = was.y - at.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
          duration: 500,
          delay,
          easing: "steps(8, end)",
          fill: "backwards",
        });
      } else if (marched) {
        el.animate(
          [
            { opacity: 0.2, transform: "translateX(-90px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 600, delay, easing: "steps(7, end)", fill: "backwards" },
        );
      } else {
        el.animate([{ opacity: 0, transform: "translateY(10px) scale(0.96)" }, { opacity: 1, transform: "none" }], {
          duration: 240,
          easing: "steps(3, end)",
          fill: "backwards",
        });
      }
    }
  }, [route, marches, ref]);
}
