// ルーム待機（仕様書 9.2、10.1）。ルームを作る・参加する・開始する
import { useRef, useState } from "react";
import { inviteUrl } from "../invite.js";
import { isUnlocked, maxDangerFor } from "../progress.js";
import { reg, useStore } from "../store.js";
import { DangerPicker, dangerTexts } from "./DangerPicker.js";
import { cardName, stageName } from "../text.js";
import { t, tParts } from "../i18n.js";

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
  const inviteCode = useStore((s) => s.inviteCode);
  const clearInvite = useStore((s) => s.clearInvite);
  const [code, setCode] = useState(inviteCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 最初に選んでおくステージ：解放済みのうち、2人以上で遊べる一番先のステージ
  const firstStage =
    [...reg.stages].reverse().find((st) => isUnlocked(reg.stages, progress, st.id) && st.playerCounts["2"]) ?? reg.stages[0]!;

  const run = async (p: () => Promise<string | null>) => {
    setBusy(true);
    const err = await p();
    setError(err);
    setBusy(false);
    // 入れたら、招待の指定は片づける
    if (!err) clearInvite();
  };
  const nameOk = name.trim().length > 0;

  return (
    <div className="rules panel lobby">
      <h1>{t("lobby.title")}</h1>
      {inviteCode && (
        <p className="invite-banner">
          {tParts("lobby.invited", { code: <strong key="code">{inviteCode}</strong> })}
        </p>
      )}
      <label className="field">
        <span>{t("lobby.yourName")}</span>
        <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder={t("lobby.namePlaceholder")} autoFocus />
      </label>
      <div className="lobby-columns">
        {!inviteCode && (
        <section className="lobby-box">
          <h2>{t("lobby.create")}</h2>
          <p className="dialog-note">{t("lobby.createNote")}</p>
          <button
            type="button"
            className="primary"
            disabled={!nameOk || busy}
            onClick={() => run(() => createRoom(name.trim(), firstStage.id, 0))}
          >
            {t("lobby.create")}
          </button>
        </section>
        )}
        <section className="lobby-box">
          <h2>{t("lobby.join")}</h2>
          <label className="field">
            <span>{t("lobby.code")}</span>
            <input
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("lobby.codePlaceholder")}
              className="code-input"
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={!nameOk || code.trim().length !== 6 || busy}
            onClick={() => run(() => joinRoom(code.trim(), name.trim()))}
          >
            {t("lobby.joinButton")}
          </button>
        </section>
      </div>
      {error && (
        <p className="lobby-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-buttons">
        <button
          type="button"
          onClick={() => {
            clearInvite();
            go("title");
          }}
        >
          {t("common.back")}
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
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  /** 選んだがサーバーの返事を待っている危険度（続けて押しても、押した分だけ上がるように） */
  const [pendingDanger, setPendingDanger] = useState<number | null>(null);
  const dangerRequest = useRef(0);
  const changeDanger = async (d: number) => {
    setPendingDanger(d);
    const id = ++dangerRequest.current;
    const err = await setRoomStage(room.stageId, d);
    // 最後に押した分の返事が来たら、サーバーの値に戻す（ルームの情報は返事より先に届いている）
    if (id === dangerRequest.current) setPendingDanger(null);
    setError(err);
  };
  const isHost = room.hostId === myId;
  const stage = reg.stage(room.stageId);
  const n = room.members.length;
  const countOk = !!stage.playerCounts[String(n) as "1"];
  const counts = Object.keys(stage.playerCounts).join(t("list.dot"));

  const link = inviteUrl(location.href, room.code);
  const copy = async (text: string, what: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // コピーできない環境では、表示されたコードやリンクを伝えてもらう
    }
  };
  const share = () => navigator.share({ title: "FOODIE QUEST", text: t("lobby.shareText"), url: link }).catch(() => undefined);

  return (
    <div className="rules panel lobby">
      <h1>{t("lobby.room")}</h1>
      {!online && <p className="lobby-error">{t("lobby.disconnected")}</p>}
      <div className="room-code">
        <span>{t("lobby.code")}</span>
        <strong>{room.code}</strong>
        <button type="button" className="ghost mini" onClick={() => copy(room.code, "code")}>
          {copied === "code" ? t("transfer.copied") : t("transfer.copy")}
        </button>
      </div>
      <div className="invite-link">
        <span>{t("lobby.inviteLink")}</span>
        <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label={t("lobby.inviteLinkLabel")} />
        <button type="button" className="mini" onClick={() => copy(link, "link")}>
          {copied === "link" ? t("transfer.copied") : t("lobby.copyLink")}
        </button>
        {typeof navigator.share === "function" && (
          <button type="button" className="ghost mini" onClick={share}>
            {t("lobby.share")}
          </button>
        )}
      </div>
      <h2>{t("lobby.members", { n })}</h2>
      <ul className="member-list">
        {room.members.map((m) => (
          <li key={m.id}>
            {m.name}
            {m.id === room.hostId && <span className="member-host">{t("lobby.host")}</span>}
            {m.id === myId && <span className="others-you">{t("lobby.you")}</span>}
            {!m.connected && <span className="others-off">{t("lobby.waitingConnect")}</span>}
          </li>
        ))}
      </ul>
      <h2>{t("lobby.stage")}</h2>
      {isHost ? (
        <>
          <ol className="stage-list">
            {reg.stages.map((st, i) => {
              const open = isUnlocked(reg.stages, progress, st.id);
              const label = st.tutorial ? t("stage.tutorialLabel") : t("stage.label", { n: i });
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
                    <span className="stage-name">{open ? stageName(st) : t("stage.locked")}</span>
                    <span className="stage-desc">
                      {open
                        ? t("lobby.stagePlayers", { counts: Object.keys(st.playerCounts).join(t("list.dot")), boss: cardName(reg.enemy(st.bossId)) })
                        : t("lobby.stageLocked")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {!stage.tutorial && maxDangerFor(stage, progress, reg.maxDanger) > 0 && (
            <DangerPicker
              value={pendingDanger ?? room.danger}
              max={maxDangerFor(stage, progress, reg.maxDanger)}
              best={progress.bestDanger[stage.id]}
              disabled={room.started}
              onChange={changeDanger}
            />
          )}
          <p className="dialog-note">{t("lobby.hostNote")}</p>
        </>
      ) : (
        <div>
          <p>
            {t("lobby.chosenStage", {
              stage: stage.tutorial ? t("stage.tutorialLabel") : stageName(stage),
              danger: room.danger > 0 ? t("result.dangerSuffix", { n: room.danger }) : "",
              boss: cardName(reg.enemy(stage.bossId)),
            })}
          </p>
          {room.danger > 0 && (
            <ul className="danger-list">
              {dangerTexts(room.danger).map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          <p className="dialog-note">{t("lobby.guestNote")}</p>
        </div>
      )}
      {error && (
        <p className="lobby-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-buttons">
        <button type="button" className="ghost" onClick={leaveRoom}>
          {t("result.leaveRoom")}
        </button>
        <button type="button" onClick={() => go("title")}>
          {t("result.toTitle")}
        </button>
        {room.started && hasGame && (
          <button type="button" className="primary" onClick={() => go("game")}>
            {t("lobby.backToGame")}
          </button>
        )}
        {isHost && !room.started && (
          <button
            type="button"
            className="primary"
            disabled={!countOk}
            title={countOk ? undefined : t("lobby.countTitle", { counts })}
            onClick={async () => setError(await startRoom())}
          >
            {countOk ? t("lobby.start") : t("lobby.countButton", { counts })}
          </button>
        )}
        {!isHost && !room.started && <span className="dialog-note">{t("lobby.waitHost")}</span>}
      </div>
    </div>
  );
}
