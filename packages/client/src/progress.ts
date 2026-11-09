// ステージの進み具合（企画書 12.4）。ブラウザに保存する
import type { StageDef } from "@deckbuild/core";

const KEY = "deckbuild.progress.v1";

export interface Progress {
  /** クリアしたステージのID */
  cleared: string[];
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { cleared: [] };
    const data = JSON.parse(raw) as Partial<Progress>;
    return { cleared: Array.isArray(data.cleared) ? data.cleared.filter((x) => typeof x === "string") : [] };
  } catch {
    return { cleared: [] };
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 保存できない環境（プライベートウィンドウなど）では、この画面を開いている間だけ覚えておく
  }
}

/** クリアを記録する。新しくクリアしたら true */
export function markCleared(p: Progress, stageId: string): { progress: Progress; isNew: boolean } {
  if (p.cleared.includes(stageId)) return { progress: p, isNew: false };
  return { progress: { cleared: [...p.cleared, stageId] }, isNew: true };
}

/** 遊べるか：最初のステージ（チュートリアル）はいつでも、それ以外は1つ前をクリアしていれば */
export function isUnlocked(stages: StageDef[], p: Progress, stageId: string): boolean {
  const i = stages.findIndex((s) => s.id === stageId);
  if (i <= 0) return i === 0;
  return p.cleared.includes(stages[i - 1]!.id);
}

/** ステージ選択が解放されているか（チュートリアルをクリアしたら） */
export function stageSelectUnlocked(stages: StageDef[], p: Progress): boolean {
  const tutorial = stages.find((s) => s.tutorial);
  return !tutorial || p.cleared.includes(tutorial.id);
}

/** 次のステージ */
export function nextStage(stages: StageDef[], stageId: string): StageDef | null {
  const i = stages.findIndex((s) => s.id === stageId);
  return i >= 0 ? (stages[i + 1] ?? null) : null;
}
