// 画面の言語（収益化ロードマップ 4.3）
// 文言は locales/ の言語ごとのファイルに置き、画面は鍵で引く。
// 日本語（ja.ts）がもとで、他の言語は同じ鍵をすべて持つ（足りなければ型チェックで分かる）
import { ja } from "./locales/ja.js";
import { en, enData } from "./locales/en.js";

export type Lang = "ja" | "en";
export type MessageKey = keyof typeof ja;
export type Messages = Record<MessageKey, string>;
/** カード・ステージ・危険度など、データ（data/*.json）の文言。日本語はデータそのものを使う */
export type DataMessages = Record<string, string>;

const UI: Record<Lang, Messages> = { ja, en };
const DATA: Record<Lang, DataMessages> = { ja: {}, en: enData };

export const LANGS: { id: Lang; label: string }[] = [
  { id: "ja", label: "日本語" },
  { id: "en", label: "English" },
];

/**
 * ブラウザの言語から自動で選ぶ言語。翻訳が全部そろった言語だけを入れる。
 * まだの言語も、アドレスに ?lang=en を付けるか、選んで保存すれば見られる
 */
export const RELEASED_LANGS: Lang[] = ["ja", "en"];

const LANG_KEY = "deckbuild.lang.v1";

function isLang(v: unknown): v is Lang {
  return v === "ja" || v === "en";
}

/** 使う言語を決める：アドレスの指定 → 保存した選択 → ブラウザの言語 → 英語（日本語・英語以外の人は英語のほうが読める） */
export function detectLang(search: string, saved: string | null, browser: readonly string[], released: readonly Lang[] = RELEASED_LANGS): Lang {
  const q = new URLSearchParams(search).get("lang");
  if (isLang(q)) return q;
  if (isLang(saved)) return saved;
  for (const b of browser) {
    const base = b.toLowerCase().split("-")[0];
    if (isLang(base) && released.includes(base)) return base;
  }
  return released.includes("en") ? "en" : "ja";
}

function initialLang(): Lang {
  if (typeof window === "undefined") return "ja";
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LANG_KEY);
  } catch {
    // 保存できない環境でも遊べるようにする
  }
  return detectLang(location.search, saved, navigator.languages ?? [navigator.language]);
}

let current: Lang = initialLang();
applyDocumentLang();

export function getLang(): Lang {
  return current;
}

/** 言語を変えて保存する。画面の作り直しは呼び出し側（store）が行う */
export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // 何もしない
  }
  applyDocumentLang();
}

function applyDocumentLang(): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = current;
  document.title = t("app.documentTitle");
}

export type Params = Record<string, string | number>;

/**
 * {name} を値に置き換える。{n|card|cards} は n が 1 なら card、それ以外なら cards（英語などの単数・複数）
 */
export function format(text: string, params: Params = {}): string {
  return text.replace(/\{(\w+)(?:\|([^|}]*)\|([^}]*))?\}/g, (whole, key: string, one?: string, other?: string) => {
    const v = params[key];
    if (v === undefined) return whole;
    if (one !== undefined) return Number(v) === 1 ? one : (other ?? "");
    return String(v);
  });
}

/** 画面の文言 */
export function t(key: MessageKey, params?: Params): string {
  return format(UI[current][key] ?? ja[key], params);
}

/** データの文言。翻訳がなければ、もとの日本語（fallback）を使う */
export function td(key: string, fallback: string): string {
  return DATA[current][key] ?? fallback;
}

/** 並べるときの区切り（日本語「、」、英語「, 」） */
export function joinList(items: string[]): string {
  return items.join(t("list.sep"));
}

/** テスト用：鍵の一覧 */
export function messageKeys(lang: Lang): string[] {
  return Object.keys(UI[lang]);
}
export function dataMessages(lang: Lang): DataMessages {
  return DATA[lang];
}

/**
 * 文言の一部に画面の部品（太字など）を差し込む。{name} の位置に parts の部品を置いた配列を返す
 * 例：tParts("lobby.invited", { code: <strong>ABC123</strong> })
 */
export function tParts<T>(key: MessageKey, parts: Record<string, T>, params?: Params): (string | T)[] {
  const text = format(UI[current][key] ?? ja[key], params);
  return text.split(/\{(\w+)\}/).map((piece, i) => (i % 2 === 1 && piece in parts ? parts[piece]! : i % 2 === 1 ? `{${piece}}` : piece));
}
