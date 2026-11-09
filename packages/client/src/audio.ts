// 効果音とBGM。音のファイルは使わず、Web Audio でその場で合成する（ピコピコ音）
// ブラウザは、利用者が一度画面を操作するまで音を出させないので、最初のクリックで準備する

export type Sfx =
  | "click"
  | "play"
  | "equip"
  | "buy"
  | "hit"
  | "defeat"
  | "levelup"
  | "reveal"
  | "boss"
  | "march"
  | "village"
  | "myturn"
  | "skip"
  | "win"
  | "lose"
  | "error";

const SETTINGS_KEY = "deckbuild.audio.v1";

export interface AudioSettings {
  sfx: boolean;
  bgm: boolean;
  /** 0〜1 */
  volume: number;
}

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<AudioSettings>;
      return {
        sfx: s.sfx !== false,
        bgm: s.bgm === true,
        volume: typeof s.volume === "number" ? Math.min(1, Math.max(0, s.volume)) : 0.6,
      };
    }
  } catch {
    // 読めなければ初期値
  }
  return { sfx: true, bgm: false, volume: 0.6 };
}

export function saveAudioSettings(s: AudioSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // 保存できなくても鳴らせる
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let bgmBus: GainNode | null = null;
let settings = loadAudioSettings();

function ensure(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    bgmBus = ctx.createGain();
    bgmBus.connect(master);
    applySettings();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function applySettings(): void {
  if (!ctx || !master || !sfxBus || !bgmBus) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.volume * 0.5, t, 0.02);
  sfxBus.gain.setTargetAtTime(settings.sfx ? 1 : 0, t, 0.02);
  bgmBus.gain.setTargetAtTime(settings.bgm ? 0.35 : 0, t, 0.05);
}

export function setAudioSettings(s: AudioSettings): void {
  settings = s;
  saveAudioSettings(s);
  ensure();
  applySettings();
  if (s.bgm) startBgm();
  else stopBgm();
}

export function getAudioSettings(): AudioSettings {
  return settings;
}

/** 最初の操作で音の準備をする（ブラウザの自動再生の制限のため） */
export function unlockAudio(): void {
  ensure();
  if (settings.bgm) startBgm();
}

// ---------------------------------------------------------------------------
// 音の部品

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  /** 終わりの周波数（音の高さを滑らせる） */
  to?: number;
  attack?: number;
  bus?: GainNode | null;
}

