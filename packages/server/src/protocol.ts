// ブラウザとサーバーのメッセージ（仕様書 9.3、設計書 5.1）
import { actionSchema, type GameUpdate } from "@deckbuild/core";
import { z } from "zod";

export const MAX_PLAYERS = 4;

const name = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "名前を入力してください").max(12, "名前は12文字までです"));
const code = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{6}$/, "ルームコードは英数字6文字です"));
const stageId = z.string().min(1).max(64);
/** 危険度（省略すると 0） */
const danger = z.number().int().min(0).max(100).default(0);

export const createSchema = z.object({ name, stageId, danger });
export const joinSchema = z.object({ code, name });
export const resumeSchema = z.object({ code, token: z.string().min(1).max(128) });
export const setStageSchema = z.object({ stageId, danger });
/** 送れるスタンプ（固定の一覧。自由な文字は送れない） */
export const STAMP_IDS = ["smile", "laugh", "wink", "smug", "angry", "shock", "cry", "think", "heart", "star", "fire", "sword"] as const;
export type StampId = (typeof STAMP_IDS)[number];
export const stampMessageSchema = z.object({ stamp: z.enum(STAMP_IDS) });
/** 同じ人が続けて送れる間隔（ミリ秒） */
export const STAMP_INTERVAL_MS = 1500;

export const actionMessageSchema = z.object({ action: actionSchema });

/** 参加者1人の公開情報 */
export interface MemberInfo {
  id: string;
  name: string;
  connected: boolean;
  /** 接続が切れて5分たち、手番を自動で進めている */
  auto: boolean;
}

/** room:update で送るルームの情報 */
export interface RoomInfo {
  code: string;
  hostId: string;
  stageId: string;
  danger: number;
  started: boolean;
  members: MemberInfo[];
}

/** room:create / room:join / room:resume の返事 */
export type JoinReply = { ok: true; code: string; playerId: string; token: string } | { ok: false; error: string };
/** そのほかの操作の返事 */
export type Reply = { ok: true } | { ok: false; error: string };

export interface ServerToClient {
  "room:update": (room: RoomInfo) => void;
  "game:state": (update: GameUpdate) => void;
  "game:error": (message: string) => void;
  "game:stamp": (msg: { from: string; stamp: StampId }) => void;
}

export interface ClientToServer {
  "room:create": (msg: unknown, reply: (r: JoinReply) => void) => void;
  "room:join": (msg: unknown, reply: (r: JoinReply) => void) => void;
  "room:resume": (msg: unknown, reply: (r: JoinReply) => void) => void;
  "room:setStage": (msg: unknown, reply: (r: Reply) => void) => void;
  "room:start": (reply: (r: Reply) => void) => void;
  "room:backToLobby": (reply: (r: Reply) => void) => void;
  "room:leave": () => void;
  "game:action": (msg: unknown) => void;
  "game:stamp": (msg: unknown) => void;
}

/** Zod のエラーを1行の文章にする */
export function zodMessage(e: z.ZodError): string {
  return e.issues[0]?.message ?? "入力が正しくありません";
}
