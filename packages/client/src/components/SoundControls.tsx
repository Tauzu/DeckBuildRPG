// 効果音・BGMのオンオフと音量
import { useState } from "react";
import { getAudioSettings, playSfx, setAudioSettings } from "../audio.js";

export function SoundControls({ compact = false }: { compact?: boolean }) {
  const [s, setS] = useState(getAudioSettings);
  const update = (next: typeof s) => {
    setS(next);
    setAudioSettings(next);
  };
  return (
    <span className={`sound-controls${compact ? " sound-compact" : ""}`}>
      <button
        type="button"
        className={`ghost mini${s.sfx ? " sound-on" : ""}`}
        aria-pressed={s.sfx}
        onClick={() => {
          update({ ...s, sfx: !s.sfx });
          if (!s.sfx) playSfx("buy");
        }}
      >
        効果音 {s.sfx ? "ON" : "OFF"}
      </button>
      <button type="button" className={`ghost mini${s.bgm ? " sound-on" : ""}`} aria-pressed={s.bgm} onClick={() => update({ ...s, bgm: !s.bgm })}>
        BGM {s.bgm ? "ON" : "OFF"}
      </button>
      <label className="sound-volume">
        <span>音量</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={s.volume}
          onChange={(e) => update({ ...s, volume: Number(e.target.value) })}
          onPointerUp={() => playSfx("play")}
          aria-label="音量"
        />
      </label>
    </span>
  );
}
