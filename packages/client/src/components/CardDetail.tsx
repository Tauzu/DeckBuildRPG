// カードを大きく見せる（スマートフォンでは長押し、パソコンでは右クリック）
import { useStore } from "../store.js";
import { touchText } from "../text.js";
import { Card } from "./Card.js";

export function CardDetail() {
  const detail = useStore((s) => s.detail);
  const close = useStore((s) => s.showDetail);
  if (!detail) return null;
  return (
    <div className="overlay card-detail" role="dialog" aria-modal="true" aria-label="カードの詳細" onClick={() => close(null)} onContextMenu={(e) => e.preventDefault()}>
      <div className="card-detail-body">
        <div className="card-detail-card">
          <Card defId={detail.defId} hp={detail.hp} damage={detail.damage} />
        </div>
        {detail.tip && <p className="card-detail-tip">{touchText(detail.tip)}</p>}
        <button type="button" className="primary" onClick={() => close(null)}>
          閉じる
        </button>
      </div>
    </div>
  );
}
