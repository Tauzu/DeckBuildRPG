import { useEffect, useRef } from "react";
import { useStore } from "../store.js";

export function LogPanel() {
  const log = useStore((s) => s.log);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 記録の欄の中だけを一番下までスクロールする（scrollIntoView はページ全体も動かしてしまうため使わない）
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <section className="log panel">
      <h2>記録</h2>
      <div className="log-lines" ref={box}>
        {log.map((l) => (
          <div key={l.id} className={`log-line log-${l.kind}`}>
            {l.text}
          </div>
        ))}
      </div>
    </section>
  );
}
