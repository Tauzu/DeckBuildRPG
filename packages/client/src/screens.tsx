import { useEffect } from "react";
import { ActionBar } from "./components/ActionBar.js";
import { LogPanel } from "./components/LogPanel.js";
import { PendingDialog } from "./components/PendingDialog.js";
import { PlayerArea } from "./components/PlayerArea.js";
import { ResultOverlay } from "./components/ResultOverlay.js";
import { RouteView } from "./components/RouteView.js";
import { VillageStock } from "./components/VillageStock.js";
import { useStore } from "./store.js";

export function TitleScreen() {
  const startSolo = useStore((s) => s.startSolo);
  const go = useStore((s) => s.go);
  const hasGame = useStore((s) => !!s.update && !s.update.view.result);
  return (
    <main className="title-screen">
      <div className="title-box panel">
        <p className="title-kicker">デッキビルド × RPG</p>
        <h1>辺境村の英雄たち</h1>
        <p className="title-lead">魔竜の軍勢が集落に届く前に、英雄たちを育てて魔竜を討て。</p>
        <div className="title-buttons">
          {hasGame && (
            <button type="button" className="primary" onClick={() => go("game")}>
              続きから遊ぶ
            </button>
          )}
          <button type="button" className={hasGame ? "" : "primary"} onClick={() => startSolo()}>
            ひとりで遊ぶ
          </button>
          <button type="button" disabled title="フェーズ4で対応予定">
            ルームを作る（準備中）
          </button>
          <button type="button" onClick={() => go("rules")}>
            遊び方
          </button>
        </div>
      </div>
    </main>
  );
}

export function RulesScreen() {
  const go = useStore((s) => s.go);
  return (
    <main className="rules-screen">
      <div className="rules panel">
        <h1>遊び方</h1>
        <h2>目的</h2>
        <p>
          敵は砦から集落へ向けて、手番が終わるたびに1歩ずつ進軍してきます（敵を撃破した手番を除く）。敵の山札の底のほうに潜む
          <strong>魔竜（ボス）</strong>を倒せば勝利。集落の耐久値が0になるか、魔竜が集落に着くと敗北です。
        </p>
        <h2>手番</h2>
        <p>
          手番では次のどちらか1つを行います。終わると手札と場のカードを捨て札にし、山札から5枚引きます。集落で何もしていない間や、戦闘で攻撃を確定する前なら「選び直す」で行動の選択に戻れます。
        </p>
        <ul>
          <li>
            <strong>集落を訪れる</strong>：手札の金価値の合計でカードを購入／英雄の村効果を使う／経験値で英雄をレベルアップ
          </li>
          <li>
            <strong>敵を倒す</strong>：進軍ルートの敵を1体選び、英雄を出して攻撃。生命力以上のダメージで撃破し、経験値と戦利品（敵カード）を得る。<strong>撃破した手番は敵が進軍しない</strong>。撃破した直後に、戦った英雄や手札の英雄をレベルアップできる
          </li>
        </ul>
        <h2>カード</h2>
        <ul>
          <li>
            <strong>食料</strong>：英雄は1人だけなら食料なしで出せる。2人目からは食料が必要で、食糧値の人数まで追加で出せる（集落でも戦闘でも）
          </li>
          <li>
            <strong>英雄</strong>：物理・魔法の攻撃力を持つ。村効果を持つ英雄は、集落で出すと効果を発揮する
          </li>
          <li>
            <strong>武器</strong>：戦闘で英雄1人に1枚装備できる
          </li>
          <li>
            <strong>敵カード</strong>：倒すと捨て札に入る。金価値だけを持つ戦利品で、集落を訪れた手番の終わりに手札にあれば売却されてデッキから消える
          </li>
        </ul>
        <h2>魔竜</h2>
        <p>魔竜に与えたダメージは次の手番以降も残ります。1回で倒せなくても、少しずつ削りましょう（他の敵のダメージは残りません）。</p>
        <h2>耐性</h2>
        <p>物理や魔法の合計に対して「半減（端数切り捨て）」「無効」がかかります。狩人や武器で両方を用意しましょう。</p>
        <h2>成長</h2>
        <p>
          村の若者は経験値2で好きな英雄のLv1に転職できます。英雄は経験値を使って1つ上のレベルにでき、在庫から上のレベルのカードを受け取ります。
        </p>
        <div className="dialog-buttons">
          <button type="button" className="primary" onClick={() => go("title")}>
            戻る
          </button>
        </div>
      </div>
    </main>
  );
}

export function GameScreen() {
  const update = useStore((s) => s.update);
  const conn = useStore((s) => s.conn);
  const toast = useStore((s) => s.toast);
  const clearToast = useStore((s) => s.clearToast);
  const go = useStore((s) => s.go);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 2500);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!update) return null;
  return (
    <div className="game">
      <header className="game-header">
        <button type="button" className="ghost mini" onClick={() => go("title")}>
          タイトル
        </button>
        <span className="game-title">辺境村の英雄たち</span>
        <span className="game-turn">手番 {update.view.turnCount}</span>
        <span className="game-seed" title="不具合の報告に使います">
          シード {conn ? conn.seed >>> 0 : "-"}
        </span>
      </header>
      <RouteView />
      <div className="game-middle">
        <VillageStock />
        <LogPanel />
      </div>
      <ActionBar />
      <PlayerArea />
      <PendingDialog />
      <ResultOverlay />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
