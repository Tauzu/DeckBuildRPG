// カード図鑑（企画書 13.4）：今までに見たカードを並べる。まだ見ていないカードは影だけ
import { PixelArt } from "../art/PixelArt.js";
import { spriteFor } from "../art/sprites.js";
import { bossHpFor, codexGroups, codexIds } from "../codex.js";
import { reg, useStore } from "../store.js";
import { Card } from "./Card.js";
import { CardDetail } from "./CardDetail.js";

/** まだ見ていないカード：同じ大きさの枠に影絵と「？？？」 */
function UnknownCard({ defId }: { defId: string }) {
  const def = reg.get(defId);
  const sprite = spriteFor(
    def.id,
    def.type === "hero" ? def.heroId : undefined,
  );
  return (
    <div className="card-wrap">
      <div
        className="card card-small card-unknown"
        aria-label="まだ見ていないカード"
      >
        <div className="card-name">？？？</div>
        <div className="card-art">
          {sprite && <PixelArt sprite={sprite} silhouette="#05071a" />}
        </div>
        <div className="card-note">未発見</div>
      </div>
    </div>
  );
}

export function CodexScreen() {
  const go = useStore((s) => s.go);
  const seen = useStore((s) => s.progress.seen);
  const showDetail = useStore((s) => s.showDetail);
  const groups = codexGroups(reg);
  const total = codexIds(reg).length;
  const found = codexIds(reg).filter((id) => seen.includes(id)).length;

  return (
    <main className="rules-screen">
      <div className="rules panel codex">
        <h1>カード図鑑</h1>
        <p className="stage-lead">
          ゲームで出会ったカードが載ります。
          <strong className="codex-count">
            {found} / {total}
          </strong>
          （カードを押すと大きく表示）
        </p>
        {groups.map((g) => {
          const ids = g.rows.flat();
          return (
            <section key={g.label} className="codex-group">
              <h2>
                {g.label}
                <span className="zone-sub">
                  {" "}
                  {ids.filter((id) => seen.includes(id)).length} / {ids.length}
                </span>
              </h2>
              <div className="codex-rows">
                {g.rows.map((row, i) => (
                  <div key={i} className="codex-row">
                    {row.map((id) => {
                      if (!seen.includes(id))
                        return <UnknownCard key={id} defId={id} />;
                      const def = reg.get(id);
                      const hp =
                        def.type === "enemy" && def.isBoss
                          ? bossHpFor(reg, id)
                          : undefined;
                      return (
                        <Card
                          key={id}
                          defId={id}
                          small
                          hp={hp}
                          onClick={() => showDetail({ defId: id, hp })}
                          hint="クリックで大きく表示"
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <p className="dialog-note">
          ボスの生命力は、1人で遊ぶときの値です（人数と危険度で変わります）。
        </p>
        <div className="dialog-buttons">
          <button type="button" className="primary" onClick={() => go("title")}>
            戻る
          </button>
        </div>
      </div>
      <CardDetail />
    </main>
  );
}
