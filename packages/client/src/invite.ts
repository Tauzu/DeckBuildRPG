// 招待リンク：開くとそのルームに参加する画面になる（例：https://example.com/?room=ABC123）
const CODE = /^[A-Za-z0-9]{6}$/;

/** ルームの招待リンクを作る。base は今開いているページのアドレス */
export function inviteUrl(base: string, code: string): string {
  const u = new URL(base);
  u.search = "";
  u.hash = "";
  u.searchParams.set("room", code.toUpperCase());
  return u.toString();
}

/** アドレスの ?room= からルームコードを取り出す（なければ・形が違えば null） */
export function inviteCodeFrom(search: string): string | null {
  const v = new URLSearchParams(search).get("room")?.trim() ?? "";
  return CODE.test(v) ? v.toUpperCase() : null;
}

/** アドレスから招待の指定を消す（再読み込みで、また同じ招待画面にならないように） */
export function clearInviteFromAddress(): void {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has("room")) return;
    u.searchParams.delete("room");
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch {
    // 変えられない環境ではそのまま
  }
}
