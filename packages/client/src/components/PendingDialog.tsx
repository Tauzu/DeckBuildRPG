import type { CardInstance } from "@deckbuild/core";
import { useStore } from "../store.js";
import { Card } from "./Card.js";

/** 廃棄・手札を捨てる選択 */
export function PendingDialog() {
  const update = useStore((s) => s.update)!;
  const send = useStore((s) => s.send);
  const selection = useStore((s) => s.selection);
  const toggle = useStore((s) => s.toggleSelect);
  const sel = update.legal.selection;
  if (!sel) return null;
  const me = update.view.players.find((p) => p.id === update.view.viewerId)!;

  if (sel.kind === "trash") {
    return (
      <Dialog
        title="僧侶：廃棄するカードを選ぶ"
        note={`手札か捨て札から ${sel.max}枚まで選べます（選ばなくてもかまいません）。廃棄したカードはゲームから取り除かれます。`}
        groups={[
          { label: "手札", cards: me.hand ?? [] },
          { label: "捨て札", cards: me.discard ?? [] },
        ]}
        selection={selection}
        onToggle={(uid) => toggle(uid, sel.max)}
        confirmLabel={selection.length === 0 ? "廃棄しない" : `${selection.length}枚を廃棄する`}
        canConfirm
        onConfirm={() => send({ type: "resolveTrash", uids: selection })}
      />
    );
  }

  return (
    <Dialog
      title="手札を捨てる"
      note={`敵の能力により、手札を ${sel.count}枚選んで捨てます。`}
      groups={[{ label: "手札", cards: me.hand ?? [] }]}
      selection={selection}
      onToggle={(uid) => toggle(uid, sel.count)}
      confirmLabel={`${selection.length} / ${sel.count}枚を捨てる`}
      canConfirm={selection.length === sel.count}
      onConfirm={() => send({ type: "discardForEffect", uids: selection })}
    />
  );
}

interface DialogProps {
  title: string;
  note: string;
  groups: { label: string; cards: CardInstance[] }[];
  selection: string[];
  onToggle(uid: string): void;
  confirmLabel: string;
  canConfirm: boolean;
  onConfirm(): void;
}

function Dialog({ title, note, groups, selection, onToggle, confirmLabel, canConfirm, onConfirm }: DialogProps) {
  return (
    <div className="overlay">
      <div className="dialog panel" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p className="dialog-note">{note}</p>
        {groups.map((g) => (
          <div key={g.label} className="dialog-group">
            <h3>
              {g.label}（{g.cards.length}枚）
            </h3>
            <div className="zone-cards">
              {g.cards.length === 0 && <div className="zone-empty">（なし）</div>}
              {g.cards.map((c) => (
                <Card
                  key={c.uid}
                  defId={c.defId}
                  small
                  onClick={() => onToggle(c.uid)}
                  highlight={selection.includes(c.uid) ? "selected" : undefined}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="dialog-buttons">
          <button type="button" className="primary" disabled={!canConfirm} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
