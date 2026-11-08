import { useStore } from "../store.js";
import { RESULT_REASON } from "../text.js";

export function ResultOverlay() {
  const update = useStore((s) => s.update)!;
  const conn = useStore((s) => s.conn);
  const startSolo = useStore((s) => s.startSolo);
  const go = useStore((s) => s.go);
  const result = update.view.result;
  if (!result) return null;
  const win = result.outcome === "win";
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
        <p>{RESULT_REASON[result.reason]}</p>
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
          <button type="button" className="ghost" onClick={download}>
            記録を保存
          </button>
          <button type="button" className="ghost" onClick={() => go("title")}>
            タイトルへ
          </button>
          <button type="button" className="primary" onClick={() => startSolo()}>
            もう一度
          </button>
        </div>
      </div>
    </div>
  );
}