function tone(freq: number, start: number, dur: number, o: ToneOpts = {}): void {
  const c = ctx;
  const bus = o.bus ?? sfxBus;
  if (!c || !bus) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "square";
  osc.frequency.setValueAtTime(freq, start);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, start + dur);
  const vol = o.vol ?? 0.2;
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + a);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(bus);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;
function noise(start: number, dur: number, vol = 0.25, filterFreq = 1800): void {
  const c = ctx;
  if (!c || !sfxBus) return;
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(filterFreq, start);
  f.frequency.exponentialRampToValueAtTime(200, start + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  src.start(start);
  src.stop(start + dur + 0.02);
}

/** 音名（A4=440Hz からの半音の数）→ 周波数 */
const hz = (semi: number) => 440 * 2 ** (semi / 12);
const C5 = 3,
  D5 = 5,
  E5 = 7,
  G5 = 10,
  A5 = 12,
  C6 = 15;

/** 効果音を鳴らす。delayMs だけ遅らせられる（演出の順番に合わせる） */
export function playSfx(name: Sfx, delayMs = 0): void {
  if (!settings.sfx) return;
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + delayMs / 1000;
  switch (name) {
    case "click":
      tone(hz(C6), t, 0.04, { vol: 0.08 });
      break;
    case "play":
      tone(hz(G5), t, 0.06, { vol: 0.12 });
      tone(hz(C6), t + 0.05, 0.08, { vol: 0.12 });
      break;
    case "equip":
      tone(1800, t, 0.05, { type: "triangle", vol: 0.15 });
      tone(2400, t + 0.04, 0.12, { type: "triangle", vol: 0.12 });
      noise(t, 0.06, 0.08, 6000);
      break;
    case "buy":
      tone(hz(E5), t, 0.07, { vol: 0.12 });
      tone(hz(A5), t + 0.07, 0.07, { vol: 0.12 });
      tone(hz(C6 + 4), t + 0.14, 0.16, { vol: 0.12 });
      break;
    case "hit":
      noise(t, 0.18, 0.35, 2500);
      tone(180, t, 0.18, { to: 70, vol: 0.2 });
      break;
    case "defeat":
      noise(t, 0.25, 0.4, 3000);
      tone(220, t, 0.2, { to: 60, vol: 0.2 });
      [C5, E5, G5, C6].forEach((n, i) => tone(hz(n), t + 0.2 + i * 0.07, 0.12, { vol: 0.13 }));
      break;
    case "levelup":
      [C5, E5, G5, C6, E5 + 12, G5 + 12].forEach((n, i) => tone(hz(n), t + i * 0.06, 0.14, { vol: 0.12, type: "triangle" }));
      tone(hz(C6 + 12), t + 0.38, 0.4, { vol: 0.1, type: "triangle" });
      break;
    case "reveal":
      tone(hz(-5), t, 0.18, { vol: 0.12, type: "sawtooth", to: hz(-2) });
      break;
    case "boss":
      [0, 0.22, 0.44].forEach((d, i) => tone(hz(-17 - i), t + d, 0.3, { vol: 0.22, type: "sawtooth" }));
      tone(hz(-29), t + 0.66, 0.9, { vol: 0.25, type: "sawtooth" });
      noise(t + 0.66, 0.6, 0.15, 800);
      break;
    case "march":
      [0, 0.16, 0.32].forEach((d) => {
        tone(90, t + d, 0.12, { vol: 0.28, type: "triangle", to: 50 });
        noise(t + d, 0.08, 0.12, 400);
      });
      break;
    case "village":
      noise(t, 0.4, 0.4, 1200);
      tone(140, t, 0.4, { to: 45, vol: 0.25, type: "sawtooth" });
      break;
    case "myturn":
      tone(hz(G5), t, 0.08, { vol: 0.1, type: "triangle" });
      tone(hz(C6), t + 0.09, 0.18, { vol: 0.1, type: "triangle" });
      break;
    case "skip":
      tone(hz(E5), t, 0.1, { vol: 0.1, type: "triangle" });
      tone(hz(G5), t + 0.1, 0.18, { vol: 0.1, type: "triangle" });
      break;
    case "win":
      [C5, E5, G5, C6, G5, C6].forEach((n, i) => tone(hz(n), t + i * 0.12, i === 5 ? 0.6 : 0.14, { vol: 0.14 }));
      break;
    case "lose":
      [G5, D5 + 1, C5, -2].forEach((n, i) => tone(hz(n - 12), t + i * 0.25, 0.3, { vol: 0.14, type: "triangle" }));
      break;
    case "error":
      tone(120, t, 0.12, { vol: 0.15, type: "square" });
      tone(100, t + 0.12, 0.15, { vol: 0.15, type: "square" });
      break;
  }
}

// ---------------------------------------------------------------------------
// BGM：短い旋律を繰り返す。ボスがいるときは緊迫した旋律に切り替える

let bgmTimer: ReturnType<typeof setInterval> | null = null;
let bgmNext = 0;
let bgmStep = 0;
let bgmMood: "calm" | "tense" = "calm";

// 16分音符ごとの音（null は休み）。数字は A4 からの半音
const CALM_MELODY = [3, null, 7, null, 10, null, 7, 5, 3, null, 0, null, 2, null, null, null, 5, null, 8, null, 12, null, 10, 8, 7, null, 5, null, 3, null, null, null];
const CALM_BASS = [-21, -21, -14, -14, -16, -16, -11, -11];
const TENSE_MELODY = [0, 3, 6, 3, 0, 3, 7, 6, 0, 3, 6, 3, 8, 7, 6, 3, 0, 3, 6, 3, 0, 3, 7, 6, 10, 8, 7, 6, 3, 2, 1, null];
const TENSE_BASS = [-24, -24, -24, -24, -22, -22, -23, -23];

export function setBgmMood(mood: "calm" | "tense"): void {
  bgmMood = mood;
}

function startBgm(): void {
  const c = ensure();
  if (!c || bgmTimer) return;
  bgmNext = c.currentTime + 0.1;
  bgmStep = 0;
  // 少し先まで予約しておく方式（タイマーの遅れで音がずれないように）
  bgmTimer = setInterval(() => {
    if (!ctx) return;
    const tempo = bgmMood === "tense" ? 150 : 104;
    const sixteenth = 60 / tempo / 4;
    while (bgmNext < ctx.currentTime + 0.25) {
      const mel = bgmMood === "tense" ? TENSE_MELODY : CALM_MELODY;
      const bass = bgmMood === "tense" ? TENSE_BASS : CALM_BASS;
      const n = mel[bgmStep % mel.length];
      if (n !== null && n !== undefined) tone(hz(n), bgmNext, sixteenth * 1.6, { vol: 0.07, type: "square", bus: bgmBus });
      if (bgmStep % 4 === 0) {
        const b = bass[Math.floor(bgmStep / 4) % bass.length]!;
        tone(hz(b), bgmNext, sixteenth * 3.5, { vol: 0.12, type: "triangle", bus: bgmBus });
      }
      bgmNext += sixteenth;
      bgmStep++;
    }
  }, 60);
}

function stopBgm(): void {
  if (bgmTimer) clearInterval(bgmTimer);
  bgmTimer = null;
}
