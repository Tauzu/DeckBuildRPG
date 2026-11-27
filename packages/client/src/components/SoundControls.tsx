// 効果音・BGMのオンオフと音量
import { useState } from "react";
import { AUDIO_ENABLED, getAudioSettings, playSfx, setAudioSettings } from "../audio.js";
import { t } from "../i18n.js";

export function SoundControls({ compact = false }: { compact?: boolean }) {
  if (!AUDIO_ENABLED) return null;
  return <SoundControlsInner compact={compact} />;
}

function SoundControlsInner({ compact }: { compact: boolean }) {
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
        {t("sound.sfx", { state: s.sfx ? "ON" : "OFF" })}
      </button>
      <button type="button" className={`ghost mini${s.bgm ? " sound-on" : ""}`} aria-pressed={s.bgm} onClick={() => update({ ...s, bgm: !s.bgm })}>
        BGM {s.bgm ? "ON" : "OFF"}
      </button>
      <label className="sound-volume">
        <span>{t("sound.volume")}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={s.volume}
          onChange={(e) => update({ ...s, volume: Number(e.target.value) })}
          onPointerUp={() => playSfx("play")}
          aria-label={t("sound.volume")}
        />
      </label>
    </span>
  );
}
