import { describe, expect, it } from "vitest";
import type { GameUpdate } from "../src/connection.js";
import { keepSelection } from "../src/selection.js";

const update = (selection: unknown, hand: string[]): GameUpdate =>
  ({
    legal: { selection },
    view: { viewerId: "p1", players: [{ id: "p1", hand: hand.map((uid) => ({ uid, defId: "x" })), discard: [] }] },
  }) as unknown as GameUpdate;

describe("選択中のカードを残すか", () => {
  it("他のプレイヤーが先に捨てただけ（自分の選択は同じ）なら、選択を残す", () => {
    const before = update({ kind: "discard", count: 1 }, ["a", "b", "c"]);
    const after = update({ kind: "discard", count: 1 }, ["a", "b", "c"]);
    expect(keepSelection(["b"], before, after)).toEqual(["b"]);
  });

  it("同じ手番に2回続けて捨てさせられたとき、1回目に捨てたカードの選択を引き継がない", () => {
    const before = update({ kind: "discard", count: 1 }, ["a", "b"]);
    const after = {
      legal: { selection: { kind: "discard", count: 1 } },
      view: { viewerId: "p1", players: [{ id: "p1", hand: [{ uid: "a" }], discard: [{ uid: "b" }] }] },
    } as unknown as GameUpdate;
    expect(keepSelection(["b"], before, after)).toEqual([]);
  });

  it("求められている選択が変わった、選んだカードがなくなった、選択が終わったときは空にする", () => {
    const before = update({ kind: "discard", count: 1 }, ["a", "b"]);
    expect(keepSelection(["b"], before, update({ kind: "discard", count: 2 }, ["a", "b"]))).toEqual([]);
    expect(keepSelection(["b"], before, update({ kind: "trash", max: 1 }, ["a", "b"]))).toEqual([]);
    expect(keepSelection(["b"], before, update({ kind: "discard", count: 1 }, ["a"]))).toEqual([]);
    expect(keepSelection(["b"], before, update(null, ["a", "b"]))).toEqual([]);
    expect(keepSelection([], before, update(null, []))).toEqual([]);
  });
});
