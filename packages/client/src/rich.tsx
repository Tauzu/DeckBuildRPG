// 文言の中の **太字** を <strong> にする（遊び方など、文の一部を強調したい所で使う）
import { Fragment, type ReactNode } from "react";
import { type MessageKey, type Params, t } from "./i18n.js";

export function rich(text: string): ReactNode {
  const pieces = text.split(/\*\*(.+?)\*\*/);
  return pieces.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <Fragment key={i}>{p}</Fragment>));
}

/** t() の結果を rich() にかける */
export function tr(key: MessageKey, params?: Params): ReactNode {
  return rich(t(key, params));
}
