// スマートフォンの縦持ち：村の在庫・記録・プレイヤーをタブで切り替える
import { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { BattlePanel } from "./BattlePanel.js";
import { LogPanel } from "./LogPanel.js";
import { OthersPanel } from "./OthersPanel.js";
import { VillageStock } from "./VillageStock.js";

type Tab = "main" | "log" | "players";

export function MobilePanels() {
  const update = useStore((s) => s.update)!;
  const step = update.view.step.kind;
  const inBattle = step === "battle" || step === "afterBattle";
  const multi = update.view.players.length >= 2;
  const [tab, setTab] = useState<Tab>("main");

  // 集落を訪れたとき・戦闘を始めたときは、在庫（戦闘）のタブに戻す
  useEffect(() => {
    if (step === "village" || step === "battle") setTab("main");
  }, [step]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "main", label: inBattle ? "戦闘" : "村の在庫" },
    { id: "log", label: "記録" },
    ...(multi ? [{ id: "players" as const, label: "プレイヤー" }] : []),
  ];

  return (
    <div className="mobile-panels">
      <div className="mobile-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`mobile-tab${tab === t.id ? " mobile-tab-on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "main" && (inBattle ? <BattlePanel /> : <VillageStock />)}
      {tab === "log" && <LogPanel />}
      {tab === "players" && <OthersPanel />}
    </div>
  );
}
