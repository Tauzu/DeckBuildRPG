// GoatCounter から前日（日本時間）の数を集め、Markdown のまとめを出力する（収益化ロードマップ：統計の自動化）
// 使い方：GOATCOUNTER_TOKEN=... node scripts/stats-report.mjs [YYYY-MM-DD]  （日付を省くと日本時間の前日）
// 出力：標準出力に Markdown。GitHub Actions がこれを Issue にコメントする（.github/workflows/stats.yml）
import { pathToFileURL } from "node:url";

const SITE = process.env.GOATCOUNTER_SITE ?? "https://foodie-quest.goatcounter.com";
const JST = 9 * 60 * 60 * 1000;

/** 日本時間のその日の 0時〜24時を、UTC の ISO 文字列で返す */
export function jstDayRange(day) {
  const start = new Date(Date.parse(`${day}T00:00:00Z`) - JST);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString().replace(".000", ""), end: end.toISOString().replace(".000", "") };
}

/** 日本時間の前日（YYYY-MM-DD） */
export function yesterdayJst(now = Date.now()) {
  return new Date(now + JST - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** stats/hits の行から、開いた・遊び始めた・最後まで遊んだ の数をまとめる */
export function summarize(hits) {
  const s = { open: 0, start: 0, startSolo: 0, startOnline: 0, finish: 0, win: 0, lose: 0, stages: {} };
  for (const h of hits) {
    const path = h.path.replace(/^\//, "");
    const n = h.count ?? 0;
    if (!h.event && path === "") s.open += n;
    const parts = path.split("/");
    if (parts[0] === "start") {
      s.start += n;
      if (parts[1] === "solo") s.startSolo += n;
      else s.startOnline += n;
      const stage = parts[2] ?? "?";
      s.stages[stage] ??= { start: 0, win: 0, lose: 0 };
      s.stages[stage].start += n;
    } else if (parts[0] === "finish") {
      s.finish += n;
      const stage = parts[2] ?? "?";
      s.stages[stage] ??= { start: 0, win: 0, lose: 0 };
      if (parts[4] === "win") {
        s.win += n;
        s.stages[stage].win += n;
      } else {
        s.lose += n;
        s.stages[stage].lose += n;
      }
    }
  }
  return s;
}

/** まとめを Markdown にする */
export function toMarkdown(day, s, refs) {
  const lines = [
    `### ${day}（日本時間）`,
    "",
    "| 開いた | 遊び始めた（1人 / 協力） | 最後まで遊んだ（勝ち / 負け） |",
    "|---|---|---|",
    `| ${s.open} | ${s.start}（${s.startSolo} / ${s.startOnline}） | ${s.finish}（${s.win} / ${s.lose}） |`,
  ];
  const stages = Object.entries(s.stages).sort(([a], [b]) => a.localeCompare(b));
  if (stages.length > 0) {
    lines.push("", "| ステージ | 遊び始めた | 勝ち | 負け |", "|---|---|---|---|");
    for (const [id, v] of stages) lines.push(`| ${id} | ${v.start} | ${v.win} | ${v.lose} |`);
  }
  if (refs && refs.length > 0) {
    lines.push("", "どこから来たか：" + refs.map((r) => `${r.name || "（直接）"} ${r.count}`).join("、"));
  }
  lines.push("", "数は GoatCounter の「人数」（同じ人の重複は数えない）。");
  return lines.join("\n");
}

async function api(path, params, token) {
  const url = new URL(`${SITE}/api/v0/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const token = process.env.GOATCOUNTER_TOKEN;
  if (!token) throw new Error("GOATCOUNTER_TOKEN がありません");
  const day = process.argv[2] ?? yesterdayJst();
  const { start, end } = jstDayRange(day);
  // 出来事のパスは数十種類なので、1回（最大100件）で足りる
  const r = await api("stats/hits", { start, end, limit: 100 }, token);
  const hits = r.hits ?? [];
  if (r.more) console.error("100件を超えたので、残りは数えていない");
  let refs = [];
  try {
    refs = (await api("stats/toprefs", { start, end, limit: 10 }, token)).stats ?? [];
  } catch (e) {
    console.error("参照元は取れなかった：", e.message);
  }
  console.log(toMarkdown(day, summarize(hits), refs));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
