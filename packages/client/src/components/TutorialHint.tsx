// チュートリアルの案内（企画書 12.3）。状況に合わせてヒントを出すだけで、操作は自由
import type { GameUpdate } from "../connection.js";
import { reg, useStore } from "../store.js";
import { cardName, touchText } from "../text.js";
import { t } from "../i18n.js";

/** 初めて出たときにダイアログでも見せる案内（操作の途中で出るものは除く） */
const MODAL_KEYS = new Set(["start", "appear", "close", "boss", "villageBuy", "villageHero", "villageLevel", "battle", "battleBoss", "afterLevel"]);

export function TutorialHint() {
  const update = useStore((s) => s.update)!;
  const hide = useStore((s) => s.hideHints);
  const setHide = useStore((s) => s.setHideHints);
  const seen = useStore((s) => s.seenHints);
  const markSeen = useStore((s) => s.markHintSeen);
  const stage = reg.stage(update.view.config.stageId);
  if (!stage.tutorial || update.view.result) return null;
  const hint = currentHint(update);
  // タッチの端末では「タップ」と言い換え、最初の案内で長押しのことも伝える
  const touch = window.matchMedia("(hover: none)").matches;
  const text = touchText(hint.text) + (touch && hint.key === "start" ? t("tut.longPress") : "");
  const modal = !hide && hint.key !== "" && MODAL_KEYS.has(hint.key) && !seen.includes(hint.key);

  if (hide) {
    return (
      <div className="tutorial-hint tutorial-hint-hidden">
        <button type="button" className="ghost mini" onClick={() => setHide(false)}>
          {t("tut.show")}
        </button>
      </div>
    );
  }
  return (
    <aside className="tutorial-hint panel" aria-live="polite">
      <div className="tutorial-hint-head">
        <span className="tutorial-hint-label">{t("tut.label")}</span>
        <button type="button" className="ghost mini" onClick={() => setHide(true)}>
          {t("tut.hide")}
        </button>
      </div>
      <p>{text}</p>
      {modal && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-modal-title">
          <div className="dialog panel tutorial-modal">
            <h2 id="tutorial-modal-title">{t("tut.label")}</h2>
            <p>{text}</p>
            <div className="dialog-buttons">
              <button type="button" className="ghost" onClick={() => setHide(true)}>
                {t("tut.never")}
              </button>
              <button type="button" className="primary" autoFocus onClick={() => markSeen(hint.key)}>
                {t("tut.ok")}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

/** 今の状況に合ったヒントの文 */
export function hintText(u: GameUpdate): string {
  return currentHint(u).text;
}

/** 今の状況に合ったヒント。key は案内の種類 */
function currentHint(u: GameUpdate): { key: string; text: string } {
  const h = (key: string, text: string) => ({ key, text });
  const { view, legal } = u;
  const me = view.players.find((p) => p.id === view.viewerId)!;
  const hand = me.hand ?? [];
  const types = hand.map((c) => reg.get(c.defId));
  const enemies = view.route.flat();
  const boss = enemies.find((c) => reg.enemy(c.defId).isBoss);
  const canLevelUp = legal.options.some((o) => (o.action.type === "levelUp" || o.action.type === "changeClass") && !o.reason);

  if (legal.selection?.kind === "discard") return h("discard", t("tut.discard"));

  switch (view.step.kind) {
    case "chooseAction": {
      if (boss) {
        const hp = view.config.bossHp - (view.enemyDamage[boss.uid] ?? 0);
        const sq = view.route.findIndex((s) => s.some((c) => c.uid === boss.uid));
        const left = view.route.length - sq;
        return h("boss", t("tut.boss", { boss: cardName(reg.get(boss.defId)), hp, left }));
      }
      if (enemies.length === 0) {
        return h("start", t("tut.start"));
      }
      const close = view.route.slice(3).some((sq) => sq.length > 0);
      return close
        ? h("close", t("tut.close"))
        : h("appear", t("tut.appear"));
    }
    case "village": {
      if (canLevelUp) {
        return h("villageLevel", t("tut.villageLevel"));
      }
      const heroInHand = types.some((d) => d.type === "hero" && d.villageEffect);
      if (heroInHand) {
        return h("villageHero", t("tut.villageHero"));
      }
      return h("villageBuy", t("tut.villageBuy", { gold: u.info.gold }));
    }
    case "battle": {
      const p = u.info.preview;
      if (p && p.prevDamage + p.total >= p.hp) {
        return h("battleKill", t("tut.battleKill"));
      }
      const targetUid = view.turn?.action === "battle" ? view.turn.targetUid : null;
      const target = enemies.find((c) => c.uid === targetUid);
      if (p && target && reg.enemy(target.defId).isBoss && p.total > 0) {
        return h("battleBoss", t("tut.battleBoss"));
      }
      return h("battle", t("tut.battle"));
    }
    case "afterBattle":
      return canLevelUp
        ? h("afterLevel", t("tut.afterLevel"))
        : h("after", t("tut.after"));
    default:
      return h("", "");
  }
}
