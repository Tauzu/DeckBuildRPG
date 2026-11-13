import { useState } from "react";
import { nextStage } from "../progress.js";
import { isRemote, reg, useStore } from "../store.js";
import { resultReason } from "../text.js";
import { ReviewPanel } from "./ReviewPanel.js";

export function ResultOverlay() {
  const update = useStore((s) => s.update)!;
  const conn = useStore((s) => s.conn);
  const startSolo = useStore((s) => s.startSolo);
  const go = useStore((s) => s.go);
  const newlyCleared = useStore((s) => s.newlyCleared);
  const unlockedNow = useStore((s) => s.unlockedNow);
  const room = useStore((s) => s.room);
  const myId = useStore((s) => s.myId);
  const backToLobby = useStore((s) => s.backToLobby);
  const leaveRoom = useStore((s) => s.leaveRoom);
  const showToast = useStore((s) => s.showToast);
  const review = useStore((s) => s.review);
  const [reviewing, setReviewing] = useState(false);
  const remote = isRemote(conn);
  const result = update.view.result;
  if (!result) return null;
  const win = result.outcome === "win";
  const stage = reg.stage(update.view.config.stageId);
  const next = win ? nextStage(reg.stages, stage.id) : null;
  const multi = update.view.players.length >= 2;
  const danger = update.view.config.danger;
  /** 新しく解放した次の危険度（なければ null） */
  const nextDanger = newlyCleared?.danger && !stage.tutorial && danger < reg.maxDanger ? danger + 1 : null;

  const download = () => {
    const record = conn?.record();
    if (!record) return;
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deckbuild-record-${record.seed >>> 0}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (reviewing) {
    return (
      <div className="overlay">
        <div className="dialog panel result result-review" role="dialog" aria-modal="true" aria-label="ゲームの振り返り">
          <h2>ゲームの振り返り</h2>
          <ReviewPanel review={review} />
          <div className="dialog-buttons">
            <button type="button" className="primary" onClick={() => setReviewing(false)}>
              結果にもどる
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className={`dialog panel result ${win ? "result-win" : "result-lose"}`} role="dialog" aria-modal="true">
        <h2 className="result-title">{win ? "勝利" : "敗北"}</h2>
        <p>
          {stage.name}
          {danger > 0 && `（危険度+${danger}）`}：{resultReason(result.reason, reg.enemy(stage.bossId).name)}
        </p>
        {newlyCleared?.stage && (
          <p className="result-unlock">
            {stage.tutorial
              ? "ステージ選択が解放されました！"
              : next
                ? `次のステージ「${next.name}」が解放されました！`
                : "すべてのステージをクリアしました！"}
          </p>
        )}
        {nextDanger !== null && <p className="result-unlock">このステージの危険度+{nextDanger}が解放されました！</p>}
        {newlyCleared?.danger && !stage.tutorial && danger === reg.maxDanger && (
          <p className="result-unlock">このステージを最高の危険度で制覇しました！</p>
        )}
        {unlockedNow.length > 0 && (
          <ul className="result-achievements" aria-label="達成した実績">
            {unlockedNow.map((a) => (
              <li key={a.id}>
                <span className="achievement-mark">★</span> 実績「{a.name}」を達成！
                <span className="achievement-text">{a.text}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="result-rank">
          チーム評価 <strong>{result.rank}</strong>
        </div>
        <div className="result-sub">
          集落の耐久値 {result.villageHp} / {update.view.config.villageHp} ・ 手番 {update.view.turnCount}
        </div>
        <table className="result-table">
          <thead>
            <tr>
              <th>プレイヤー</th>
              <th>総獲得経験値</th>
              <th>撃破数</th>
              {multi && <th>称号</th>}
            </tr>
          </thead>
          <tbody>
            {update.view.players.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.name}
                  {result.mvp.includes(p.id) && <span className="mvp">MVP</span>}
                </td>
                <td>{p.totalExp}</td>
                <td>{p.kills}</td>
                {multi && <td>{result.titles[p.id]}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dialog-buttons">
          <button type="button" onClick={() => setReviewing(true)}>
            ゲームを振り返る
          </button>
        </div>
        {remote ? (
          <div className="dialog-buttons">
            <button type="button" className="ghost" onClick={leaveRoom}>
              ルームを出る
            </button>
            {room?.hostId === myId ? (
              <button
                type="button"
                className="primary"
                onClick={async () => {
                  const err = await backToLobby();
                  if (err) showToast(err);
                }}
              >
                ルームに戻って次のゲームへ
              </button>
            ) : (
              <span className="dialog-note">ホストがルームに戻すと、次のゲームを始められます</span>
            )}
          </div>
        ) : (
          <div className="dialog-buttons">
            <button type="button" className="ghost" onClick={download}>
              記録を保存
            </button>
            <button type="button" className="ghost" onClick={() => go("title")}>
              タイトルへ
            </button>
            <button type="button" className={next || nextDanger !== null ? "ghost" : "primary"} onClick={() => startSolo(stage.id, undefined, danger)}>
              もう一度
            </button>
            {nextDanger !== null && (
              <button type="button" className={next && newlyCleared?.stage ? "" : "primary"} onClick={() => startSolo(stage.id, undefined, nextDanger)}>
                危険度+{nextDanger}に挑む
              </button>
            )}
            {next && (
              <button type="button" className={newlyCleared?.stage || nextDanger === null ? "primary" : ""} onClick={() => startSolo(next.id)}>
                次のステージへ
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
