import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameScreen, RulesScreen, TitleScreen } from "./screens.js";
import { useStore } from "./store.js";
import "./styles.css";

function App() {
  const screen = useStore((s) => s.screen);
  if (screen === "game") return <GameScreen />;
  if (screen === "rules") return <RulesScreen />;
  return <TitleScreen />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
