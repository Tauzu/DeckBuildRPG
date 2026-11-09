import { useEffect, useState } from "react";
import { DangerPicker } from "./components/DangerPicker.js";
import { ActionBar } from "./components/ActionBar.js";
import { LogPanel } from "./components/LogPanel.js";
import { PendingDialog } from "./components/PendingDialog.js";
import { PlayerArea } from "./components/PlayerArea.js";
import { ResultOverlay } from "./components/ResultOverlay.js";
import { RouteView } from "./components/RouteView.js";
import { BattlePanel } from "./components/BattlePanel.js";
import { CardDetail } from "./components/CardDetail.js";
import { MobilePanels } from "./components/MobilePanels.js";
import { useIsPhone } from "./hooks.js";
import { Effects } from "./components/Effects.js";
import { OthersPanel } from "./components/OthersPanel.js";
import { SoundControls } from "./components/SoundControls.js";
import { TutorialHint } from "./components/TutorialHint.js";
import { VillageStock } from "./components/VillageStock.js";
import { isUnlocked, maxDangerFor, stageSelectUnlocked } from "./progress.js";
import { isRemote, reg, useStore } from "./store.js";

export function TitleScreen() {
  const startSolo = useStore((s) => s.startSolo);
  const go = useStore((s) => s.go);
  const hasGame = useStore((s) => !!s.update && !s.update.view.result);
  const inRoom = useStore((s) => !!s.room);
  const progress = useStore((s) => s.progress);
  const unlocked = stageSelectUnlocked(reg.stages, progress);
  const tutorial = reg.stages.find((st) => st.tutorial);
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
          {unlocked ? (
            <button type="button" className={hasGame ? "" : "primary"} onClick={() => go("stages")}>
              ステージを選ぶ
            </button>
          ) : (
            <>
              <button type="button" className={hasGame ? "" : "primary"} onClick={() => startSolo(tutorial?.id)}>
                チュートリアルを始める
              </button>
              <button type="button" disabled title="チュートリアルをクリアすると遊べます">
                ステージを選ぶ（チュートリアルをクリアすると解放）
              </button>
            </>
          )}
          <button type="button" className={inRoom && !hasGame ? "primary" : ""} onClick={() => go("lobby")}>
            {inRoom ? "ルームに戻る" : "みんなで遊ぶ（ルームを作る・参加する）"}
          </button>
          <button type="button" onClick={() => go("records")}>
            実績と記録
          </button>
          <button type="button" onClick={() => go("rules")}>
            遊び方
          </button>
        </div>
        <SoundControls />
      </div>
    </main>
  );
}

