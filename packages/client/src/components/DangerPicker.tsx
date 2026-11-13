// 危険度を選ぶ（企画書 13.1）。ステージ選択とルームで使う
import { reg } from "../store.js";

/** 危険度 level までに足される条件の説明 */
export function dangerTexts(level: number): string[] {
  return reg.dangers.slice(0, level).map((d) => d.text);
}

export function DangerPicker({
  value,
  max,
  best,
  onChange,
  disabled,
}: {
  value: number;
  /** 選べる最高の危険度 */
  max: number;
  /** クリアした最高の危険度（まだなら undefined） */
  best?: number | undefined;
  onChange(level: number): void;
  disabled?: boolean;
}) {
  const texts = dangerTexts(value);
  return (
    <div className="danger-picker">
      <div className="danger-row">
        <span className="danger-label">危険度</span>
        <button type="button" className="mini" aria-label="危険度を下げる" disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}>
          －
        </button>
        <strong className={`danger-value${value > 0 ? " danger-on" : ""}`} aria-live="polite">
          {value === 0 ? "通常" : `+${value}`}
        </strong>
        <button type="button" className="mini" aria-label="危険度を上げる" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
          ＋
        </button>
        <span className="danger-note">
          {best !== undefined ? `クリアした最高：${best === 0 ? "通常" : `危険度+${best}`}` : "クリアすると危険度が解放されます"}
        </span>
      </div>
      {texts.length > 0 && (
        <ul className="danger-list">
          {texts.map((t, i) => (
            <li key={i} className={i === texts.length - 1 ? "danger-new" : undefined}>
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
