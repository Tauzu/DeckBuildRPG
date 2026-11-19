// 選択中のカードの扱い
import type { GameUpdate } from "./connection.js";

/**
 * 更新が来たときに、選択中のカードを残すか。他のプレイヤーが先に捨てた・廃棄した（自分の選択は変わらない）だけなら残す。
 * 求められている選択の種類・枚数が変わったり、選んだカードが手札・捨て札からなくなったりしたら空にする
 */
export function keepSelection(current: string[], before: GameUpdate | null, after: GameUpdate): string[] {
  if (current.length === 0) return current;
  const a = before?.legal.selection;
  const b = after.legal.selection;
  if (!a || !b || a.kind !== b.kind) return [];
  if (a.kind === "discard" && b.kind === "discard" && a.count !== b.count) return [];
  if (a.kind === "trash" && b.kind === "trash" && a.max !== b.max) return [];
  const me = after.view.players.find((p) => p.id === after.view.viewerId);
  // 手札を捨てる選択は手札のカードだけが対象。捨て札にあるカードは（直前に捨てたもの）残さない
  const pool = a.kind === "discard" ? (me?.hand ?? []) : [...(me?.hand ?? []), ...(me?.discard ?? [])];
  const has = new Set(pool.map((c) => c.uid));
  return current.every((uid) => has.has(uid)) ? current : [];
}
