// 他のプレイヤーの情報（仕様書 10.2「横」）。マルチのときだけ表示する
import { reg, useStore } from "../store.js";

export function OthersPanel() {
  const update = useStore((s) => s.update)!;
  const room = useStore((s) => s.room);
  const { view } = update;
  if (view.players.length < 2) return null;
  return (
    <section className="others panel" aria-label="プレイヤー">
      <h2>プレイヤー</h2>
      <ul className="others-list">
        {view.players.map((p) => {
          const m = room?.members.find((x) => x.id === p.id);
          const turn = view.currentPlayerId === p.id && !view.result;
          const me = p.id === view.viewerId;
          return (
            <li key={p.id} className={`others-item${turn ? " others-turn" : ""}`}>
              <div className="others-name">
                {turn && (
                  <span className="others-mark" aria-label="手番">
                    ▶
                  </span>
                )}
                {p.name}
                {me && <span className="others-you">あなた</span>}
                {m && !m.connected && <span className="others-off">{m.auto ? "自動" : "接続待ち"}</span>}
              </div>
              <div className="others-stats">
                経験値 {p.exp}（総 {p.totalExp}）・撃破 {p.kills}・手札 {p.handCount}・山札 {p.deckCount}・捨て札 {p.discardCount}
              </div>
              {!me && p.field.length > 0 && <div className="others-field">場：{p.field.map((c) => reg.get(c.defId).name).join("、")}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
