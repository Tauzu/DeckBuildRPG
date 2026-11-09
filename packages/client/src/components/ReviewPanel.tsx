// ゲーム後の振り返り：持っていたデッキ、手番ごとの流れ、買い物と出来事
import { useState } from "react";
import { groupDeck, highlights, type Review, type TurnPoint } from "../review.js";
import { reg, useStore } from "../store.js";
import { Card } from "./Card.js";

const LINE_COLORS = ["var(--accent)", "var(--mag)", "var(--good)", "var(--phys)"];
const W = 320;
const H = 110;
const PAD = { l: 30, r: 8, t: 8, b: 18 };

/** 手番ごとの折れ線。series はそれぞれ点の列（x は手番、y は値） */
function LineChart({ title, series, yMax }: { title: string; series: { name: string; color: string; points: { x: number; y: number }[] }[]; yMax: number }) {
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs, xMin + 1);
  const px = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
  const py = (y: number) => PAD.t + (1 - y / Math.max(yMax, 1)) * (H - PAD.t - PAD.b);
  return (
    <figure className="review-chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <line x1={PAD.l} y1={py(0)} x2={W - PAD.r} y2={py(0)} stroke="var(--edge-dim)" />
        <line x1={PAD.l} y1={py(yMax)} x2={W - PAD.r} y2={py(yMax)} stroke="var(--edge-dim)" strokeDasharray="2 3" />
        <text x={PAD.l - 4} y={py(yMax) + 4} textAnchor="end" fill="var(--ink-soft)" fontSize="10">
          {yMax}
        </text>
        <text x={PAD.l - 4} y={py(0) + 3} textAnchor="end" fill="var(--ink-soft)" fontSize="10">
          0
        </text>
        <text x={PAD.l} y={H - 4} fill="var(--ink-soft)" fontSize="10">
          手番{xMin}
        </text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end" fill="var(--ink-soft)" fontSize="10">
          {xMax}
        </text>
        {series.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            points={s.points.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")}
          />
        ))}
      </svg>
      {series.length > 1 && (
        <div className="review-legend">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} /> {s.name}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}

const series = (points: TurnPoint[], pick: (p: TurnPoint) => number) => points.map((p) => ({ x: p.turn, y: pick(p) }));

export function ReviewPanel({ review }: { review: Review }) {
  const update = useStore((s) => s.update)!;
  const players = update.view.players;
  const multi = players.length >= 2;
  const [who, setWho] = useState(update.view.viewerId);
  const target = players.find((p) => p.id === who) ?? players[0]!;
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? "？";
  const { config } = update.view;
  const groups = groupDeck((target.allCards ?? []).map((c) => c.defId), reg);
  const total = groups.reduce((n, g) => n + g.total, 0);
  const myBuys = review.buys.filter((b) => b.playerId === target.id);
  const mySpent = myBuys.reduce((n, b) => n + b.cost, 0);
  const myKills = review.kills.filter((k) => k.playerId === target.id);
  const expMax = Math.max(...review.points.flatMap((p) => Object.values(p.exp)), 1);

  return (
    <div className="review">
      {multi && (
        <div className="review-tabs" role="tablist">
          {players.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === target.id} className={p.id === target.id ? "primary" : "ghost"} onClick={() => setWho(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <section>
        <h3>ふりかえり</h3>
        <ul className="review-highlights">
          {highlights(review, reg, name, multi).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>手番ごとの流れ</h3>
        {review.points.length >= 2 ? (
          <>
            <LineChart title="集落の耐久値" yMax={config.villageHp} series={[{ name: "耐久値", color: "var(--bad)", points: series(review.points, (p) => p.villageHp) }]} />
            <LineChart
              title="総獲得経験値"
              yMax={expMax}
              series={players.map((p, i) => ({ name: p.name, color: LINE_COLORS[i % LINE_COLORS.length]!, points: series(review.points, (pt) => pt.exp[p.id] ?? 0) }))}
            />
          </>
        ) : (
          <p className="dialog-note">記録が足りないため、グラフは出せません。</p>
        )}
      </section>

      <section>
        <h3>
          {multi ? `${target.name}の` : ""}最終デッキ <span className="zone-sub">{total}枚</span>
        </h3>
        {groups.length === 0 && <p className="dialog-note">カードの記録がありません。</p>}
        {groups.map((g) => (
          <div key={g.type} className="review-group">
            <h4>
              {g.label} <span className="zone-sub">{g.total}枚</span>
            </h4>
            <div className="review-cards">
              {g.rows.map((r) => (
                <Card key={r.defId} defId={r.defId} small badge={<span className="stack-count">×{r.count}</span>} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h3>買い物と戦果</h3>
        <p className="review-summary">
          買ったカード {myBuys.length}枚（使った金 {mySpent}） ・ 撃破 {myKills.length}体 ・ 呪い {review.curses.filter((c) => c.playerId === target.id).length}枚
        </p>
        {myBuys.length > 0 && (
          <ol className="review-buys">
            {myBuys.map((b, i) => (
              <li key={i}>
                <span className="review-turn">手番{b.turn}</span> {reg.get(b.defId).name}
                <span className="zone-sub"> （{b.cost}）</span>
              </li>
            ))}
          </ol>
        )}
        {myKills.length > 0 && (
          <p className="review-summary">
            倒した敵：
            {[...myKills.reduce((m, k) => m.set(k.defId, (m.get(k.defId) ?? 0) + 1), new Map<string, number>())]
              .map(([id, n]) => `${reg.get(id).name}×${n}`)
              .join("、")}
          </p>
        )}
      </section>
    </div>
  );
}
