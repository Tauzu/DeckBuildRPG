// リンクカード（OGP）：LINE などにアドレスを貼ったときの表示。招待リンクなら「招待されています」とわかる内容にする
import type { IncomingHttpHeaders } from "node:http";

const CODE = /^[A-Za-z0-9]{6}$/;
const HOST = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;
export const MARKER = "<!--ogp-->";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** リクエストから、自分のアドレス（https://example.com）を求める。変なヘッダーなら null */
export function originOf(headers: IncomingHttpHeaders): string | null {
  const host = String(headers.host ?? "");
  if (!HOST.test(host)) return null;
  const proto = String(headers["x-forwarded-proto"] ?? "").split(",")[0]!.trim() === "https" ? "https" : "http";
  return `${proto}://${host}`;
}

/** ?room= の値が正しいルームコードなら大文字にして返す */
export function roomCodeOf(search: URLSearchParams): string | null {
  const v = search.get("room")?.trim() ?? "";
  return CODE.test(v) ? v.toUpperCase() : null;
}

export type CardLang = "ja" | "en";

/** ?lang=en なら英語のリンクカードにする（招待リンクは、作った人の言語を付けて配る） */
export function langOf(search: URLSearchParams): CardLang {
  return search.get("lang") === "en" ? "en" : "ja";
}

const TEXT = {
  ja: {
    title: "FOODIE QUEST – エルムの村のはらぺこ英雄たち",
    inviteTitle: (code: string) => `【招待】ルーム ${code} に参加しよう！ – FOODIE QUEST`,
    inviteDocTitle: (code: string) => `【招待】ルーム ${code} – FOODIE QUEST`,
    desc: "食料で英雄を呼び集め、魔竜の軍勢から村を守る。デッキビルド×RPG。1人でも、みんなでも遊べます。",
    inviteDesc: "協力プレイに招待されています。リンクを開いて名前を入れるだけで、すぐ参加できます。",
  },
  en: {
    title: "FOODIE QUEST – The Hungry Heroes of Elm Village",
    inviteTitle: (code: string) => `[Invite] Join room ${code}! – FOODIE QUEST`,
    inviteDocTitle: (code: string) => `[Invite] Room ${code} – FOODIE QUEST`,
    desc: "Feed your heroes, rally them, and save the village from the Dread Dragon's army. A co-op deckbuilder RPG for 1–4 players.",
    inviteDesc: "You've been invited to play together. Open the link and enter your name to join right away.",
  },
};

export function cardTags(origin: string, path: string, code: string | null, lang: CardLang = "ja"): string {
  const tx = TEXT[lang];
  const title = code ? tx.inviteTitle(code) : tx.title;
  const desc = code ? tx.inviteDesc : tx.desc;
  const q = new URLSearchParams();
  if (code) q.set("room", code);
  if (lang !== "ja") q.set("lang", lang);
  const query = q.toString();
  const url = query ? `${origin}${path}?${query}` : `${origin}${path}`;
  const image = `${origin}/${code ? "og-invite.png" : "og-default.png"}`;
  return [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="FOODIE QUEST" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="description" content="${esc(desc)}" />`,
  ].join("\n    ");
}

/** index.html にリンクカードの指定を差し込む（招待ならタイトルも招待に変える） */
export function withCard(html: string, origin: string, path: string, code: string | null, lang: CardLang = "ja"): string {
  const tags = cardTags(origin, path, code, lang);
  let out = html.includes(MARKER) ? html.replace(MARKER, () => tags) : html.replace("</head>", () => `${tags}\n  </head>`);
  if (code) out = out.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(TEXT[lang].inviteDocTitle(code))}</title>`);
  else if (lang !== "ja") out = out.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(TEXT[lang].title)}</title>`);
  if (lang !== "ja") out = out.replace(`<html lang="ja">`, `<html lang="${lang}">`);
  return out;
}