export function StageSelectScreen() {
  const startSolo = useStore((s) => s.startSolo);
  const go = useStore((s) => s.go);
  const progress = useStore((s) => s.progress);
  /** ステージごとに選んだ危険度（選んでいなければ、選べる最高の危険度） */
  const [dangers, setDangers] = useState<Record<string, number>>({});
  return (
    <main className="rules-screen">
      <div className="rules panel stage-select">
        <h1>ステージを選ぶ</h1>
        <p className="stage-lead">
          ステージをクリアすると、次のステージが解放されます。先へ進むほど、登場するカードと敵が増えます。クリアしたステージは、危険度を上げて挑めます（最高{reg.maxDanger}）。危険度を選んでから、ステージを押すと始まります。
        </p>
        <ol className="stage-list">
          {reg.stages.map((st, i) => {
            const open = isUnlocked(reg.stages, progress, st.id);
            const best = progress.bestDanger[st.id];
            const cleared = progress.cleared.includes(st.id);
            const label = st.tutorial ? "チュートリアル" : `ステージ${i}`;
            const boss = reg.enemy(st.bossId).name;
            const max = maxDangerFor(st, progress, reg.maxDanger);
            const danger = Math.min(dangers[st.id] ?? max, max);
            return (
              <li key={st.id} className={`stage-item${open ? "" : " stage-locked"}`}>
                <button
                  type="button"
                  className="stage-button"
                  disabled={!open}
                  title={open ? undefined : "前のステージをクリアすると遊べます"}
                  onClick={() => startSolo(st.id, undefined, danger)}
                >
                  <span className="stage-label">{label}</span>
                  <span className="stage-name">{open ? st.name : "？？？"}</span>
                  {cleared && (
                    <span className="stage-cleared">{!st.tutorial && best !== undefined && best > 0 ? `危険度${best} クリア` : "クリア"}</span>
                  )}
                  <span className="stage-desc">{open ? `${st.description}（ボス：${boss}）` : "前のステージをクリアすると解放されます"}</span>
                </button>
                {open && !st.tutorial && max > 0 && (
                  <DangerPicker value={danger} max={max} best={best} onChange={(d) => setDangers({ ...dangers, [st.id]: d })} />
                )}
              </li>
            );
          })}
        </ol>
        <div className="dialog-buttons">
          <button type="button" className="primary" onClick={() => go("title")}>
            戻る
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
          敵は砦から集落へ向けて、全員の手番が終わるたびに1歩ずつ進軍してきます（そのあいだに全員が敵を撃破していれば進軍しません。1人で遊ぶときは、撃破した手番は進軍しません）。敵の山札の底のほうに潜む
          <strong>ボス</strong>を倒せば勝利。集落の耐久値が0になるか、ボスが集落に着くと敗北です。ボスはステージごとに違い、最後に待つのは魔竜です。
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
            <strong>敵を倒す</strong>：進軍ルートの敵を1体選び、英雄を出して攻撃。生命力以上のダメージで撃破し、経験値と戦利品（敵カード）を得る。<strong>全員が撃破すれば敵は進軍しない</strong>。撃破した直後に、戦った英雄や手札の英雄をレベルアップできる
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
            <strong>武器</strong>：戦闘で英雄1人に1枚装備できる。耐性を受けない、英雄のレベルで強くなる、撃破で経験値が増える、英雄なしでも使える、といった能力を持つ武器もある
          </li>
          <li>
            <strong>敵カード</strong>：倒すと捨て札に入る。金価値だけを持つ戦利品で、集落を訪れた手番の終わりに手札にあれば売却されてデッキから消える
          </li>
        </ul>
        <h2>ボス</h2>
        <p>ボスに与えたダメージは次の手番以降も残ります。1回で倒せなくても、少しずつ削りましょう（他の敵のダメージは残りません）。</p>
        <h2>ステージ</h2>
        <p>最初はチュートリアルで遊び方を覚えます。クリアするとステージ選択が解放され、ステージをクリアするたびに次のステージが遊べます。先へ進むほど、登場するカードと敵が増えます。</p>
        <h2>危険度と実績</h2>
        <p>
          クリアしたステージは、危険度を上げて挑めます。危険度が1つ上がるごとに不利な条件が1つ増え、クリアすると次の危険度が解放されます（最高{reg.maxDanger}）。条件を満たすと実績が記録されます。タイトルの「実績と記録」で一覧を見られます。
        </p>
        <p>
          記録はこのブラウザに保存されます。別の機器やブラウザで続けるときは、「実績と記録」の画面で引き継ぎコードを作り、移した先で読み込んでください。
        </p>
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
  const room = useStore((s) => s.room);
  const online = useStore((s) => s.online);
  const remote = isRemote(conn);
  const phone = useIsPhone();

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
        <span className="game-title">{reg.stage(update.view.config.stageId).name}</span>
        {update.view.config.danger > 0 && <span className="game-danger">危険度 {update.view.config.danger}</span>}
        <span className="game-turn">手番 {update.view.turnCount}</span>
        <SoundControls compact />
        {remote ? (
          <span className="game-seed">ルーム {room?.code}</span>
        ) : (
          <span className="game-seed" title="不具合の報告に使います">
            シード {conn ? conn.seed >>> 0 : "-"}
          </span>
        )}
      </header>
      {remote && !online && <div className="net-banner">サーバーとの接続が切れました。再接続しています…</div>}
      <div className="game-sticky">
        <ActionBar />
        <TutorialHint />
      </div>
      <RouteView />
      {phone ? (
        <>
          <PlayerArea />
          <MobilePanels />
        </>
      ) : (
        <div className="game-middle">
          {update.view.step.kind === "battle" || update.view.step.kind === "afterBattle" ? <BattlePanel /> : <VillageStock />}
          <div className="side-column">
            <OthersPanel />
            <LogPanel />
          </div>
        </div>
      )}
      {!phone && <PlayerArea />}
      <PendingDialog />
      <Effects />
      <CardDetail />
      <ResultOverlay />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
