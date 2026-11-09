// チュートリアルの案内（企画書 12.3）。状況に合わせてヒントを出すだけで、操作は自由
import type { GameUpdate } from "../connection.js";
import { reg, useStore } from "../store.js";

export function TutorialHint() {
  const update = useStore((s) => s.update)!;
  const hide = useStore((s) => s.hideHints);
  const setHide = useStore((s) => s.setHideHints);
  const stage = reg.stage(update.view.config.stageId);
  if (!stage.tutorial || update.view.result) return null;

  if (hide) {
    return (
      <div className="tutorial-hint tutorial-hint-hidden">
        <button type="button" className="ghost mini" onClick={() => setHide(false)}>
          案内を表示する
        </button>
      </div>
    );
  }
  return (
    <aside className="tutorial-hint panel" aria-live="polite">
      <div className="tutorial-hint-head">
        <span className="tutorial-hint-label">案内</span>
        <button type="button" className="ghost mini" onClick={() => setHide(true)}>
          隠す
        </button>
      </div>
      <p>{hintText(update)}</p>
    </aside>
  );
}

/** 今の状況に合ったヒント */
export function hintText(u: GameUpdate): string {
  const { view, legal } = u;
  const me = view.players.find((p) => p.id === view.viewerId)!;
  const hand = me.hand ?? [];
  const types = hand.map((c) => reg.get(c.defId));
  const enemies = view.route.flat();
  const boss = enemies.find((c) => reg.enemy(c.defId).isBoss);
  const canLevelUp = legal.options.some((o) => (o.action.type === "levelUp" || o.action.type === "changeClass") && !o.reason);

  if (legal.selection?.kind === "discard") return "敵の能力で、手札を捨てなければなりません。いらないカードを選びましょう。";

  switch (view.step.kind) {
    case "chooseAction": {
      if (boss) {
        return `ボス「${reg.get(boss.defId).name}」が現れました！ 倒せば勝利、集落に着かれたら負けです。ボスに与えたダメージは残るので、何回かに分けて削りましょう。`;
      }
      if (enemies.length === 0) {
        return "手番では「集落を訪れる」か「敵と戦う」のどちらかを行います。まだ敵がいないので、まずは集落を訪れて、手札の金でカードを買いましょう。";
      }
      const close = view.route.slice(3).some((sq) => sq.length > 0);
      return close
        ? "敵が集落に近づいています。集落に着くと耐久値が減ります。敵をクリックして戦いましょう。倒すと経験値が入り、その手番は敵が進軍しません。"
        : "進軍ルートに敵が現れました。敵は手番が終わるたびに1歩進みます。勝てそうなら敵をクリックして戦い、まだ弱ければ集落で仲間を増やしましょう。";
    }
    case "village": {
      if (canLevelUp) {
        return "経験値がたまっています！ 手札の英雄の下にある「Lvアップ」や、村の若者の「転職」で強くしましょう。";
      }
      const heroInHand = types.some((d) => d.type === "hero" && d.villageEffect);
      if (heroInHand) {
        return "村効果を持つ英雄は、集落で出すと効果を発揮します。英雄は1人なら食料なしで出せます。";
      }
      return `所持金 ${u.info.gold}。上の「村の在庫」をクリックすると買えます。騎士（物理）や魔法使い（魔法）は戦力に、干し肉は英雄を2人出せる食料になります。買ったカードは捨て札に入り、あとで手札に来ます。終わったら「訪問を終える」。`;
    }
    case "battle": {
      const p = u.info.preview;
      if (p && p.prevDamage + p.total >= p.hp) {
        return "ダメージ見込みが敵の生命力に届きました。「攻撃を確定」で撃破です！";
      }
      return "手札の英雄をクリックして場に出します。英雄は1人なら食料なしで出せ、食料を出すと食糧値の人数だけ追加で出せます。武器は、クリックしてから場の英雄をクリックすると装備できます。";
    }
    case "afterBattle":
      return canLevelUp
        ? "撃破！ 経験値がたまったので、場や手札の英雄をすぐにレベルアップできます。"
        : "撃破！ 経験値は、レベルアップや村の若者の転職に使います。「手番を終える」で次の手番へ。";
    default:
      return "";
  }
}
