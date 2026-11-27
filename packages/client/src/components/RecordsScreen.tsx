// 実績と記録（企画書 13.2、13.3）：実績の一覧、通算の記録、ステージごとの最高危険度、引き継ぎコード
import { useState } from "react";
import { ACHIEVEMENTS, type AchievementGroup, achievementGroupName, achievementName, achievementText, heroWinsCount } from "../achievements.js";
import { codexIds } from "../codex.js";
import { reg, useStore } from "../store.js";
import { stageName } from "../text.js";
import { t } from "../i18n.js";

const GROUPS: AchievementGroup[] = ["進行", "戦い方", "協力", "通算"];

function date(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function RecordsScreen() {
  const go = useStore((s) => s.go);
  const progress = useStore((s) => s.progress);
  const done = ACHIEVEMENTS.filter((a) => progress.achievements[a.id] !== undefined).length;
  const heroes = heroWinsCount(reg, progress);
  const { stats } = progress;

  return (
    <main className="rules-screen">
      <div className="rules panel records">
        <h1>{t("records.title")}</h1>

        <section className="records-summary">
          <div>
            <span>{t("records.achievements")}</span>
            <strong>
              {done} / {ACHIEVEMENTS.length}
            </strong>
          </div>
          <div>
            <span>{t("records.total")}</span>
            <strong>
              {t("records.winLoss", { wins: stats.wins, games: stats.games })}
            </strong>
          </div>
          <div>
            <span>{t("records.kills")}</span>
            <strong>{t("records.killsN", { n: stats.kills })}</strong>
          </div>
          <div>
            <span>{t("records.codex")}</span>
            <strong>
              {codexIds(reg).filter((id) => progress.seen.includes(id)).length} / {codexIds(reg).length}
            </strong>
          </div>
          <div>
            <span>{t("records.heroes")}</span>
            <strong>
              {heroes.done} / {heroes.total}
            </strong>
          </div>
        </section>

        <h2>{t("records.stages")}</h2>
        <table className="result-table records-stages">
          <tbody>
            {reg.stages
              .filter((st) => !st.tutorial)
              .map((st) => {
                const best = progress.bestDanger[st.id];
                return (
                  <tr key={st.id}>
                    <td>{progress.cleared.includes(st.id) || best !== undefined ? stageName(st) : t("records.locked")}</td>
                    <td className="records-danger">
                      {best === undefined ? t("records.notCleared") : best === 0 ? t("records.clearedNormal") : t("records.bestDanger", { n: best, max: reg.maxDanger })}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {GROUPS.map((g) => (
          <section key={g}>
            <h2>{achievementGroupName(g)}</h2>
            <ul className="achievement-list">
              {ACHIEVEMENTS.filter((a) => a.group === g).map((a) => {
                const at = progress.achievements[a.id];
                return (
                  <li key={a.id} className={at !== undefined ? "achievement-done" : undefined}>
                    <span className="achievement-mark" aria-label={at !== undefined ? t("records.done") : t("records.notDone")}>
                      {at !== undefined ? "★" : "☆"}
                    </span>
                    <span className="achievement-name">{achievementName(a)}</span>
                    <span className="achievement-text">{achievementText(a)}</span>
                    {at !== undefined && <span className="achievement-date">{date(at)}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <TransferBox />

        <div className="dialog-buttons">
          <button type="button" className="primary" onClick={() => go("title")}>
            {t("common.back")}
          </button>
        </div>
      </div>
    </main>
  );
}

/** 引き継ぎコードの書き出し・読み込み */
function TransferBox() {
  const exportProgress = useStore((s) => s.exportProgress);
  const importProgress = useStore((s) => s.importProgress);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const make = async () => {
    try {
      setCode(await exportProgress());
      setCopied(false);
    } catch {
      setMessage({ ok: false, text: t("transfer.cantMake") });
    }
  };
  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // コピーできない環境では、表示されたコードを選んでコピーしてもらう
    }
  };
  const load = async () => {
    const err = await importProgress(input);
    setMessage(err ? { ok: false, text: err } : { ok: true, text: t("transfer.loaded") });
    if (!err) setInput("");
  };

  return (
    <section className="transfer">
      <h2>{t("transfer.title")}</h2>
      <p className="dialog-note">
        {t("transfer.note")}
      </p>
      <div className="transfer-row">
        <button type="button" onClick={make}>
          {t("transfer.make")}
        </button>
        {code && (
          <button type="button" className="primary" onClick={copy}>
            {copied ? t("transfer.copied") : t("transfer.copy")}
          </button>
        )}
      </div>
      {code && <textarea className="transfer-code" readOnly value={code} rows={3} onFocus={(e) => e.currentTarget.select()} aria-label={t("transfer.codeLabel")} />}
      <label className="field transfer-field">
        <span>{t("transfer.loadLabel")}</span>
        <textarea value={input} rows={3} onChange={(e) => setInput(e.target.value)} placeholder={t("transfer.placeholder")} />
      </label>
      <div className="transfer-row">
        <button type="button" disabled={!input.trim()} onClick={load}>
          {t("transfer.load")}
        </button>
      </div>
      {message && (
        <p className={message.ok ? "result-unlock" : "lobby-error"} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
