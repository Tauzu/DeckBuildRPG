// 危険度を選ぶ（企画書 13.1）。ステージ選択とルームで使う
import { reg } from "../store.js";
import { dangerText } from "../text.js";
import { t } from "../i18n.js";

/** 危険度 level までに足される条件の説明 */
export function dangerTexts(level: number): string[] {
  return reg.dangers.slice(0, level).map(dangerText);
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
        <span className="danger-label">{t("danger.label")}</span>
        <button type="button" className="mini" aria-label={t("danger.down")} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}>
          －
        </button>
        <strong className={`danger-value${value > 0 ? " danger-on" : ""}`} aria-live="polite">
          {value === 0 ? t("danger.normal") : `+${value}`}
        </strong>
        <button type="button" className="mini" aria-label={t("danger.up")} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
          ＋
        </button>
        <span className="danger-note">
          {best !== undefined ? t("danger.best", { best: best === 0 ? t("danger.normal") : t("danger.bestLevel", { n: best }) }) : t("danger.locked")}
        </span>
      </div>
      {texts.length > 0 && (
        <ul className="danger-list">
          {texts.map((text, i) => (
            <li key={i} className={i === texts.length - 1 ? "danger-new" : undefined}>
              {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
