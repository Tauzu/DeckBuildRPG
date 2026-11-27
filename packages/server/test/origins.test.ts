import { describe, expect, it } from "vitest";
import { extraOrigins, originAllowed } from "../src/origins.js";

describe("協力プレイの接続を受け付ける相手", () => {
  it("Origin がない・画面と同じアドレス・手元は受け付ける", () => {
    expect(originAllowed(undefined, "foodie-quest.onrender.com")).toBe(true);
    expect(originAllowed("https://foodie-quest.onrender.com", "foodie-quest.onrender.com")).toBe(true);
    expect(originAllowed("http://localhost:5173", "localhost:3000")).toBe(true);
    expect(originAllowed("http://192.168.1.5:5173", "192.168.1.5:3000")).toBe(true);
  });
  it("itch.io に置いた画面は受け付ける", () => {
    expect(originAllowed("https://html-classic.itch.zone", "foodie-quest.onrender.com")).toBe(true);
    expect(originAllowed("https://v6p9d9t4.ssl.hwcdn.net", "foodie-quest.onrender.com")).toBe(false);
  });
  it("ほかのサイトは断る。似せた名前もだめ", () => {
    expect(originAllowed("https://evil.example", "foodie-quest.onrender.com")).toBe(false);
    expect(originAllowed("https://itch.zone.evil.example", "foodie-quest.onrender.com")).toBe(false);
    expect(originAllowed("http://html-classic.itch.zone", "foodie-quest.onrender.com")).toBe(false);
    expect(originAllowed("not a url", "foodie-quest.onrender.com")).toBe(false);
  });
  it("環境変数で足したアドレスは受け付ける", () => {
    const extra = extraOrigins(" https://a.example , https://b.example,");
    expect(extra).toEqual(["https://a.example", "https://b.example"]);
    expect(originAllowed("https://b.example", "x", extra)).toBe(true);
  });
});
