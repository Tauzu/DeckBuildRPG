// ゲーム後の振り返り：ゲーム中に届いた更新から、手番ごとの流れと出来事を集める
import type { CardRegistry, GameUpdate } from "@deckbuild/core";

/** 手番のはじめ（と終わり）の様子 */
export interface TurnPoint {
  turn: number;
  villageHp: number;
  /** playerId → その時点の総獲得経験値 */
  exp: Record<string, number>;
}

export interface Review {
  points: TurnPoint[];
  buys: { turn: number; playerId: string; defId: string; cost: number }[];
  /** 敵の撃破（とどめを刺したプレイヤー） */
  kills: { turn: number; playerId: string; defId: string }[];
  /** 集落に敵が着いた（ダメージがあったものだけ） */
  hits: { turn: number; defId: string; damage: number; villageHp: number }[];
  curses: { turn: number; playerId: string }[];
  /** 1回の攻撃での最大ダメージ */
  bestHit: { turn: number; playerId: string; defId: string; damage: number } | null;
  /** 今の手番（イベントを受け取るたびに更新） */
  turn: number;
}

export function emptyReview(): Review {
  return { points: [], buys: [], kills: [], hits: [], curses: [], bestHit: null, turn: 0 };
}

/** 更新を1つ足す。元の値は変えない */
export function addToReview(r: Review, u: GameUpdate): Review {
  let turn = r.turn;
  const next: Review = { ...r, buys: [...r.buys], kills: [...r.kills], hits: [...r.hits], curses: [...r.curses] };
  let mark = false;
  for (const e of u.events) {
    switch (e.type) {
      case "turnStarted":
        turn = e.turnCount;
        mark = true;
        break;
      case "gameEnded":
        mark = true;
        break;
      case "cardBought":
        next.buys.push({ turn, playerId: e.playerId, defId: e.defId, cost: e.cost });
        break;
      case "attackResolved":
        if (e.defeated) next.kills.push({ turn, playerId: e.playerId, defId: e.targetDefId });
        if (e.damage > (next.bestHit?.damage ?? 0)) next.bestHit = { turn, playerId: e.playerId, defId: e.targetDefId, damage: e.damage };
        break;
      case "enemyArrived":
        if (e.damage > 0) next.hits.push({ turn, defId: e.defId, damage: e.damage, villageHp: e.villageHp });
        break;
      case "curseAdded":
        next.curses.push({ turn, playerId: e.playerId });
        break;
    }
  }
  // 最初の更新（イベントなし）でも、はじめの様子を残す
  if (r.points.length === 0) mark = true;
  next.turn = turn;
  if (mark) {
    const exp: Record<string, number> = {};
    for (const p of u.view.players) exp[p.id] = p.totalExp;
    const point: TurnPoint = { turn, villageHp: u.view.villageHp, exp };
    const last = r.points[r.points.length - 1];
    // 同じ手番の点は上書き（ゲームの終わりに、最後の様子へ置き換える）
    next.points = last && last.turn === turn ? [...r.points.slice(0, -1), point] : [...r.points, point];
  } else next.points = r.points;
  return next;
}

const TYPE_ORDER = ["hero", "weapon", "food", "curse", "enemy"] as const;

export interface DeckGroup {
  type: (typeof TYPE_ORDER)[number];
  label: string;
  total: number;
  rows: { defId: string; count: number }[];
}

const TYPE_LABEL: Record<(typeof TYPE_ORDER)[number], string> = {
  hero: "英雄",
  weapon: "武器",
  food: "食料",
  curse: "呪い",
  enemy: "戦利品",
};

/** 持っていたカードを、種類ごと・同じカードごとにまとめる */
export function groupDeck(defIds: string[], reg: CardRegistry): DeckGroup[] {
  const counts = new Map<string, number>();
  for (const id of defIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return TYPE_ORDER.map((type) => {
    const rows = [...counts]
      .filter(([id]) => reg.get(id).type === type)
      .map(([defId, count]) => ({ defId, count }))
      .sort((a, b) => (reg.get(a.defId).cost ?? 0) - (reg.get(b.defId).cost ?? 0) || a.defId.localeCompare(b.defId));
    return { type, label: TYPE_LABEL[type], total: rows.reduce((n, r) => n + r.count, 0), rows };
  }).filter((g) => g.total > 0);
}

/** 振り返りの一言（見つかったものだけ） */
export function highlights(r: Review, reg: CardRegistry, name: (playerId: string) => string, multi: boolean): string[] {
  const out: string[] = [];
  const who = (id: string) => (multi ? `${name(id)}が` : "");
  const worst = r.hits.reduce<Review["hits"][number] | null>((m, h) => (!m || h.damage > m.damage ? h : m), null);
  if (worst) out.push(`集落が一番傷ついたのは手番${worst.turn}：${reg.get(worst.defId).name}が着いて ${worst.damage} ダメージ`);
  else out.push("集落は一度も傷つかなかった");
  if (r.bestHit) out.push(`最大の一撃は手番${r.bestHit.turn}：${who(r.bestHit.playerId)}${reg.get(r.bestHit.defId).name}に ${r.bestHit.damage} ダメージ`);
  const firstKill = r.kills[0];
  if (firstKill) out.push(`最初の撃破は手番${firstKill.turn}：${who(firstKill.playerId)}${reg.get(firstKill.defId).name}`);
  if (r.curses.length > 0) out.push(`呪いを ${r.curses.length} 枚受けた`);
  return out;
}
