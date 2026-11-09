// マルチ：操作がないと自動で進められるまでの残り時間（仕様書 9.4）
import { useEffect, useState } from "react";
import { useStore } from "../store.js";

export function TurnTimer() {
  const deadline = useStore((s) => s.turnDeadline);
  const waitingForMe = useStore((s) => s.update?.legal.waitingForMe ?? false);
  const over = useStore((s) => !!s.update?.view.result);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline === null || over) return null;
  const sec = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <div className={`turn-timer${waitingForMe ? " turn-timer-me" : ""}${sec <= 10 ? " turn-timer-low" : ""}`} role="timer" aria-live="off">
      {waitingForMe ? `あと ${sec} 秒で、操作がないと代わりに進みます` : `あと ${sec} 秒で、操作がないと自動で進みます`}
    </div>
  );
}
