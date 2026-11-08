import { findOption, reasonText, reg, useStore } from "../store.js";
import { resistText } from "../text.js";

/** 今の段階の説明と、今できる操作のボタン */
export function ActionBar() {
  const update = useStore((s) => s.update)!;
  const send = useStore((s) => s.send);
  const selectedWeapon = useStore((s) => s.selectedWeapon);
  const selectWeapon = useStore((s) => s.selectWeapon);
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
      title={cancelReason ?? "行動の選択に戻ります"}
      onClick={() => send({ type: "cancelAction" })}
    >
      選び直す
    </button>
  );

  let message = "";
  let buttons = null;
  let detail = null;

  if (view.result) {
    message = "ゲーム終了";
  } else if (legal.selection) {
    message = "選択してください";
  } else if (!myTurn) {
    message = "処理中…";
  } else if (step === "chooseAction") {
    const hasEnemy = view.route.some((sq) => sq.length > 0);
    message = hasEnemy
      ? "行動を選んでください：集落を訪れるか、進軍ルートの敵をクリックして戦いを挑む"
      : "行動を選んでください：進軍ルートに敵はいません";
    buttons = (
      <button type="button" className="primary" onClick={() => send({ type: "chooseVillage" })}>
        集落を訪れる
      </button>
    );
  } else if (step === "village") {
    message = "集落：手札の食料→英雄で村効果を使う／在庫をクリックして購入／英雄のレベルアップ（手札の戦利品は訪問の終わりに売却）";
    detail = (
      <div className="info-row">
        <span className="info-gold">所持金 {info.gold}</span>
        <span>英雄の枠 {info.slots.used} / {info.slots.total}</span>
      </div>
    );
    buttons = (
      <>
        {cancelButton}
        <button type="button" className="primary" onClick={() => send({ type: "endVisit" })}>
          訪問を終える
        </button>
      </>
    );
  } else if (step === "battle") {
    const targetUid = view.turn?.action === "battle" ? view.turn.targetUid : null;
    const target = view.route.flat().find((c) => c.uid === targetUid);
    const tdef = target ? reg.enemy(target.defId) : null;
    const p = info.preview;
    message = selectedWeapon
      ? "装備させる英雄（場）をクリックしてください"
      : "戦闘：食料→英雄を出し、武器を選んで英雄に装備。場のカードをクリックすると手札に戻す";
    const confirm = findOption(legal.options, (a) => a.type === "confirmAttack");
    const resist = tdef
      ? [resistText(tdef.resistPhysical) && `物理${resistText(tdef.resistPhysical)}`, resistText(tdef.resistMagic) && `魔法${resistText(tdef.resistMagic)}`]
          .filter(Boolean)
          .join("・")
      : "";
    detail = (
      <div className="info-row">
        {tdef && (
          <span>
            相手：{tdef.name}（生命力 {p?.hp}
            {resist && `、${resist}`}）
          </span>
        )}
        <span>英雄の枠 {info.slots.used} / {info.slots.total}</span>
        {p && p.prevDamage > 0 && <span>これまでのダメージ {p.prevDamage}</span>}
        {p && (
          <span className={p.prevDamage + p.total >= p.hp ? "info-ok" : "info-ng"}>
            ダメージ見込み {p.total}
            {(p.physical !== p.physicalAfter || p.magic !== p.magicAfter) &&
              `（物理 ${p.physical}→${p.physicalAfter}、魔法 ${p.magic}→${p.magicAfter}）`}
            {p.prevDamage + p.total >= p.hp
              ? " … 倒せる！（撃破すればこの手番は敵が進軍しない）"
              : ` … あと ${p.hp - p.prevDamage - p.total}`}
          </span>
        )}
      </div>
    );
    buttons = (
      <>
        {cancelButton}
        {selectedWeapon && (
          <button type="button" className="ghost" onClick={() => selectWeapon(null)}>
            武器の選択をやめる
          </button>
        )}
        <button
          type="button"
          className="primary danger"
          disabled={!!reasonText(confirm)}
          onClick={() => send({ type: "confirmAttack" })}
        >
          攻撃を確定
        </button>
      </>
    );
  }

  return (
    <section className="action-bar panel">
      <div className="action-main">
        <div className="action-message">{message}</div>
        {detail}
      </div>
      <div className="action-side">
        <div className="exp">
          経験値 <strong>{me.exp}</strong>
          <span className="exp-total">（総獲得 {me.totalExp}・撃破 {me.kills}）</span>
        </div>
        <div className="action-buttons">{buttons}</div>
      </div>
    </section>
  );
}
