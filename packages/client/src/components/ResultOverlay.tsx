import { nextStage } from "../progress.js";
import { isRemote, reg, useStore } from "../store.js";
import { resultReason } from "../text.js";

export function ResultOverlay() {
  const update = useStore((s) => s.update)!;
  const conn = useStore((s) => s.conn);
  const startSolo = useStore((s) => s.startSolo);
  const go = useStore((s) => s.go);
  const newlyCleared = useStore((s) => s.newlyCleared);
  const room = useStore((s) => s.room);
  const myId = useStore((s) => s.myId);
  const backToLobby = useStore((s) => s.backToLobby);
  const leaveRoom = useStore((s) => s.leaveRoom);
  const showToast = useStore((s) => s.showToast);
  const remote = isRemote(conn);
  const result = update.view.result;
  if (!result) return null;
  const win = result.outcome === "win";
  const stage = reg.stage(update.view.config.stageId);
  const next = win ? nextStage(reg.stages, stage.id) : null;
  const multi = update.view.players.length >= 2;

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

  return (
    <div className="overlay">
      <div className={`dialog panel result ${win ? "result-win" : "result-lose"}`} role="dialog" aria-modal="true">
        <h2 className="result-title">{win ? "勝利" : "敗北"}</h2>
        <p>
          {stage.name}：{resultReason(result.reason, reg.enemy(stage.bossId).name)}
        </p>
        {newlyCleared === stage.id && (
          <p className="result-unlock">
            {stage.tutorial
              ? "ステージ選択が解放されました！"
              : next
                ? `次のステージ「${next.name}」が解放されました！`
                : "すべてのステージをクリアしました！"}
          </p>
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
            <button type="button" className={next ? "ghost" : "primary"} onClick={() => startSolo(stage.id)}>
              もう一度
            </button>
            {next && (
              <button type="button" className="primary" onClick={() => startSolo(next.id)}>
                次のステージへ
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
