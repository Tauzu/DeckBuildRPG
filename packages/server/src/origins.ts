// 協力プレイの接続を受け付ける相手（ブラウザが送る Origin で判断する）
// - Origin がない（ブラウザ以外・テスト）、画面と同じアドレス、手元・同じWi‑Fiの中
// - itch.io に置いた画面（itch.io は、ゲームを *.itch.zone のアドレスの中で動かす）
// - 環境変数 ALLOWED_ORIGINS（カンマ区切り）で足したアドレス
const ITCH = /^https:\/\/([a-z0-9-]+\.)*itch\.(zone|io)$/;
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

export function originAllowed(origin: string | undefined, host: string | undefined, extra: readonly string[] = []): boolean {
  if (!origin) return true;
  if (host) {
    try {
      if (new URL(origin).host === host) return true;
    } catch {
      return false;
    }
  }
  return ITCH.test(origin) || LOCAL.test(origin) || extra.includes(origin);
}

export function extraOrigins(env: string | undefined): string[] {
  return (env ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
