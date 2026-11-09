import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LobbyScreen } from "./components/LobbyScreen.js";
import { GameScreen, RulesScreen, StageSelectScreen, TitleScreen } from "./screens.js";
import { playSfx, unlockAudio } from "./audio.js";
import { useStore } from "./store.js";
import "@fontsource/dotgothic16/400.css";
import "./styles.css";

function App() {
  const screen = useStore((s) => s.screen);
  if (screen === "game") return <GameScreen />;
  if (screen === "rules") return <RulesScreen />;
  if (screen === "stages") return <StageSelectScreen />;
  if (screen === "lobby") return <LobbyScreen />;
  return <TitleScreen />;
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
    <App />
  </StrictMode>,
);
