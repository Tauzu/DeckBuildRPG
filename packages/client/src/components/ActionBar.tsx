import { useState } from "react";
import { findOption, reasonText, reg, useStore } from "../store.js";
import { cardName, resistText, touchText } from "../text.js";
import { t } from "../i18n.js";

/** 今の段階の説明と、今できる操作のボタン */
export function ActionBar() {
  const update = useStore((s) => s.update)!;
  const send = useStore((s) => s.send);
  const selectedWeapon = useStore((s) => s.selectedWeapon);
  const selectWeapon = useStore((s) => s.selectWeapon);
  const [missWarning, setMissWarning] = useState(false);
  const { view, legal, info } = update;
  const me = view.players.find((p) => p.id === view.viewerId)!;
  const step = view.step.kind;
  const myTurn = legal.waitingForMe && !legal.selection;
  const cancel = findOption(legal.options, (a) => a.type === "cancelAction");
  const cancelReason = reasonText(cancel);
  const cancelButton = (
    <button
      type="button"
      className="ghost"
      disabled={!!cancelReason}
      title={cancelReason ?? t("action.cancelTitle")}
      onClick={() => send({ type: "cancelAction" })}
    >
      {t("action.cancel")}
    </button>
  );

  // 撃破したときに進軍がどうなるか（2人以上では、ラウンドで2体以上撃破すると進軍しない）
  const players = view.players.length;
  const defeatsAfter = view.roundDefeats + 1; // この手番の撃破を含める（数えるのは手番の終わり）
  const marchNote = players === 1 ? t("action.marchSolo") : t("action.marchMulti", { n: Math.min(defeatsAfter, 2) });

  let message = "";
  let buttons = null;
  let detail = null;

  if (view.result) {
    message = t("action.gameOver");
  } else if (legal.selection?.kind === "target") {
    message = legal.selection.mode === "freeze" ? t("action.pickFreeze") : t("action.pickPush");
  } else if (legal.selection) {
    message = t("action.choose");
  } else if (!myTurn) {
    const cur = view.players.find((p) => p.id === view.currentPlayerId);
    if (view.pending?.kind === "discard") {
      message = t("action.waitDiscard");
    } else if (view.pending?.kind === "target") {
      message = t("action.waitTarget");
    } else if (cur && cur.id !== view.viewerId) {
      const turn = view.turn;
      const target = turn?.action === "battle" ? view.route.flat().find((c) => c.uid === turn.targetUid) : undefined;
      const doing =
        step === "village"
          ? t("action.doingVillage")
          : step === "battle" && target
            ? t("action.doingBattle", { enemy: cardName(reg.get(target.defId)) })
            : step === "afterBattle"
              ? t("action.doingAfterBattle")
              : t("action.doingChoose");
      message = t("action.othersTurn", { player: cur.name, doing });
      const p = info.preview;
      if (step === "battle" && p) {
        detail = (
          <div className="info-row">
            <span>
              {t("action.previewOther", { total: p.total, hp: p.hp, prev: p.prevDamage > 0 ? t("action.prevDamageInline", { n: p.prevDamage }) : "" })}
            </span>
          </div>
        );
      }
    } else {
      message = t("action.processing");
    }
  } else if (step === "chooseAction") {
    const hasEnemy = view.route.some((sq) => sq.length > 0);
    message = hasEnemy ? t("action.chooseWithEnemy") : t("action.chooseNoEnemy");
    buttons = (
      <button type="button" className="primary" onClick={() => send({ type: "chooseVillage" })}>
        {t("action.visit")}
      </button>
    );
  } else if (step === "village") {
    message = t("action.villageHelp");
    detail = (
      <div className="info-row">
        <span className="info-gold">{t("action.gold", { n: info.gold })}</span>
        <span>{t("action.slots", { used: info.slots.used, total: info.slots.total })}</span>
      </div>
    );
    buttons = (
      <>
        {cancelButton}
        <button type="button" className="primary" onClick={() => send({ type: "endVisit" })}>
          {t("action.endVisit")}
        </button>
      </>
    );
  } else if (step === "battle") {
    const targetUid = view.turn?.action === "battle" ? view.turn.targetUid : null;
    const target = view.route.flat().find((c) => c.uid === targetUid);
    const tdef = target ? reg.enemy(target.defId) : null;
    const p = info.preview;
    message = selectedWeapon ? t("action.pickHero") : t("action.battleHelp");
    const confirm = findOption(legal.options, (a) => a.type === "confirmAttack");
    const rp = tdef && resistText(tdef.resistPhysical);
    const rm = tdef && resistText(tdef.resistMagic);
    const resist = [rp && t("action.resistPhysical", { r: rp }), rm && t("action.resistMagic", { r: rm })].filter(Boolean).join(t("list.dot"));
    detail = (
      <div className="info-row">
        {tdef && (
          <span>{t("action.opponent", { enemy: cardName(tdef), hp: p?.hp ?? "", resist: resist ? t("action.resistInline", { text: resist }) : "" })}</span>
        )}
        <span>{t("action.slots", { used: info.slots.used, total: info.slots.total })}</span>
        {p && p.prevDamage > 0 && <span>{t("action.prevDamage", { n: p.prevDamage })}</span>}
        {p && (
          <span className={p.prevDamage + p.total >= p.hp ? "info-ok" : tdef?.isBoss && p.total > 0 ? "info-boss" : "info-ng"}>
            {t("action.expected", { n: p.total })}
            {(p.physical !== p.physicalAfter || p.magic !== p.magicAfter) &&
              t("action.expectedChange", { p1: p.physical, p2: p.physicalAfter, m1: p.magic, m2: p.magicAfter })}
            {p.prevDamage + p.total >= p.hp
              ? t("action.canDefeat", { march: marchNote })
              : tdef?.isBoss
                ? t("action.bossLeft", { n: p.hp - p.prevDamage - p.total })
                : t("action.short", { n: p.hp - p.prevDamage - p.total })}
          </span>
        )}
      </div>
    );
    buttons = (
      <>
        {cancelButton}
        {selectedWeapon && (
          <button type="button" className="ghost" onClick={() => selectWeapon(null)}>
            {t("action.stopWeapon")}
          </button>
        )}
        <button
          type="button"
          className="primary danger"
          disabled={!!reasonText(confirm)}
          onClick={() => (p && p.prevDamage + p.total < p.hp ? setMissWarning(true) : send({ type: "confirmAttack" }))}
        >
          {t("action.confirm")}
        </button>
        {missWarning && p && p.prevDamage + p.total < p.hp && (
          <MissWarning
            boss={!!tdef?.isBoss}
            name={tdef ? cardName(tdef) : t("action.enemy")}
            total={p.total}
            remaining={p.hp - p.prevDamage - p.total}
            onBack={() => setMissWarning(false)}
            onGo={() => {
              setMissWarning(false);
              send({ type: "confirmAttack" });
            }}
          />
        )}
      </>
    );
  } else if (step === "afterBattle") {
    message = t("action.afterBattle", { march: marchNote });
    buttons = (
      <button type="button" className="primary" onClick={() => send({ type: "finishBattle" })}>
        {t("action.endTurn")}
      </button>
    );
  }

  return (
    <section className="action-bar panel">
      <div className="action-main">
        <div className="action-message">{splitHelp(touchText(message), myTurn && (step === "chooseAction" || step === "village" || step === "battle"))}</div>
        {detail}
      </div>
      <div className="action-side">
        <div className="exp">
          {t("action.exp")} <strong>{me.exp}</strong>
          <span className="exp-total">{t("action.expTotal", { total: me.totalExp, kills: me.kills })}</span>
        </div>
        <div className="action-buttons">{buttons}</div>
      </div>
    </section>
  );
}

