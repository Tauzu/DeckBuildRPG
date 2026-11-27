// どこに置いた画面か（収益化ロードマップ 段階1）
// ふだん（Render）は、画面と同じアドレスのサーバーにつなぐ。
// itch.io 用（npm run build:itch）は、画面が itch.io にあり、協力プレイのサーバーは Render にある
const ITCH = import.meta.env.MODE === "itch";

/** 公開しているゲームのアドレス（招待リンクの行き先） */
export const PUBLIC_URL = "https://foodie-quest.onrender.com/";

/** 協力プレイのサーバー。undefined なら画面と同じアドレス */
export const SERVER_URL: string | undefined = ITCH ? "https://foodie-quest.onrender.com" : undefined;

/** 招待リンクのもとにするアドレス。itch.io の中で作った招待リンクも、Render のゲームを開くようにする */
export function inviteBase(): string {
  return ITCH ? PUBLIC_URL : location.href;
}
