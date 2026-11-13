// 実績と記録（企画書 13.2、13.3）：実績の一覧、通算の記録、ステージごとの最高危険度、引き継ぎコード
import { useState } from "react";
import { ACHIEVEMENTS, type AchievementGroup, heroWinsCount } from "../achievements.js";
import { codexIds } from "../codex.js";
import { reg, useStore } from "../store.js";

const GROUPS: AchievementGroup[] = ["進行", "戦い方", "協力", "通算"];

function date(t: number): string {
  const d = new Date(t);
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
        <h1>実績と記録</h1>

        <section className="records-summary">
          <div>
            <span>実績</span>
            <strong>
              {done} / {ACHIEVEMENTS.length}
            </strong>
          </div>
          <div>
            <span>通算</span>
            <strong>
              {stats.wins}勝 / {stats.games}戦
            </strong>
          </div>
          <div>
            <span>倒した魔物</span>
            <strong>{stats.kills}体</strong>
          </div>
          <div>
            <span>カード図鑑</span>
            <strong>
              {codexIds(reg).filter((id) => progress.seen.includes(id)).length} / {codexIds(reg).length}
            </strong>
          </div>
          <div>
            <span>英雄図鑑</span>
            <strong>
              {heroes.done} / {heroes.total}
            </strong>
          </div>
        </section>

        <h2>ステージ</h2>
        <table className="result-table records-stages">
          <tbody>
            {reg.stages
              .filter((st) => !st.tutorial)
              .map((st) => {
                const best = progress.bestDanger[st.id];
                return (
                  <tr key={st.id}>
                    <td>{progress.cleared.includes(st.id) || best !== undefined ? st.name : "？？？"}</td>
                    <td className="records-danger">
                      {best === undefined ? "未クリア" : best === 0 ? "クリア（通常）" : `危険度 +${best} / +${reg.maxDanger}`}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {GROUPS.map((g) => (
          <section key={g}>
            <h2>{g}</h2>
            <ul className="achievement-list">
              {ACHIEVEMENTS.filter((a) => a.group === g).map((a) => {
                const at = progress.achievements[a.id];
                return (
                  <li key={a.id} className={at !== undefined ? "achievement-done" : undefined}>
                    <span className="achievement-mark" aria-label={at !== undefined ? "達成" : "未達成"}>
                      {at !== undefined ? "★" : "☆"}
                    </span>
                    <span className="achievement-name">{a.name}</span>
                    <span className="achievement-text">{a.text}</span>
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
            戻る
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
      setMessage({ ok: false, text: "このブラウザでは引き継ぎコードを作れません" });
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
    setMessage(err ? { ok: false, text: err } : { ok: true, text: "読み込みました。今の記録と合わせています（どちらの記録も消えません）" });
    if (!err) setInput("");
  };

  return (
    <section className="transfer">
      <h2>引き継ぎ</h2>
      <p className="dialog-note">
        記録はこのブラウザに保存されています。別の機器やブラウザで続けるときは、引き継ぎコードを作って、移した先で読み込んでください。
      </p>
      <div className="transfer-row">
        <button type="button" onClick={make}>
          引き継ぎコードを作る
        </button>
        {code && (
          <button type="button" className="primary" onClick={copy}>
            {copied ? "コピーしました" : "コピー"}
          </button>
        )}
      </div>
      {code && <textarea className="transfer-code" readOnly value={code} rows={3} onFocus={(e) => e.currentTarget.select()} aria-label="引き継ぎコード" />}
      <label className="field transfer-field">
        <span>引き継ぎコードを読み込む</span>
        <textarea value={input} rows={3} onChange={(e) => setInput(e.target.value)} placeholder="HK1-… を貼り付け" />
      </label>
      <div className="transfer-row">
        <button type="button" disabled={!input.trim()} onClick={load}>
          読み込む
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
