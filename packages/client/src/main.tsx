import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { LobbyScreen } from "./components/LobbyScreen.js";
import { RecordsScreen } from "./components/RecordsScreen.js";
import { CodexScreen } from "./components/CodexScreen.js";
import { GameScreen, RulesScreen, StageSelectScreen, TitleScreen } from "./screens.js";
import { playSfx, setBgmScene, unlockAudio } from "./audio.js";
import { useStore } from "./store.js";
import { count } from "./analytics.js";
import "@fontsource/dotgothic16/400.css";
import "./styles.css";

function App() {
  const screen = useStore((s) => s.screen);
  const stageId = useStore((s) => s.update?.view.config.stageId);
  // ゲーム以外の画面ではタイトルのBGM、ゲーム中はステージのBGM
  useEffect(() => setBgmScene(screen === "game" && stageId ? stageId : "menu"), [screen, stageId]);
  if (screen === "game") return <GameScreen />;
  if (screen === "rules") return <RulesScreen />;
  if (screen === "stages") return <StageSelectScreen />;
  if (screen === "lobby") return <LobbyScreen />;
  if (screen === "records") return <RecordsScreen />;
  if (screen === "codex") return <CodexScreen />;
  return <TitleScreen />;
}

count({ type: "open" });

/** 言語が変わったら、画面をまるごと作り直す（文言は描くときに引くので） */
function Root() {
  const lang = useStore((s) => s.lang);
  return <App key={lang} />;
}

// ブラウザは操作があるまで音を出させないので、最初の操作で音の準備をする
window.addEventListener("pointerdown", () => unlockAudio(), { once: true });
window.addEventListener("keydown", () => unlockAudio(), { once: true });
// カード以外のボタンを押したときの小さな音
document.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement | null)?.closest("button");
  if (b && !b.classList.contains("card") && !b.disabled) playSfx("click");
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
