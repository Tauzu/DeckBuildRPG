// 乱数（設計書 2.10）。状態は GameState.rng に持つ

/** mulberry32 を1回進める */
export function rngStep(state: number): { value: number; next: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next };
}

export interface RngHolder {
  rng: number;
}

/** 0以上1未満の乱数を返し、holder.rng を進める */
export function nextRandom(holder: RngHolder): number {
  const r = rngStep(holder.rng);
  holder.rng = r.next;
  return r.value;
}

/** 0以上 n 未満の整数 */
export function randomInt(holder: RngHolder, n: number): number {
  return Math.floor(nextRandom(holder) * n);
}

/** Fisher–Yates 法でその場でシャッフルする */
export function shuffleInPlace<T>(holder: RngHolder, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(holder, i + 1);
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
}
