// 進軍ルートの後ろに敷くステージの背景
import { memo } from "react";
import { BACKDROP_H, BACKDROP_W, backdropPaths } from "./backdrops.js";

export const StageBackdrop = memo(function StageBackdrop({ name }: { name: string }) {
  return (
    <svg
      className="route-backdrop"
      viewBox={`0 0 ${BACKDROP_W} ${BACKDROP_H}`}
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {backdropPaths(name).map((p) => (
        <path key={p.color} fill={p.color} d={p.d} />
      ))}
    </svg>
  );
});
