import { useState } from "react";
import { nextStage } from "../progress.js";
import { isRemote, reg, useStore } from "../store.js";
import { cardName, rankTitle, resultReason, stageName } from "../text.js";
import { ReviewPanel } from "./ReviewPanel.js";
import { achievementName, achievementText } from "../achievements.js";
import { t } from "../i18n.js";

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
        <div className="dialog panel result result-review" role="dialog" aria-modal="true" aria-label={t("result.reviewTitle")}>
          <h2>{t("result.reviewTitle")}</h2>
          <ReviewPanel review={review} />
          <div className="dialog-buttons">
            <button type="button" className="primary" onClick={() => setReviewing(false)}>
              {t("result.backToResult")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className={`dialog panel result ${win ? "result-win" : "result-lose"}`} role="dialog" aria-modal="true">
        <h2 className="result-title">{win ? t("result.win") : t("result.lose")}</h2>
        <p>
          {t("result.line", {
            stage: stageName(stage),
            danger: danger > 0 ? t("result.dangerSuffix", { n: danger }) : "",
            reason: resultReason(result.reason, cardName(reg.enemy(stage.bossId))),
          })}
        </p>
        {newlyCleared?.stage && (
          <p className="result-unlock">
            {stage.tutorial
              ? t("result.stageSelectUnlocked")
              : next
                ? t("result.nextUnlocked", { stage: stageName(next) })
                : t("result.allCleared")}
          </p>
        )}
        {nextDanger !== null && <p className="result-unlock">{t("result.dangerUnlocked", { n: nextDanger })}</p>}
        {newlyCleared?.danger && !stage.tutorial && danger === reg.maxDanger && (
          <p className="result-unlock">{t("result.maxDanger")}</p>
        )}
        {unlockedNow.length > 0 && (
          <ul className="result-achievements" aria-label={t("result.achievementsLabel")}>
            {unlockedNow.map((a) => (
              <li key={a.id}>
                <span className="achievement-mark">★</span> {t("result.achievement", { name: achievementName(a) })}
                <span className="achievement-text">{achievementText(a)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="result-rank">
          {t("result.rank")} <strong>{result.rank}</strong>
        </div>
        <div className="result-sub">
          {t("result.sub", { hp: result.villageHp, max: update.view.config.villageHp, turns: update.view.turnCount })}
        </div>
        <table className="result-table">
          <thead>
            <tr>
              <th>{t("result.player")}</th>
              <th>{t("result.totalExp")}</th>
              <th>{t("result.kills")}</th>
              {multi && <th>{t("result.titleCol")}</th>}
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
                {multi && <td>{rankTitle(result.titles[p.id] ?? "")}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dialog-buttons">
          <button type="button" onClick={() => setReviewing(true)}>
            {t("result.review")}
          </button>
        </div>
        {remote ? (
          <div className="dialog-buttons">
            <button type="button" className="ghost" onClick={leaveRoom}>
              {t("result.leaveRoom")}
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
                {t("result.backToLobby")}
              </button>
            ) : (
              <span className="dialog-note">{t("result.waitHost")}</span>
            )}
          </div>
        ) : (
          <div className="dialog-buttons">
            <button type="button" className="ghost" onClick={download}>
              {t("result.saveRecord")}
            </button>
            <button type="button" className="ghost" onClick={() => go("title")}>
              {t("result.toTitle")}
            </button>
            <button type="button" className={next || nextDanger !== null ? "ghost" : "primary"} onClick={() => startSolo(stage.id, undefined, danger)}>
              {t("result.again")}
            </button>
            {nextDanger !== null && (
              <button type="button" className={next && newlyCleared?.stage ? "" : "primary"} onClick={() => startSolo(stage.id, undefined, nextDanger)}>
                {t("result.tryDanger", { n: nextDanger })}
              </button>
            )}
            {next && (
              <button type="button" className={newlyCleared?.stage || nextDanger === null ? "primary" : ""} onClick={() => startSolo(next.id)}>
                {t("result.nextStage")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
