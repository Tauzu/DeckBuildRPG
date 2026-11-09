// ルーム待機（仕様書 9.2、10.1）。ルームを作る・参加する・開始する
import { useState } from "react";
import { isUnlocked, maxDangerFor } from "../progress.js";
import { reg, useStore } from "../store.js";
import { DangerPicker, dangerTexts } from "./DangerPicker.js";

export function LobbyScreen() {
  const room = useStore((s) => s.room);
  return <main className="rules-screen">{room ? <RoomView /> : <EnterRoom />}</main>;
}

/** ルームを作る／ルームコードで参加する */
function EnterRoom() {
  const go = useStore((s) => s.go);
  const createRoom = useStore((s) => s.createRoom);
  const joinRoom = useStore((s) => s.joinRoom);
  const progress = useStore((s) => s.progress);
  const [name, setName] = useState(() => useStore.getState().playerName);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 最初に選んでおくステージ：解放済みのうち、2人以上で遊べる一番先のステージ
  const firstStage =
    [...reg.stages].reverse().find((st) => isUnlocked(reg.stages, progress, st.id) && st.playerCounts["2"]) ?? reg.stages[0]!;

  const run = async (p: () => Promise<string | null>) => {
    setBusy(true);
    setError(await p());
    setBusy(false);
  };
  const nameOk = name.trim().length > 0;

  return (
    <div className="rules panel lobby">
      <h1>みんなで遊ぶ</h1>
      <label className="field">
        <span>あなたの名前</span>
        <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="12文字まで" autoFocus />
      </label>
      <div className="lobby-columns">
        <section className="lobby-box">
          <h2>ルームを作る</h2>
          <p className="dialog-note">ルームコードが発行されます。一緒に遊ぶ人に伝えてください。</p>
          <button
            type="button"
            className="primary"
            disabled={!nameOk || busy}
            onClick={() => run(() => createRoom(name.trim(), firstStage.id, 0))}
          >
            ルームを作る
          </button>
        </section>
        <section className="lobby-box">
          <h2>ルームに参加する</h2>
          <label className="field">
            <span>ルームコード</span>
            <input
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="英数字6文字"
              className="code-input"
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={!nameOk || code.trim().length !== 6 || busy}
            onClick={() => run(() => joinRoom(code.trim(), name.trim()))}
          >
            参加する
          </button>
        </section>
      </div>
      {error && (
        <p className="lobby-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-buttons">
        <button type="button" onClick={() => go("title")}>
          戻る
        </button>
      </div>
    </div>
  );
}

/** ルームの中：参加者、ステージ、開始 */
function RoomView() {
  const room = useStore((s) => s.room)!;
  const myId = useStore((s) => s.myId);
  const online = useStore((s) => s.online);
  const progress = useStore((s) => s.progress);
  const setRoomStage = useStore((s) => s.setRoomStage);
  const startRoom = useStore((s) => s.startRoom);
  const leaveRoom = useStore((s) => s.leaveRoom);
  const go = useStore((s) => s.go);
  const hasGame = useStore((s) => !!s.update);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === myId;
  const stage = reg.stage(room.stageId);
  const n = room.members.length;
  const countOk = !!stage.playerCounts[String(n) as "1"];
  const counts = Object.keys(stage.playerCounts).join("・");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // コピーできない環境では、表示されたコードを伝えてもらう
    }
  };

  return (
    <div className="rules panel lobby">
      <h1>ルーム</h1>
      {!online && <p className="lobby-error">サーバーとの接続が切れています。再接続しています…</p>}
      <div className="room-code">
        <span>ルームコード</span>
        <strong>{room.code}</strong>
        <button type="button" className="ghost mini" onClick={copy}>
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
      <h2>参加者（{n} / 4人）</h2>
      <ul className="member-list">
        {room.members.map((m) => (
          <li key={m.id}>
            {m.name}
            {m.id === room.hostId && <span className="member-host">ホスト</span>}
            {m.id === myId && <span className="others-you">あなた</span>}
            {!m.connected && <span className="others-off">接続待ち</span>}
          </li>
        ))}
      </ul>
      <h2>ステージ</h2>
      {isHost ? (
        <>
          <ol className="stage-list">
            {reg.stages.map((st, i) => {
              const open = isUnlocked(reg.stages, progress, st.id);
              const label = st.tutorial ? "チュートリアル" : `ステージ${i}`;
              return (
                <li key={st.id}>
                  <button
                    type="button"
                    className={`stage-button${st.id === room.stageId ? " stage-selected" : ""}`}
                    disabled={!open || room.started}
                    aria-pressed={st.id === room.stageId}
                    onClick={async () => setError(await setRoomStage(st.id, 0))}
                  >
                    <span className="stage-label">{label}</span>
                    <span className="stage-name">{open ? st.name : "？？？"}</span>
                    <span className="stage-desc">
                      {open
                        ? `${Object.keys(st.playerCounts).join("・")}人で遊べる（ボス：${reg.enemy(st.bossId).name}）`
                        : "まだ解放されていません"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {!stage.tutorial && maxDangerFor(stage, progress, reg.maxDanger) > 0 && (
            <DangerPicker
              value={room.danger}
              max={maxDangerFor(stage, progress, reg.maxDanger)}
              best={progress.bestDanger[stage.id]}
              disabled={room.started}
              onChange={async (d) => setError(await setRoomStage(stage.id, d))}
            />
          )}
          <p className="dialog-note">あなたが解放したステージと危険度から選べます。クリアすると、参加者全員の進み具合に記録されます。</p>
        </>
      ) : (
        <div>
          <p>
            {stage.tutorial ? "チュートリアル" : stage.name}
            {room.danger > 0 && `（危険度${room.danger}）`}（ボス：{reg.enemy(stage.bossId).name}）
          </p>
          {room.danger > 0 && (
            <ul className="danger-list">
              {dangerTexts(room.danger).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          <p className="dialog-note">ステージと危険度はホストが選びます。</p>
        </div>
      )}
      {error && (
        <p className="lobby-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-buttons">
        <button type="button" className="ghost" onClick={leaveRoom}>
          ルームを出る
        </button>
        <button type="button" onClick={() => go("title")}>
          タイトルへ
        </button>
        {room.started && hasGame && (
          <button type="button" className="primary" onClick={() => go("game")}>
            ゲームに戻る
          </button>
        )}
        {isHost && !room.started && (
          <button
            type="button"
            className="primary"
            disabled={!countOk}
            title={countOk ? undefined : `このステージは${counts}人で遊びます`}
            onClick={async () => setError(await startRoom())}
          >
            {countOk ? "開始する" : `${counts}人で遊ぶステージです`}
          </button>
        )}
        {!isHost && !room.started && <span className="dialog-note">ホストが開始するのを待っています…</span>}
      </div>
    </div>
  );
}
