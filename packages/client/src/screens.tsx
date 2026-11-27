import { useEffect, useState } from "react";
import { TitleScene } from "./art/TitleScene.js";
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
import { StampLayer } from "./components/StampLayer.js";
import { SoundControls } from "./components/SoundControls.js";
import { TurnTimer } from "./components/TurnTimer.js";
import { TutorialHint } from "./components/TutorialHint.js";
import { VillageStock } from "./components/VillageStock.js";
import { isUnlocked, maxDangerFor, stageSelectUnlocked } from "./progress.js";
import { isRemote, reg, useStore } from "./store.js";
import { FEEDBACK_URL, GOATCOUNTER_URL, SUPPORT_URL } from "./links.js";
import { cardName, stageDescription, stageName } from "./text.js";
import { LANGS, type Lang, RELEASED_LANGS, t } from "./i18n.js";
import { tr } from "./rich.js";

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
      <TitleScene />
      <div className="title-box panel">
        <p className="title-kicker">{t("title.kicker")}</p>
        <h1 className="title-logo">FOODIE QUEST</h1>
        <p className="title-sub">{t("title.sub")}</p>
        <p className="title-lead">
          {t("title.lead1")}
          <br />
          <span className="nowrap">{t("title.lead2")}</span>
          <span className="nowrap">{t("title.lead3")}</span>
        </p>
        <div className="title-buttons">
          {hasGame && (
            <button type="button" className="primary" onClick={() => go("game")}>
              {t("title.continue")}
            </button>
          )}
          {unlocked ? (
            <button type="button" className={hasGame ? "" : "primary"} onClick={() => go("stages")}>
              {t("title.stages")}
            </button>
          ) : (
            <>
              <button type="button" className={hasGame ? "" : "primary"} onClick={() => startSolo(tutorial?.id)}>
                {t("title.tutorial")}
              </button>
              <button type="button" disabled title={t("title.stagesLockedHint")}>
                {t("title.stagesLocked")}
              </button>
            </>
          )}
          <button type="button" className={inRoom && !hasGame ? "primary" : ""} onClick={() => go("lobby")}>
            {inRoom ? t("title.backToRoom") : t("title.online")}
          </button>
          <button type="button" onClick={() => go("records")}>
            {t("title.records")}
          </button>
          <button type="button" onClick={() => go("codex")}>
            {t("title.codex")}
          </button>
          <button type="button" onClick={() => go("rules")}>
            {t("title.rules")}
          </button>
        </div>
        <SoundControls />
        <LangPicker />
        {(FEEDBACK_URL || SUPPORT_URL) && (
          <p className="title-links">
            {FEEDBACK_URL && (
              <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
                {t("title.feedback")}
              </a>
            )}
            {SUPPORT_URL && (
              <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                {t("title.support")}
              </a>
            )}
          </p>
        )}
        {GOATCOUNTER_URL && <p className="title-privacy">{t("title.privacy")}</p>}
      </div>
    </main>
  );
}

/** 言語の切り替え。翻訳がそろった言語が2つ以上になるまでは、そろっていない言語を見ているときだけ出す */
function LangPicker() {
  const lang = useStore((s) => s.lang);
  const changeLang = useStore((s) => s.changeLang);
  if (RELEASED_LANGS.length < 2 && RELEASED_LANGS.includes(lang)) return null;
  return (
    <label className="title-lang">
      {t("lang.label")}{" "}
      <select value={lang} onChange={(e) => changeLang(e.target.value as Lang)}>
        {LANGS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
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
        <h1>{t("stages.title")}</h1>
        <p className="stage-lead">
          {t("stages.lead", { max: reg.maxDanger })}
        </p>
        <ol className="stage-list">
          {reg.stages.map((st, i) => {
            const open = isUnlocked(reg.stages, progress, st.id);
            const best = progress.bestDanger[st.id];
            const cleared = progress.cleared.includes(st.id);
            const label = st.tutorial ? t("stage.tutorialLabel") : t("stage.label", { n: i });
            const boss = cardName(reg.enemy(st.bossId));
            const max = maxDangerFor(st, progress, reg.maxDanger);
            const danger = Math.min(dangers[st.id] ?? max, max);
            return (
              <li key={st.id} className={`stage-item${open ? "" : " stage-locked"}`}>
                <button
                  type="button"
                  className="stage-button"
                  disabled={!open}
                  title={open ? undefined : t("stages.lockedTitle")}
                  onClick={() => startSolo(st.id, undefined, danger)}
                >
                  <span className="stage-label">{label}</span>
                  <span className="stage-name">{open ? stageName(st) : t("stage.locked")}</span>
                  {cleared && (
                    <span className="stage-cleared">{!st.tutorial && best !== undefined && best > 0 ? t("stages.clearedDanger", { n: best }) : t("stages.cleared")}</span>
                  )}
                  <span className="stage-desc">{open ? t("stages.desc", { desc: stageDescription(st), boss }) : t("stages.lockedDesc")}</span>
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
            {t("common.back")}
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
        <h1>{t("rules.title")}</h1>
        <h2>{t("rules.goalH")}</h2>
        <p>{tr("rules.goal")}</p>
        <h2>{t("rules.turnH")}</h2>
        <p>{t("rules.turn")}</p>
        <ul>
          <li>{tr("rules.turnVillage")}</li>
          <li>{tr("rules.turnBattle")}</li>
        </ul>
        <h2>{t("rules.cardsH")}</h2>
        <ul>
          <li>{tr("rules.cardFood")}</li>
          <li>{tr("rules.cardHero")}</li>
          <li>{tr("rules.cardWeapon")}</li>
          <li>{tr("rules.cardEnemy")}</li>
        </ul>
        <h2>{t("rules.bossH")}</h2>
        <p>{t("rules.boss")}</p>
        <h2>{t("rules.stagesH")}</h2>
        <p>{t("rules.stages")}</p>
        <h2>{t("rules.dangerH")}</h2>
        <p>{t("rules.danger", { max: reg.maxDanger })}</p>
        <p>{t("rules.save")}</p>
        <h2>{t("rules.resistH")}</h2>
        <p>{t("rules.resist")}</p>
        <h2>{t("rules.growthH")}</h2>
        <p>{t("rules.growth")}</p>
        <div className="dialog-buttons">
          <button type="button" className="primary" onClick={() => go("title")}>
            {t("common.back")}
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
    const timer = setTimeout(clearToast, 2500);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!update) return null;
  return (
    <div className="game">
      <header className="game-header">
        <button type="button" className="ghost mini" onClick={() => go("title")}>
          {t("game.title")}
        </button>
        <span className="game-title">{stageName(reg.stage(update.view.config.stageId))}</span>
        {update.view.config.danger > 0 && <span className="game-danger">{t("game.danger", { n: update.view.config.danger })}</span>}
        <span className="game-turn">{t("game.turn", { n: update.view.turnCount })}</span>
        <SoundControls compact />
        {remote ? (
          <span className="game-seed">{t("game.room", { code: room?.code ?? "" })}</span>
        ) : (
          <span className="game-seed" title={t("game.seedTitle")}>
            {t("game.seed", { seed: conn ? conn.seed >>> 0 : "-" })}
          </span>
        )}
      </header>
      {remote && !online && <div className="net-banner">{t("game.disconnected")}</div>}
      <div className="game-sticky">
        <TurnTimer />
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
      <StampLayer />
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
