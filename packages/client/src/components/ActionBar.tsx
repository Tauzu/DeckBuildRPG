import { useState } from "react";
import { findOption, reasonText, reg, useStore } from "../store.js";
import { resistText, touchText } from "../text.js";

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
      title={cancelReason ?? "行動の選択に戻ります"}
      onClick={() => send({ type: "cancelAction" })}
    >
      選び直す
    </button>
  );

  // 撃破したときに進軍がどうなるか（ラウンドの全員が撃破すると進軍しない）
  const players = view.players.length;
  const defeatsAfter = view.roundDefeats + 1; // この手番の撃破を含める（数えるのは手番の終わり）
  const marchNote =
    players === 1
      ? "撃破すればこの手番は敵が進軍しない"
      : `このラウンドの撃破 ${Math.min(defeatsAfter, players)} / ${players}人。全員が撃破すれば敵は進軍しない`;

  let message = "";
  let buttons = null;
  let detail = null;

  if (view.result) {
    message = "ゲーム終了";
  } else if (legal.selection?.kind === "target") {
    message =
      legal.selection.mode === "freeze"
        ? "凍結する敵を、進軍ルートからクリックして選んでください（次の進軍で動かなくなります）"
        : "1マス戻す敵を、進軍ルートからクリックして選んでください";
  } else if (legal.selection) {
    message = "選択してください";
  } else if (!myTurn) {
    const cur = view.players.find((p) => p.id === view.currentPlayerId);
    if (view.pending?.kind === "discard") {
      message = "ほかのプレイヤーが手札を捨てるのを待っています…";
    } else if (view.pending?.kind === "target") {
      message = "ほかのプレイヤーが、凍結・後退する敵を選ぶのを待っています…";
    } else if (cur && cur.id !== view.viewerId) {
      const turn = view.turn;
      const target = turn?.action === "battle" ? view.route.flat().find((c) => c.uid === turn.targetUid) : undefined;
      const doing =
        step === "village"
          ? "集落を訪れています"
          : step === "battle" && target
            ? `「${reg.get(target.defId).name}」と戦っています`
            : step === "afterBattle"
              ? "敵を撃破しました"
              : "行動を選んでいます";
      message = `${cur.name}の手番：${doing}`;
      const p = info.preview;
      if (step === "battle" && p) {
        detail = (
          <div className="info-row">
            <span>
              ダメージ見込み {p.total}（生命力 {p.hp}
              {p.prevDamage > 0 && `、これまでのダメージ ${p.prevDamage}`}）
            </span>
          </div>
        );
      }
    } else {
      message = "処理中…";
    }
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
    message =
      "集落：手札の食料→英雄で村効果を使う／在庫をクリックして購入／英雄のレベルアップ（手札の戦利品は訪問の終わりに売却）";
    detail = (
      <div className="info-row">
        <span className="info-gold">所持金 {info.gold}</span>
        <span>
          英雄の枠 {info.slots.used} / {info.slots.total}
        </span>
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
      ? [
          resistText(tdef.resistPhysical) && `物理${resistText(tdef.resistPhysical)}`,
          resistText(tdef.resistMagic) && `魔法${resistText(tdef.resistMagic)}`,
        ]
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
        <span>
          英雄の枠 {info.slots.used} / {info.slots.total}
        </span>
        {p && p.prevDamage > 0 && <span>これまでのダメージ {p.prevDamage}</span>}
        {p && (
          <span className={p.prevDamage + p.total >= p.hp ? "info-ok" : tdef?.isBoss && p.total > 0 ? "info-boss" : "info-ng"}>
            ダメージ見込み {p.total}
            {(p.physical !== p.physicalAfter || p.magic !== p.magicAfter) &&
              `（物理 ${p.physical}→${p.physicalAfter}、魔法 ${p.magic}→${p.magicAfter}）`}
            {p.prevDamage + p.total >= p.hp
              ? ` … 倒せる！（${marchNote}）`
              : tdef?.isBoss
                ? ` … 残り生命力 ${p.hp - p.prevDamage - p.total}。ボスに与えたダメージは残るので、次の手番に続きから削れます`
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
          onClick={() => (p && p.prevDamage + p.total < p.hp ? setMissWarning(true) : send({ type: "confirmAttack" }))}
        >
          攻撃を確定
        </button>
        {missWarning && p && p.prevDamage + p.total < p.hp && (
          <MissWarning
            boss={!!tdef?.isBoss}
            name={tdef?.name ?? "敵"}
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
    message = `撃破！ 経験値で英雄をレベルアップ・転職できます（場で戦った英雄と手札の英雄）。終えると手番が終わります（${marchNote}）`;
    buttons = (
      <button type="button" className="primary" onClick={() => send({ type: "finishBattle" })}>
        手番を終える
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
          経験値 <strong>{me.exp}</strong>
          <span className="exp-total">
            （総獲得 {me.totalExp}・撃破 {me.kills}）
          </span>
        </div>
        <div className="action-buttons">{buttons}</div>
      </div>
    </section>
  );
}

/** 「見出し：説明」の説明の部分を、スマートフォンでは隠せるように分ける */
function splitHelp(message: string, split: boolean) {
  const i = message.indexOf("：");
  if (!split || i < 0) return message;
  return (
    <>
      {message.slice(0, i)}
      <span className="action-help">{message.slice(i)}</span>
    </>
  );
}

/** 倒せる見込みがないまま「攻撃を確定」を押したときの確認 */
function MissWarning({ boss, name, total, remaining, onBack, onGo }: { boss: boolean; name: string; total: number; remaining: number; onBack(): void; onGo(): void }) {
  return (
    <div className="overlay" onClick={onBack}>
      <div className="dialog panel tutorial-modal" role="alertdialog" aria-modal="true" aria-labelledby="miss-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="miss-title">このままでは倒せません</h2>
        {total === 0 ? (
          <p>ダメージが 0 です。{boss ? "このまま攻撃しても、ボスのダメージは増えません。" : `「${name}」は倒れず、手番が終わって敵が進軍します。`}</p>
        ) : boss ? (
          <p>
            「{name}」はまだ倒れません（残り生命力 {remaining}）。与えたダメージ {total} は残り、次の手番に続きから削れます。
          </p>
        ) : (
          <p>
            「{name}」はあと {remaining} 足りず、倒れません。ダメージは残らず、手番が終わって敵が進軍します。
          </p>
        )}
        <p className="dialog-note">武器や英雄を足せば、倒せるかもしれません。</p>
        <div className="dialog-buttons">
          <button type="button" className="ghost" onClick={onGo}>
            それでも攻撃する
          </button>
          <button type="button" className="primary" autoFocus onClick={onBack}>
            戻って見直す
          </button>
        </div>
      </div>
    </div>
  );
}
