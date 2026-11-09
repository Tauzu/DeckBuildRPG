// ドット絵を SVG で描く。同じ色の横に並んだドットを1本の線（path）にまとめる
import { memo } from "react";
import { PALETTE, type Sprite } from "./sprites.js";

const cache = new WeakMap<Sprite, { color: string; d: string }[]>();

function toPaths(sprite: Sprite): { color: string; d: string }[] {
  const hit = cache.get(sprite);
  if (hit) return hit;
  // 縦は下にそろえる（足元が下に来るように）
  const top = 16 - sprite.length;
  const byColor = new Map<string, string[]>();
  sprite.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== ".") {
        const list = byColor.get(ch) ?? [];
        list.push(`M${x} ${y + top}h${end - x}v1h${x - end}z`);
        byColor.set(ch, list);
      }
      x = end;
    }
  });
  const paths = [...byColor].map(([ch, parts]) => ({ color: PALETTE[ch] ?? "#f0f", d: parts.join("") }));
  cache.set(sprite, paths);
  return paths;
}

export const PixelArt = memo(function PixelArt({ sprite, size, className }: { sprite: Sprite; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {toPaths(sprite).map((p) => (
        <path key={p.color} d={p.d} fill={p.color} />
      ))}
    </svg>
  );
});
