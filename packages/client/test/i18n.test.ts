import { describe, expect, it } from "vitest";
import { defaultRegistry } from "@deckbuild/core";
import { dataMessages, detectLang, format, messageKeys } from "../src/i18n.js";
import { ja } from "../src/locales/ja.js";
import { en } from "../src/locales/en.js";
import { ACHIEVEMENTS } from "../src/achievements.js";

const placeholders = (s: string) => [...new Set([...s.matchAll(/\{(\w+)/g)].map((m) => m[1]))].sort();

describe("文言の組み立て", () => {
  it("{name} を置き換える。値がなければそのまま", () => {
    expect(format("{a}に{b}ダメージ", { a: "ゴブリン", b: 3 })).toBe("ゴブリンに3ダメージ");
    expect(format("{a}と{x}", { a: 1 })).toBe("1と{x}");
  });
  it("{n|one|other} は 1 なら単数、それ以外は複数", () => {
    expect(format("Draw {n} {n|card|cards}", { n: 1 })).toBe("Draw 1 card");
    expect(format("Draw {n} {n|card|cards}", { n: 2 })).toBe("Draw 2 cards");
    expect(format("Draw {n} {n|card|cards}", { n: 0 })).toBe("Draw 0 cards");
  });
});

describe("言語の選び方", () => {
  it("アドレスの指定 → 保存した選択 → ブラウザの言語の順", () => {
    expect(detectLang("?lang=en", "ja", ["ja-JP"])).toBe("en");
    expect(detectLang("", "en", ["ja-JP"])).toBe("en");
    expect(detectLang("", null, ["ja-JP"])).toBe("ja");
  });
  it("ブラウザの言語は、翻訳がそろった言語だけから選ぶ", () => {
    expect(detectLang("", null, ["en-US"], ["ja"])).toBe("ja");
    expect(detectLang("", null, ["fr-FR", "en-US"], ["ja", "en"])).toBe("en");
    expect(detectLang("?lang=xx", "zz", ["de"], ["ja", "en"])).toBe("ja");
  });
});

describe("英語の文言", () => {
  it("日本語と同じ鍵を持ち、差し込む値も同じ", () => {
    expect(messageKeys("en").sort()).toEqual(messageKeys("ja").sort());
    for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(ja[key]));
    }
  });
  it("すべてのカード（英雄以外）・ステージ・危険度・実績・称号に訳がある", () => {
    const reg = defaultRegistry();
    const data = dataMessages("en");
    const need = [
      ...reg.all().filter((d) => d.type !== "hero").map((d) => `card.${d.id}`),
      ...reg.stages.flatMap((s) => [`stage.${s.id}.name`, `stage.${s.id}.desc`]),
      ...reg.dangers.map((d) => `danger.${d.level}`),
      ...ACHIEVEMENTS.flatMap((a) => [`ach.${a.id}.name`, `ach.${a.id}.text`]),
      // core（flow.ts）が付ける称号
      ...["英雄王", "聖騎士", "勇者", "見習い"].map((s) => `rankTitle.${s}`),
    ];
    expect(need.filter((k) => !data[k])).toEqual([]);
    expect(Object.keys(data).filter((k) => !need.includes(k))).toEqual([]);
  });
  it("すべての英雄に名前がある", () => {
    const heroIds = new Set(defaultRegistry().all().flatMap((d) => (d.type === "hero" ? [d.heroId] : [])));
    for (const id of heroIds) expect(Object.keys(en), id).toContain(`hero.${id}`);
  });
});
