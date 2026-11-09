// 画面の文言（設計書 4.3：文言は1か所にまとめる）
import type { CardDef, CardRegistry, Effect, ErrorCode, GameEvent, PlayerView, Resist } from "@deckbuild/core";

export const ERROR_TEXT: Record<ErrorCode, string> = {
  GAME_OVER: "ゲームは終了しています",
  NOT_YOUR_TURN: "あなたの手番ではありません",
  PENDING_INPUT: "先に選択を済ませてください",
  NOT_PENDING: "今は選択を求められていません",
  INVALID_STEP: "今はその操作はできません",
  CARD_NOT_FOUND: "そのカードは使えません",
  WRONG_CARD_TYPE: "そのカードでは行えません",
  NO_SLOT: "食料が足りません（英雄は1人＋食糧値の人数まで）",
  NOT_ENOUGH_GOLD: "金が足りません",
  NOT_ENOUGH_EXP: "経験値が足りません",
  STOCK_EMPTY: "在庫がありません",
  UNKNOWN_STACK: "その在庫はありません",
  NOT_FOR_SALE: "購入できないカードです",
  MAX_LEVEL: "最大レベルです",
  ALREADY_EQUIPPED: "すでに武器を装備しています",
  NO_ENEMY: "敵がいません",
  CANNOT_UNDO: "先に英雄を戻してください",
  CANNOT_CANCEL: "すでに集落で行動したため選び直せません",
  INVALID_SELECTION: "選び方が正しくありません",
};

export const HERO_NAMES: Record<string, string> = {
  knight: "騎士",
  mage: "魔法使い",
  hunter: "狩人",
  priest: "僧侶",
  thief: "盗賊",
  bard: "吟遊詩人",
  youth: "村の若者",
};

export function describeEffect(e: Effect): string {
  switch (e.kind) {
    case "draw":
      return `カードを${e.count}枚引く`;
    case "gold":
      return `金+${e.amount}`;
    case "exp":
      return `経験値+${e.amount}`;
    case "trash":
      return `手札か捨て札から${e.count}枚まで廃棄`;
    case "multi":
      return e.effects.map(describeEffect).join("、");
    case "discardHand":
      return e.target === "all" ? `全員が手札を${e.count}枚捨てる` : `次の手番のプレイヤーが手札を${e.count}枚捨てる`;
    case "addCurse":
      return `全員の捨て札に呪いを${e.count}枚加える`;
  }
}

export function resistText(r: Resist): string | null {
  return r === "half" ? "半減" : r === "immune" ? "無効" : null;
}

export function cardTitle(def: CardDef): string {
  if (def.type === "hero" && def.level > 0) return `${def.name} Lv${def.level}`;
  return def.name;
}

/** ログ用：画面から見える uid → カードID の対応 */
export function buildLookup(view: PlayerView): Map<string, string> {
  const m = new Map<string, string>();
  const add = (c: { uid: string; defId: string } | null | undefined) => {
    if (c) m.set(c.uid, c.defId);
  };
  for (const p of view.players) {
    p.hand?.forEach(add);
    p.discard?.forEach(add);
    p.field.forEach(add);
    add(p.discardTop);
  }
  view.route.flat().forEach(add);
  for (const st of Object.values(view.village.stacks)) add(st.top);
  return m;
}

export function eventText(
  e: GameEvent,
  reg: CardRegistry,
  lookup: Map<string, string>,
  playerName: (id: string) => string,
): string | null {
  const name = (defId: string | undefined) => (defId ? cardTitle(reg.get(defId)) : "？");
  const byUid = (uid: string) => name(lookup.get(uid));
  switch (e.type) {
    case "turnStarted":
      return `―― 手番 ${e.turnCount}（${playerName(e.playerId)}）――`;
    case "actionChosen":
      return e.action === "village" ? "集落を訪れた" : `${byUid(e.targetUid ?? "")}に戦いを挑んだ`;
    case "actionCanceled":
      return "行動を選び直した";
    case "marchSkipped":
      return "敵を撃破したため、敵は進軍しなかった";
    case "cardPlayed":
      return `${name(e.defId)}を出した`;
    case "cardReturned":
      return `${name(e.defId)}を手札に戻した`;
    case "weaponEquipped":
      return `${byUid(e.heroUid)}に${byUid(e.weaponUid)}を装備した`;
    case "cardBought":
      return `${name(e.defId)}を購入した（${e.cost}金）`;
    case "lootSold":
      return `戦利品を売却した：${e.defIds.map(name).join("、")}`;
    case "cardTrashed":
      return `${name(e.defId)}を廃棄した`;
    case "leveledUp": {
      const from = reg.hero(e.fromDefId);
      return from.level === 0
        ? `村の若者が${name(e.toDefId)}に転職した（経験値-${e.exp}）`
        : `${name(e.fromDefId)}が${name(e.toDefId)}にレベルアップした（経験値-${e.exp}）`;
    }
    case "attackResolved": {
      const sum = e.prevDamage > 0 ? `（累計 ${e.prevDamage + e.damage} / 生命力${e.hp}）` : `（生命力${e.hp}）`;
      const boss = reg.enemy(e.targetDefId).isBoss;
      const rest = boss && !e.defeated && e.damage > 0 ? `… 残り生命力 ${e.hp - e.prevDamage - e.damage}（ダメージは残る）` : `… ${e.defeated ? "撃破！" : "倒せなかった"}`;
      return `${name(e.targetDefId)}に${e.damage}ダメージ${sum}${rest}`;
    }
    case "expGained":
      return `経験値+${e.amount}`;
    case "enemyRevealed": {
      const d = reg.enemy(e.defId);
      const ability = d.onReveal ? `：${describeEffect(d.onReveal)}` : "";
      return `${d.name}が現れた！${ability}`;
    }
    case "enemyArrived": {
      const d = reg.enemy(e.defId);
      return d.isBoss ? `${d.name}が集落に到達した……` : `${d.name}が集落を襲った（耐久値-${e.damage} → ${e.villageHp}）`;
    }
    case "cardsDiscarded":
      return `${playerName(e.playerId)}が手札を捨てた：${e.defIds.map(name).join("、")}`;
    case "curseAdded":
      return `${playerName(e.playerId)}の捨て札に呪いが加わった`;
    case "deckShuffled":
      return "捨て札をシャッフルして山札にした";
    case "gameEnded":
      return e.result.outcome === "win" ? "ボスを討ち取った！" : "集落は陥落した……";
    case "effectResolved": {
      if (e.playerId !== null) return null;
      const src = lookup.get(e.sourceUid);
      if (!src) return null;
      const d = reg.get(src);
      if (d.type === "enemy" && d.isBoss && e.effect.kind === "discardHand" && e.effect.target === "next") {
        return `${d.name}の威圧：${describeEffect(e.effect)}`;
      }
      return null;
    }
    case "cardsDrawn":
    case "turnEnded":
    case "enemyMoved":
      return null;
  }
}

/** 結果の説明。boss はそのステージのボスの名前 */
export function resultReason(reason: string, boss: string): string {
  switch (reason) {
    case "bossDefeated":
      return `${boss}を討ち取り、集落を守り抜いた。`;
    case "villageDestroyed":
      return "集落の守りが尽き、魔物の群れに蹂躙された。";
    case "bossArrived":
      return `${boss}が集落に到達し、集落は落ちた。`;
    default:
      return "";
  }
}
