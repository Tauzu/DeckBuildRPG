// スタンプの絵（16×16 のドット絵）。送れる一覧は、サーバーの STAMP_IDS（packages/server/src/protocol.ts）と同じ
import { type Sprite, spriteFor } from "./sprites.js";

const heart: Sprite = [
  "................",
  "..kkkk....kkkk..",
  ".krrrrk..krrrrk.",
  "krrwwrrkkrrrrrrk",
  "krrwrrrrrrrrrrrk",
  "krrrrrrrrrrrrrRk",
  "krrrrrrrrrrrrRRk",
  ".krrrrrrrrrrRRk.",
  "..krrrrrrrrRRk..",
  "...krrrrrrRRk...",
  "....krrrrRRk....",
  ".....krrRRk.....",
  "......krRk......",
  ".......kk.......",
  "................",
  "................",
];

const star: Sprite = [
  "................",
  ".......kk.......",
  "......kyyk......",
  "......kyyk......",
  ".kkkkkkyykkkkk..",
  "kyyyyyyyyyyyyyk.",
  ".kyyyyyyyyyyyk..",
  "..kyyyyyyyyyk...",
  "...kyyyyyyyk....",
  "...kyyyyyyyk....",
  "..kyyyykkyyyk...",
  "..kyyyk..kyyyk..",
  ".kyyk......kyyk.",
  ".kkk........kkk.",
  "................",
  "................",
];

/** 顔の土台（目と口は各スタンプで描く） */
const FACE_TOP = [
  "................",
  ".....kkkkkk.....",
  "...kkyyyyyykk...",
  "..kyyyyyyyyyyk..",
  ".kyyyyyyyyyyyyk.",
];
const FACE_BOTTOM = [".kyyyyyyyyyyyyk.", "..kyyyyyyyyyyk..", "...kkyyyyyykk...", ".....kkkkkk.....", "................"];

const smile: Sprite = [
  ...FACE_TOP,
  ".kyyyxxyyxxyyyk.",
  "kyyyyxxyyxxyyyyk",
  "kyyyyyyyyyyyyyyk",
  "kyyyyyyyyyyyyyyk",
  "kyyyxyyyyyyxyyyk",
  ".kyyxxxxxxxxyyk.",
  ...FACE_BOTTOM,
];

const shock: Sprite = [
  ...FACE_TOP,
  ".kyyxxyyyyxxyyk.",
  "kyyyxxyyyyxxyyyk",
  "kyyyxxyyyyxxyyyk",
  "kyyyyyyyyyyyyyyk",
  "kyyyyyyxxyyyyyyk",
  ".kyyyyxxxxyyyyk.",
  ".kyyyyyxxyyyyyk.",
  FACE_BOTTOM[1]!,
  FACE_BOTTOM[2]!,
  FACE_BOTTOM[3]!,
  FACE_BOTTOM[4]!,
];

const cry: Sprite = [
  ...FACE_TOP,
  ".kyyyxxyyxxyyyk.",
  "kyyyyxxyyxxyyyyk",
  "kyyycyyyyyycyyyk",
  "kyyycyyyyyycyyyk",
  "kyyyyyxxxxyyyyyk",
  ".kyyxxyyyyxxyyk.",
  ...FACE_BOTTOM,
];

const fire: Sprite = [
  "................",
  ".......f........",
  "......ff........",
  ".....fff...f....",
  ".....ffff..ff...",
  "....fffff.fff...",
  "....ffffffffff..",
  "...ffffffffffff.",
  "...ffyfffffyfff.",
  "..ffyyyffffyyff.",
  "..ffyyyyfyyyyff.",
  "..ffyyyyyyyyyff.",
  "...ffyyyyyyyff..",
  "....fffyyyfff...",
  ".....ffffffff...",
  "................",
];

const ownSprites: Record<string, Sprite> = { heart, star, smile, shock, cry, fire };

/** 一覧に出す順番。sword と wine は、カードの絵を使う */
export const STAMPS: { id: string; label: string; sprite: Sprite }[] = [
  { id: "heart", label: "いいね", sprite: heart },
  { id: "star", label: "すごい", sprite: star },
  { id: "smile", label: "うれしい", sprite: smile },
  { id: "shock", label: "やばい", sprite: shock },
  { id: "cry", label: "ざんねん", sprite: cry },
  { id: "fire", label: "ナイス", sprite: fire },
  { id: "sword", label: "がんばろう", sprite: spriteFor("weapon_sword") ?? heart },
  { id: "wine", label: "かんぱい", sprite: spriteFor("food_wine") ?? heart },
];

export function stampSprite(id: string): Sprite | null {
  return ownSprites[id] ?? STAMPS.find((s) => s.id === id)?.sprite ?? null;
}
