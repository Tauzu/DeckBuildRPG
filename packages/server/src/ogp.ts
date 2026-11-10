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

export function cardTags(origin: string, path: string, code: string | null): string {
  const title = code ? `【招待】ルーム ${code} に参加しよう！ – FOODIE QUEST` : "FOODIE QUEST – エルムの村のはらぺこ英雄たち";
  const desc = code
    ? "協力プレイに招待されています。リンクを開いて名前を入れるだけで、すぐ参加できます。"
    : "食料で英雄を呼び集め、魔竜の軍勢から村を守る。デッキビルド×RPG。1人でも、みんなでも遊べます。";
  const url = code ? `${origin}${path}?room=${code}` : `${origin}${path}`;
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
export function withCard(html: string, origin: string, path: string, code: string | null): string {
  const tags = cardTags(origin, path, code);
  let out = html.includes(MARKER) ? html.replace(MARKER, () => tags) : html.replace("</head>", () => `${tags}\n  </head>`);
  if (code) out = out.replace(/<title>[^<]*<\/title>/, () => `<title>【招待】ルーム ${code} – FOODIE QUEST</title>`);
  return out;
}
