import { describe, expect, it } from "vitest";
import { countUrl, eventPath } from "../src/analytics.js";

const BASE = "https://x.goatcounter.com/count";

describe("遊ばれた数を数える", () => {
  it("出来事をパスにする（名前などは入れない）", () => {
    expect(eventPath({ type: "open" })).toEqual({ path: "/", title: "開いた", event: false });
    expect(eventPath({ type: "start", mode: "online", stageId: "s2", danger: 3, players: 2 }).path).toBe("start/online/s2/d3/2p");
    expect(eventPath({ type: "finish", mode: "solo", stageId: "s1", danger: 0, outcome: "win" }).path).toBe("finish/solo/s1/d0/win");
  });
  it("公開先では送り先のアドレスを作る", () => {
    const url = new URL(countUrl(BASE, "foodie-quest.onrender.com", { type: "start", mode: "solo", stageId: "s1", danger: 0, players: 1 }, "", 0.5)!);
    expect(url.origin + url.pathname).toBe(BASE);
    expect(url.searchParams.get("p")).toBe("start/solo/s1/d0/1p");
    expect(url.searchParams.get("e")).toBe("true");
    expect(countUrl(BASE, "a.example", { type: "open" }, "https://www.reddit.com/")).toContain("r=https%3A%2F%2Fwww.reddit.com%2F");
  });
  it("送り先が空・手元・同じWi‑Fiの中では送らない", () => {
    expect(countUrl("", "a.example", { type: "open" })).toBeNull();
    for (const host of ["localhost", "127.0.0.1", "192.168.1.5", "10.0.0.2", "172.20.1.1", "pc.local"]) {
      expect(countUrl(BASE, host, { type: "open" })).toBeNull();
    }
  });
});
