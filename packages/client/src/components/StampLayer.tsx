// 送られたスタンプを、画面の決まった位置（スクロールしても動かない）に大きく出す
import { PixelArt } from "../art/PixelArt.js";
import { stampSprite } from "../art/stamps.js";
import { useStore } from "../store.js";

export function StampLayer() {
  const stamps = useStore((s) => s.stamps);
  const players = useStore((s) => s.update?.view.players);
  const mine = useStore((s) => s.myId);
  const entries = Object.entries(stamps);
  if (entries.length === 0) return null;
  return (
    <div className="stamp-layer" aria-live="polite">
      {entries.map(([id, st]) => {
        const sprite = stampSprite(st.id);
        if (!sprite) return null;
        const name = players?.find((p) => p.id === id)?.name ?? "";
        return (
          <div key={`${id}-${st.n}`} className={`stamp-toast${id === mine ? " stamp-toast-mine" : ""}`}>
            <PixelArt sprite={sprite} className="stamp-toast-art" />
            <span className="stamp-toast-name">{name}</span>
          </div>
        );
      })}
    </div>
  );
}
