// 画面の状態（設計書 4.2）
import { type Action, type ActionOption, defaultRegistry } from "@deckbuild/core";
import { create } from "zustand";
import { playSfx, setBgmMood } from "./audio.js";
import { effectsFrom, FX_STAGGER, type FxItem, nextFxId, soundsFrom } from "./components/Effects.js";
import { type GameConnection, type GameUpdate, LocalConnection, RemoteConnection, randomSeed } from "./connection.js";
import { loadSession, Online, type RoomInfo } from "./online.js";
import { type AchievementDef, addToTally, emptyTally, type GameTally, recordGameEnd } from "./achievements.js";
import { exportCode, importCode, loadProgress, markCleared, mergeProgress, type Progress, saveProgress } from "./progress.js";
import { buildLookup, ERROR_TEXT, eventText } from "./text.js";

export const reg = defaultRegistry();

export type Screen = "title" | "game" | "rules" | "stages" | "lobby" | "records";

export interface LogLine {
  id: number;
  text: string;
  kind: "turn" | "normal" | "good" | "bad";
}

interface Store {
  screen: Screen;
  conn: GameConnection | null;
  update: GameUpdate | null;
  log: LogLine[];
  toast: string | null;
  /** 戦闘中に選んだ武器（次に英雄をクリックすると装備する） */
  selectedWeapon: string | null;
  /** 転職先を選んでいる村の若者 */
  classChangeFor: string | null;
  /** 廃棄・手札を捨てる選択中のカード */
  selection: string[];
  /** ステージの進み具合 */
  progress: Progress;
  /** 今のゲームで新しく解放したもの（結果画面で知らせる） */
  newlyCleared: { stage: boolean; danger: boolean } | null;
  /** 今のゲームでの自分の行動の記録（実績の判定に使う） */
  tally: GameTally;
  /** 今のゲームで達成した実績 */
  unlockedNow: AchievementDef[];
  /** チュートリアルの案内を隠しているか */
  hideHints: boolean;
  /** チュートリアルで、ダイアログで見せ終えた案内の種類 */
  seenHints: string[];

  // マルチプレイ
  /** 入っているルーム。入っていなければ null */
  room: RoomInfo | null;
  /** ルームでの自分の playerId */
  myId: string | null;
  /** サーバーとつながっているか（ルームに入っているときだけ意味がある） */
  online: boolean;
  /** 前回入力した名前 */
  playerName: string;

  /** 表示中の演出 */
  fx: FxItem[];
  /** 集落が攻撃された回数（揺らす演出のきっかけ） */
  villageHits: number;
  /** 敵が進軍した回数（進軍ルートの演出のきっかけ） */
  marches: number;
  /** 自分がカードを買った回数（捨て札の枚数を光らせるきっかけ） */
  buys: number;
  /** 大きく表示しているカード（長押し・右クリック） */
  detail: { defId: string; hp?: number | undefined; damage?: number | undefined; tip?: string | null | undefined } | null;

  /** ひとりで遊ぶ。ステージを省略すると最後のステージ */
  startSolo(stageId?: string, seed?: number, danger?: number): void;
  /** 引き継ぎコードを作る */
  exportProgress(): Promise<string>;
  /** 引き継ぎコードを読み込み、今の進み具合と合わせる。失敗したらその理由 */
  importProgress(code: string): Promise<string | null>;
  setHideHints(hide: boolean): void;
  markHintSeen(key: string): void;
  go(screen: Screen): void;
  send(action: Action): void;
  selectWeapon(uid: string | null): void;
  setClassChange(uid: string | null): void;
  toggleSelect(uid: string, max: number): void;
  clearToast(): void;
  showToast(message: string): void;
  removeFx(id: number): void;
  showDetail(detail: Store["detail"]): void;

  createRoom(name: string, stageId: string, danger: number): Promise<string | null>;
  joinRoom(code: string, name: string): Promise<string | null>;
  setRoomStage(stageId: string, danger: number): Promise<string | null>;
  startRoom(): Promise<string | null>;
  backToLobby(): Promise<string | null>;
  leaveRoom(): void;
}

let logId = 0;
let unsubscribe: (() => void) | null = null;
let online: Online | null = null;