/** 「見出し：説明」の説明の部分を、スマートフォンでは隠せるように分ける（英語は「見出し: 説明」） */
function splitHelp(message: string, split: boolean) {
  const m = /：|: /.exec(message);
  if (!split || !m) return message;
  return (
    <>
      {message.slice(0, m.index)}
      <span className="action-help">{message.slice(m.index)}</span>
    </>
  );
}

/** 倒せる見込みがないまま「攻撃を確定」を押したときの確認 */
function MissWarning({ boss, name, total, remaining, onBack, onGo }: { boss: boolean; name: string; total: number; remaining: number; onBack(): void; onGo(): void }) {
  return (
    <div className="overlay" onClick={onBack}>
      <div className="dialog panel tutorial-modal" role="alertdialog" aria-modal="true" aria-labelledby="miss-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="miss-title">{t("miss.title")}</h2>
        {total === 0 ? (
          <p>
            {t("miss.zero")}
            {boss ? t("miss.zeroBoss") : t("miss.zeroEnemy", { name })}
          </p>
        ) : boss ? (
          <p>{t("miss.boss", { name, n: remaining, total })}</p>
        ) : (
          <p>{t("miss.enemy", { name, n: remaining })}</p>
        )}
        <p className="dialog-note">{t("miss.note")}</p>
        <div className="dialog-buttons">
          <button type="button" className="ghost" onClick={onGo}>
            {t("miss.go")}
          </button>
          <button type="button" className="primary" autoFocus onClick={onBack}>
            {t("miss.back")}
          </button>
        </div>
      </div>
    </div>
  );
}
