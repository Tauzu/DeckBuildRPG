import { useEffect, useRef } from "react";
import { useStore } from "../store.js";

export function LogPanel() {
  const log = useStore((s) => s.log);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [log.length]);

  return (
    <section className="log panel">
      <h2>記録</h2>
      <div className="log-lines">
        {log.map((l) => (
          <div key={l.id} className={`log-line log-${l.kind}`}>
            {l.text}
          </div>
        ))}
        <div ref={end} />
      </div>
    </section>
  );
}