function logLines(u: GameUpdate, playerName: (id: string) => string): LogLine[] {
  const lookup = buildLookup(u.view);
  const lines: LogLine[] = [];
  for (const e of u.events) {
    const text = eventText(e, reg, lookup, playerName);
    if (!text) continue;
    let kind: LogLine["kind"] = "normal";
    if (e.type === "turnStarted") kind = "turn";
    else if (
      (e.type === "attackResolved" && e.defeated) ||
      e.type === "marchSkipped" ||
      (e.type === "gameEnded" && e.result.outcome === "win")
    )
      kind = "good";
    else if (e.type === "enemyArrived" || e.type === "enemyRevealed" || e.type === "gameEnded" || e.type === "attackResolved")
      kind = "bad";
    lines.push({ id: ++logId, text, kind });
  }
  return lines;
}

const NAME_KEY = "deckbuild.name.v1";
function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // 保存できなくても遊べる
  }
}

export const useStore = create<Store>()((set, get) => {
  /** 画面をゲームにつなぐ（ソロ・マルチ共通） */
  const attach = (conn: GameConnection) => {
    unsubscribe?.();
    const first = conn.current();
    const nameOf = (id: string) => conn.current().view.players.find((p) => p.id === id)?.name ?? id;
    unsubscribe = conn.subscribe((u) => {
      if (u.error) {
        playSfx("error");
        set({ update: u, toast: u.error });
        return;
      }
      for (const s of soundsFrom(u.events, u.view.viewerId)) playSfx(s.name, s.delay);
      setBgmMood(u.view.route.flat().some((c) => reg.enemy(c.defId).isBoss) ? "tense" : "calm");
      const fx = effectsFrom(u.events, u.view.viewerId, nameOf).map((f, i) => ({ ...f, id: nextFxId(), delay: i * FX_STAGGER }));
      const hits = u.events.filter((e) => e.type === "enemyArrived" && e.damage > 0).length;
      const marched = u.events.some((e) => e.type === "enemyMoved" && e.moves.length > 0);
      const bought = u.events.some((e) => e.type === "cardBought" && e.playerId === u.view.viewerId);
      const ended = u.events.some((e) => e.type === "gameEnded");
      set((st) => ({
        tally: addToTally(st.tally, u.events, u.view.viewerId, reg),
        update: u,
        fx: fx.length ? [...st.fx, ...fx].slice(-6) : st.fx,
        villageHits: st.villageHits + hits,
        marches: st.marches + (marched ? 1 : 0),
        buys: st.buys + (bought ? 1 : 0),
        log: [...st.log, ...logLines(u, nameOf)].slice(-300),
        selectedWeapon: null,
        classChangeFor: null,
        selection: [],
      }));
      // 終わったら、クリア・通算の記録・実績を記録する（マルチでは参加者それぞれの進み具合に入る）
      const result = u.view.result;
      if (ended && result) {
        const { config } = u.view;
        let progress = get().progress;
        let newly: Store["newlyCleared"] = null;
        if (result.outcome === "win") {
          const c = markCleared(progress, config.stageId, config.danger);
          progress = c.progress;
          if (c.newStage || c.newDanger) newly = { stage: c.newStage, danger: c.newDanger };
        }
        const me = u.view.players.find((p) => p.id === u.view.viewerId)!;
        const done = recordGameEnd({
          reg,
          stage: reg.stage(config.stageId),
          danger: config.danger,
          playerCount: config.playerCount,
          result,
          me,
          turnCount: Math.ceil(u.view.turnCount / config.playerCount),
          villageHp: result.villageHp,
          villageHpMax: config.villageHp,
          tally: get().tally,
          progress,
        });
        saveProgress(done.progress);
        set({ progress: done.progress, newlyCleared: newly, unlockedNow: done.unlocked });
      }
    });
    set({
      screen: "game",
      conn,
      update: first,
      log: logLines(first, nameOf),
      toast: null,
      selectedWeapon: null,
      classChangeFor: null,
      selection: [],
      newlyCleared: null,
      tally: emptyTally(),
      unlockedNow: [],
      hideHints: false,
      seenHints: [],
      fx: [],
    });
  };

  /** サーバーにつなぐ（最初に必要になったときだけ） */
  const net = (): Online => {
    online ??= new Online({
      room(room) {
        const st = get();
        set({ room });
        // ゲームが終わって待機に戻った
        if (!room.started && st.conn instanceof RemoteConnection) {
          unsubscribe?.();
          set({ conn: null, update: null, screen: st.screen === "game" ? "lobby" : st.screen });
        }
      },
      state(u) {
        const st = get();
        if (st.conn instanceof RemoteConnection && st.conn.playerId === u.view.viewerId) {
          st.conn.push(u);
          return;
        }
        // 最初の状態（開始・再接続）
        const conn = new RemoteConnection(u.view.viewerId, u, (a) => online?.action(a));
        set({ myId: u.view.viewerId });
        attach(conn);
      },
      error(message) {
        const conn = get().conn;
        if (conn instanceof RemoteConnection) conn.pushError(message);
        else set({ toast: message });
      },
      connection(connected) {
        set({ online: connected });
      },
      lost(message) {
        const st = get();
        if (st.conn instanceof RemoteConnection) unsubscribe?.();
        set({
          room: null,
          myId: null,
          toast: `ルームに戻れませんでした：${message}`,
          ...(st.conn instanceof RemoteConnection ? { conn: null, update: null, screen: "title" as const } : {}),
        });
      },
    });
    return online;
  };

  const enter = async (p: Promise<{ ok: true } | { ok: false; error: string }>): Promise<string | null> => {
    const r = await p;
    if (!r.ok) return r.error;
    set({ myId: online?.session?.playerId ?? null, screen: "lobby" });
    return null;
  };

  // 前回のルームの席が残っていれば戻る
  if (loadSession()) queueMicrotask(() => net());

  return {
    screen: "title",
    conn: null,
    update: null,
    log: [],
    toast: null,
    selectedWeapon: null,
    classChangeFor: null,
    selection: [],
    progress: loadProgress(),
    newlyCleared: null,
    tally: emptyTally(),
    unlockedNow: [],
    hideHints: false,
    seenHints: [],
    room: null,
    myId: null,
    online: false,
    playerName: loadName(),
    fx: [],
    villageHits: 0,
    marches: 0,
    buys: 0,
    detail: null,

    startSolo(stageId, seed, danger = 0) {
      if (get().room) get().leaveRoom();
      const stage = reg.stage(stageId ?? reg.defaultStageId);
      attach(new LocalConnection(seed ?? stage.fixedSeed ?? randomSeed(), "あなた", reg, stage.id, stage.tutorial ? 0 : danger));
    },

    exportProgress() {
      return exportCode(get().progress);
    },

    async importProgress(code) {
      try {
        const progress = mergeProgress(get().progress, await importCode(code));
        saveProgress(progress);
        set({ progress });
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "読み込めませんでした";
      }
    },

    setHideHints(hide) {
      set({ hideHints: hide });
    },

    markHintSeen(key) {
      set((s) => ({ seenHints: s.seenHints.includes(key) ? s.seenHints : [...s.seenHints, key] }));
    },

    go(screen) {
      set({ screen });
    },

    send(action) {
      get().conn?.send(action);
    },

    selectWeapon(uid) {
      set({ selectedWeapon: uid });
    },

    setClassChange(uid) {
      set({ classChangeFor: uid });
    },

    toggleSelect(uid, max) {
      set((st) => {
        if (st.selection.includes(uid)) return { selection: st.selection.filter((x) => x !== uid) };
        if (st.selection.length >= max) return {};
        return { selection: [...st.selection, uid] };
      });
    },

    clearToast() {
      set({ toast: null });
    },

    showToast(message) {
      set({ toast: message });
    },

    showDetail(detail) {
      set({ detail });
    },

    removeFx(id) {
      set((st) => ({ fx: st.fx.filter((f) => f.id !== id) }));
    },

    createRoom(name, stageId, danger) {
      saveName(name);
      set({ playerName: name });
      return enter(net().create(name, stageId, danger));
    },

    joinRoom(code, name) {
      saveName(name);
      set({ playerName: name });
      return enter(net().join(code, name));
    },

    async setRoomStage(stageId, danger) {
      const r = await net().setStage(stageId, danger);
      return r.ok ? null : r.error;
    },

    async startRoom() {
      const r = await net().start();
      return r.ok ? null : r.error;
    },

    async backToLobby() {
      const r = await net().backToLobby();
      return r.ok ? null : r.error;
    },

    leaveRoom() {
      online?.leave();
      const st = get();
      if (st.conn instanceof RemoteConnection) {
        unsubscribe?.();
        set({ conn: null, update: null });
      }
      set({ room: null, myId: null, screen: st.screen === "lobby" || st.screen === "game" ? "title" : st.screen });
    },
  };
});

/** 操作が一覧にあれば、その可否を返す。一覧になければ undefined */
export function findOption(options: ActionOption[], pred: (a: Action) => boolean): ActionOption | undefined {
  return options.find((o) => pred(o.action));
}

export function reasonText(o: ActionOption | undefined): string | null {
  if (!o) return "今はできません";
  return o.reason ? ERROR_TEXT[o.reason] : null;
}

/** マルチプレイ中か */
export function isRemote(conn: GameConnection | null): boolean {
  return conn instanceof RemoteConnection;
}
