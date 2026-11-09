// 画面の大きさなどを調べる小さな道具
import { type PointerEvent, useEffect, useRef, useState } from "react";

/** スマートフォンの縦持ちくらいの幅か */
export const PHONE_QUERY = "(max-width: 700px)";

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const m = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}

/** 長押し（タッチ）を見分ける。長押しのあとのクリックは無視できるよう fired() で知らせる */
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        fired.current = false;
        if (e.pointerType === "mouse") return;
        start.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = setTimeout(() => {
          fired.current = true;
          onLongPress();
        }, ms);
      },
      onPointerMove: (e: PointerEvent) => {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) clear();
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
    },
    /** 直前の操作が長押しだったか */
    fired: () => fired.current,
  };
}
