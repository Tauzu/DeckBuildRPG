// 戦闘中は村の在庫の代わりに、戦っている相手とダメージの見込みを大きく出す
import { reg, useStore } from "../store.js";
import { Card } from "./Card.js";

export function BattlePanel() {
  const update = useStore((s) => s.update)!;
  const { view, info } = update;
  const turn = view.turn;
  const cur = view.players.find((p) => p.id === view.currentPlayerId);
  const who = cur && cur.id !== view.viewerId ? `${cur.name}の戦闘` : "戦闘";

  if (view.step.kind === "afterBattle") {
    return (
      <section className="battle-panel panel">
        <h2>{who}</h2>
        <p className="battle-result battle-win">撃破しました！</p>
        <p className="dialog-note">経験値で、場で戦った英雄や手札の英雄をレベルアップ・転職できます。終えると手番が終わります。</p>
      </section>
    );
  }

  const target = turn?.action === "battle" ? view.route.flat().find((c) => c.uid === turn.targetUid) : undefined;
  if (!target) return null;
  const def = reg.enemy(target.defId);
  const p = info.preview;
  const hp = p?.hp ?? def.hp ?? 0;
  const prev = p?.prevDamage ?? 0;
  const dmg = p?.total ?? 0;
  const rest = Math.max(0, hp - prev - dmg);
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / Math.max(1, hp)) * 100))}%`;
  const ok = prev + dmg >= hp;

  return (
    <section className="battle-panel panel">
      <h2>{who}</h2>
      <div className="battle-body">
        <Card defId={target.defId} hp={def.isBoss ? view.config.bossHp : undefined} damage={view.enemyDamage[target.uid]} highlight="target" />
        <div className="battle-numbers">
          <div className="battle-row">
            <span>生命力</span>
            <strong>{hp}</strong>
          </div>
          {prev > 0 && (
            <div className="battle-row">
              <span>これまでのダメージ</span>
              <strong>{prev}</strong>
            </div>
          )}
          <div className="battle-row">
            <span>ダメージ見込み</span>
            <strong className={ok ? "info-ok" : ""}>{dmg}</strong>
          </div>
          <div className="battle-bar" aria-hidden="true">
            <div className="battle-bar-prev" style={{ width: pct(prev) }} />
            <div className="battle-bar-now" style={{ width: pct(Math.min(dmg, hp - prev)) }} />
          </div>
          <p className={`battle-result ${ok ? "battle-win" : ""}`}>
            {ok ? "倒せる！ 「攻撃を確定」で撃破" : def.isBoss ? `残り生命力 ${rest}（ダメージは次の手番も残る）` : `あと ${rest} 足りない`}
          </p>
          {p && (p.physical !== p.physicalAfter || p.magic !== p.magicAfter) && (
            <p className="dialog-note">
              耐性で 物理 {p.physical}→{p.physicalAfter}、魔法 {p.magic}→{p.magicAfter}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
