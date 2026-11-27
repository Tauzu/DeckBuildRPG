import { describe, expect, it } from "vitest";
import { inviteCodeFrom, inviteUrl } from "../src/invite.js";

describe("招待リンク", () => {
  it("ルームコードを入れたアドレスを作る（ほかの指定は消す）", () => {
    expect(inviteUrl("https://x.example/?a=1#top", "abc123")).toBe("https://x.example/?room=ABC123");
    expect(inviteUrl("http://localhost:5173/", "ZZ9999")).toBe("http://localhost:5173/?room=ZZ9999");
  });
  it("日本語以外なら、言語も付ける", () => {
    expect(inviteUrl("https://x.example/?lang=en", "abc123", "en")).toBe("https://x.example/?room=ABC123&lang=en");
    expect(inviteUrl("https://x.example/", "abc123", "ja")).toBe("https://x.example/?room=ABC123");
  });
  it("アドレスからコードを取り出す", () => {
    expect(inviteCodeFrom("?room=abc123")).toBe("ABC123");
    expect(inviteCodeFrom("?x=1&room=QWER12")).toBe("QWER12");
  });
  it("形が違えば無視する", () => {
    expect(inviteCodeFrom("")).toBeNull();
    expect(inviteCodeFrom("?room=abc")).toBeNull();
    expect(inviteCodeFrom("?room=<script>")).toBeNull();
    expect(inviteCodeFrom("?room=ABC1234")).toBeNull();
  });
});
