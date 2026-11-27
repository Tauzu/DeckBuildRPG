// 遊ばれた数を数える（収益化ロードマップ 段階0）
// GoatCounter に、どのページ・出来事かだけを送る。Cookie も、名前などの個人の情報も送らない
import { GOATCOUNTER_URL } from "./links.js";

/** 数える出来事。ページのパスとして送る（GoatCounter の画面で一覧になる） */
export type CountEvent =
  | { type: "open" }
  | { type: "start"; mode: "solo" | "online"; stageId: string; danger: number; players: number }
  | { type: "finish"; mode: "solo" | "online"; stageId: string; danger: number; outcome: "win" | "lose" };

/** 出来事を、GoatCounter に送るパスと題名にする */
export function eventPath(e: CountEvent): { path: string; title: string; event: boolean } {
  switch (e.type) {
    case "open":
      return { path: "/", title: "開いた", event: false };
    case "start":
      return {
        path: `start/${e.mode}/${e.stageId}/d${e.danger}/${e.players}p`,
        title: `遊び始めた（${e.mode === "solo" ? "1人" : "協力"}）`,
        event: true,
      };
    case "finish":
      return {
        path: `finish/${e.mode}/${e.stageId}/d${e.danger}/${e.outcome}`,
        title: `最後まで遊んだ（${e.outcome === "win" ? "勝ち" : "負け"}）`,
        event: true,
      };
  }
}

/** 送り先のアドレス。数えない場所（手元・同じWi‑Fiの中）では null */
export function countUrl(base: string, host: string, e: CountEvent, referrer = "", rnd = Math.random()): string | null {
  if (!base || isLocalHost(host)) return null;
  const { path, title, event } = eventPath(e);
  const q = new URLSearchParams({ p: path, t: title });
  if (event) q.set("e", "true");
  if (referrer) q.set("r", referrer);
  q.set("rnd", rnd.toString(36).slice(2, 8));
  return `${base}?${q.toString()}`;
}

function isLocalHost(host: string): boolean {
  return (
    host === "" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host)
  );
}

/** 出来事を送る。送れなくても遊ぶのには関係ないので、失敗は無視する */
export function count(e: CountEvent): void {
  try {
    // 開いたときだけ、どこから来たか（Reddit・itch.io など）を添える
    const ref = e.type === "open" && document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : "";
    const url = countUrl(GOATCOUNTER_URL, location.hostname, e, ref);
    if (!url) return;
    if (navigator.sendBeacon?.(url)) return;
    new Image().src = url;
  } catch {
    // 何もしない
  }
}
