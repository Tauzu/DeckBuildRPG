import type { CardInstance } from "@deckbuild/core";
import { useStore } from "../store.js";
import { Card } from "./Card.js";
import { t } from "../i18n.js";

/** 廃棄・手札を捨てる選択 */
export function PendingDialog() {
  const update = useStore((s) => s.update)!;
  const send = useStore((s) => s.send);
  const selection = useStore((s) => s.selection);
  const toggle = useStore((s) => s.toggleSelect);
  const sel = update.legal.selection;
  // 凍結・後退は、進軍ルートの敵をクリックして選ぶ（RouteView）
  if (!sel || sel.kind === "target") return null;
  const me = update.view.players.find((p) => p.id === update.view.viewerId)!;

  if (sel.kind === "trash") {
    return (
      <Dialog
        title={t("pending.trashTitle")}
        note={t("pending.trashNote", { n: sel.max })}
        groups={[
          { label: t("pending.hand"), cards: me.hand ?? [] },
          { label: t("pending.discardPile"), cards: me.discard ?? [] },
        ]}
        selection={selection}
        onToggle={(uid) => toggle(uid, sel.max)}
        confirmLabel={selection.length === 0 ? t("pending.noTrash") : t("pending.trashN", { n: selection.length })}
        canConfirm
        onConfirm={() => send({ type: "resolveTrash", uids: selection })}
      />
    );
  }

  return (
    <Dialog
      title={t("pending.discardTitle")}
      note={t("pending.discardNote", { n: sel.count })}
      groups={[{ label: t("pending.hand"), cards: me.hand ?? [] }]}
      selection={selection}
      onToggle={(uid) => toggle(uid, sel.count)}
      confirmLabel={t("pending.discardN", { n: selection.length, max: sel.count })}
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
              {t("pending.groupCount", { label: g.label, n: g.cards.length })}
            </h3>
            <div className="zone-cards">
              {g.cards.length === 0 && <div className="zone-empty">{t("pending.none")}</div>}
              {g.cards.map((c) => (
                <Card
                  key={c.uid}
                  defId={c.defId}
                  small
                  onClick={() => onToggle(c.uid)}
                  hint={selection.includes(c.uid) ? t("pending.unselect") : t("pending.select")}
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
