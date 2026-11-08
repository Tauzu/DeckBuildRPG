// 画面の状態（設計書 4.2）
import { type Action, type ActionOption, defaultRegistry } from "@deckbuild/core";
import { create } from "zustand";
import { type GameConnection, type GameUpdate, LocalConnection, randomSeed } from "./connection.js";
import { buildLookup, ERROR_TEXT, eventText } from "./text.js";

export const reg = defaultRegistry();

export type Screen = "title" | "game" | "rules";

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

  startSolo(seed?: number): void;
  go(screen: Screen): void;
  send(action: Action): void;
  selectWeapon(uid: string | null): void;
  setClassChange(uid: string | null): void;
  toggleSelect(uid: string, max: number): void;
  clearToast(): void;
}

let logId = 0;
let unsubscribe: (() => void) | null = null;

function logLines(u: GameUpdate, playerName: (id: string) => string): LogLine[] {
  const lookup = buildLookup(u.view);
  const lines: LogLine[] = [];
  for (const e of u.events) {
    const text = eventText(e, reg, lookup, playerName);
    if (!text) continue;
    let kind: LogLine["kind"] = "normal";
    if (e.type === "turnStarted") kind = "turn";
    else if ((e.type === "attackResolved" && e.defeated) || (e.type === "gameEnded" && e.result.outcome === "win")) kind = "good";
    else if (e.type === "enemyArrived" || e.type === "enemyRevealed" || e.type === "gameEnded" || e.type === "attackResolved")
      kind = "bad";
    lines.push({ id: ++logId, text, kind });
  }
  return lines;
}

export const useStore = create<Store>()((set, get) => ({
  screen: "title",
  conn: null,
  update: null,
  log: [],
  toast: null,
  selectedWeapon: null,
  classChangeFor: null,
  selection: [],

  startSolo(seed) {
    unsubscribe?.();
    const conn = new LocalConnection(seed ?? randomSeed(), "あなた", reg);
    const first = conn.current();
    const nameOf = (id: string) => first.view.players.find((p) => p.id === id)?.name ?? id;
    unsubscribe = conn.subscribe((u) => {
      if (u.error) {
        set({ update: u, toast: u.error });
        return;
      }
      set((st) => ({
        update: u,
        log: [...st.log, ...logLines(u, nameOf)].slice(-300),
        selectedWeapon: null,
        classChangeFor: null,
        selection: [],
      }));
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
    });
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
}));

/** 操作が一覧にあれば、その可否を返す。一覧になければ undefined */
export function findOption(options: ActionOption[], pred: (a: Action) => boolean): ActionOption | undefined {
  return options.find((o) => pred(o.action));
}

export function reasonText(o: ActionOption | undefined): string | null {
  if (!o) return "今はできません";
  return o.reason ? ERROR_TEXT[o.reason] : null;
}
