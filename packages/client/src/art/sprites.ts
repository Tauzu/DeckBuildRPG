// カードの絵（16×16 のドット絵）。1文字が1ドットで、色は PALETTE で決める。"." は透明
// 外部の素材は使わず、ここで描いたものだけを使う

export const PALETTE: Record<string, string> = {
  k: "#2a2117", // 輪郭
  x: "#141010", // 黒
  o: "#f1c9a0", // 肌
  h: "#6b3d1e", // 髪
  y: "#e8b923", // 金
  s: "#c3cbd4", // 鋼
  S: "#7d8794", // 暗い鋼
  w: "#f6f2e6", // 白
  e: "#ddd6c2", // 骨
  r: "#c0402c", // 赤
  R: "#7a2016", // 暗い赤
  b: "#4a72c4", // 青
  B: "#25427e", // 暗い青
  g: "#5c9c40", // 緑
  G: "#2f5a22", // 暗い緑
  l: "#b6e07a", // 明るい緑
  p: "#8a58b8", // 紫
  P: "#4b2a6e", // 暗い紫
  n: "#9a6532", // 木
  N: "#5a3618", // 暗い木
  c: "#7fdcec", // 光
  f: "#f0902a", // 炎
  m: "#d07a62", // 肉
  u: "#d0923e", // パンの皮
  U: "#8e5a22", // パンの皮（濃い）
  i: "#f6d894", // パンの切れ目
  q: "#b85a2e", // 焼いた肉
  Q: "#6e2c14", // 焼いた肉（濃い）
  j: "#ec9c60", // 肉のつや
  t: "#8c8c8c", // 石
  T: "#555a60", // 石（濃い）
  a: "#b04a3a", // 屋根
  z: "#3d6b2a", // 草
};

export type Sprite = readonly string[];

// ---------------------------------------------------------------------------
// 英雄

const youth: Sprite = [
  "................",
  "................",
  ".....yyyyyy.....",
  "...yyyyyyyyyy...",
  ".....hooooh.....",
  ".....okooko.....",
  ".....oooooo.....",
  "......oooo......",
  "....nnnnnnnn....",
  "...nnnnnnnnnn...",
  "..o.nnnnnnnn.o..",
  "....nnNNNNnn....",
  "....bbb..bbb....",
  "....bb....bb....",
  "...NNN....NNN...",
  "................",
];

const knight: Sprite = [
  ".......rr.......",
  "......rr........",
  ".....ssss.......",
  "....ssssss....y.",
  "....sSkkSs....s.",
  "....ssssss....s.",
  ".....SssS.....s.",
  "...ssssssss...s.",
  "..sSssssssSs..s.",
  "..s.ssrrss.s.yyy",
  "..o.ssrrss.o..n.",
  "....ssssss......",
  "....sS..Ss......",
  "....ss..ss......",
  "....SS..SS......",
  "...kkk..kkk.....",
];

const frost: Sprite = [
  ".....ccc......c.",
  "....ccwcc....ccc",
  "...ccbbbbcc...c.",
  "...cbbbbbbc...n.",
  "....bokokb....n.",
  "....booooB....n.",
  ".....bbbb.....n.",
  "...wwwwwwww...n.",
  "..wwwwwwwwww.on.",
  "..wwwcwwcwww.wn.",
  "..wwwwwwwwww..n.",
  "..wwwwwwwwww..n.",
  "..cwwwwwwwwc..n.",
  "..bbbbbbbbbb....",
  "....kk..kk......",
  "................",
];

const frostStaff: Sprite = [
  "............cc..",
  "...........cwwc.",
  "...........cwcc.",
  "............cc..",
  "...........n....",
  "..........nn....",
  ".........nn.....",
  "........nn......",
  ".......nn.......",
  "......nn........",
  ".....nn.........",
  "....nn..........",
  "...nn...........",
  "..nn............",
  ".nn.............",
];

const mage: Sprite = [
  ".......B......c.",
  "......BB.....ccc",
  ".....BBBB.....n.",
  "....BBBBBB....n.",
  "...BByyyyBB...n.",
  ".....oooo.....n.",
  ".....okko.....n.",
  ".....oooo.....n.",
  "....bbbbbb...on.",
  "...bbbbbbbb..bn.",
  "...bbbyybbb...n.",
  "...bbbbbbbb...n.",
  "...bbbbbbbb...n.",
  "..bbbbbbbbbb..n.",
  "..BBBBBBBBBB....",
  "....kk..kk......",
];

const hunter: Sprite = [
  "................",
  ".....GGGG...n...",
  "....GggggG...n..",
  "....GooooG...wn.",
  "....GokkoG...w.n",
  "....GooooG...w.n",
  ".....gggg....w.n",
  "...ggggggggoow.n",
  "..o.gNNNNgg..w.n",
  "....ggggggg..w.n",
  "....ggggggg..wn.",
  "....gg..gg...n..",
  "....gg..gg......",
  "....NN..NN......",
  "...NNN..NNN.....",
  "................",
];

const priest: Sprite = [
  "................",
  "......wwww......",
  ".....wwwwww..y..",
  ".....wooooww.y..",
  ".....okkoow.yyy.",
  ".....oooo....y..",
  "....wwwwwww..n..",
  "...wwwyywwww.n..",
  "...wwyyyywwwon..",
  "...wwwyywwww.n..",
  "...wwwyywwww.n..",
  "...wwwwwwwww.n..",
  "..wwwwwwwwwww...",
  "..eeeeeeeeeee...",
  "....kk...kk.....",
  "................",
];

const thief: Sprite = [
  "................",
  ".....PPPP.......",
  "....PPPPPP......",
  "....PxxxxP......",
  "....PokkoP......",
  "....PooooP......",
  ".....PPPP.......",
  "...PPpppPPP.....",
  "..o.PpppPP.o....",
  "....PPyPPP..s...",
  "....PPPPPP.s....",
  "....PP..PP.y....",
  "....PP..PP......",
  "....xx..xx......",
  "...xxx..xxx.....",
  "................",
];

const bard: Sprite = [
  "..........w.....",
  "......rrrrw.....",
  ".....rrrrrr.....",
  "....rrrrrrrr....",
  ".....oooo.......",
  ".....okko.......",
  ".....oooo.......",
  "....yyyyyy......",
  "...yyyyyyyy..nn.",
  "..o.yyyyyy..nNNn",
  "....rrrrrr..onNn",
  "....yy..yy...nn.",
  "....yy..yy......",
  "....NN..NN......",
  "...NNN..NNN.....",
  "................",
];

// ---------------------------------------------------------------------------
// 武器

const club: Sprite = [
  "................",
  "...........NN...",
  "..........NnnN..",
  ".........NnnnN..",
  "........NnnnN...",
  ".......NnnN.....",
  "......NnnN......",
  ".....NnN........",
  "....NnN.........",
  "...NnN..........",
  "..NnN...........",
  ".NnN............",
  ".NN.............",
];

const sword: Sprite = [
  "..............ss",
  ".............sws",
  "............sws.",
  "...........sws..",
  "..........sws...",
  ".........sws....",
  "........sws.....",
  "...y...sws......",
  "....y.sws.......",
  ".....yws........",
  "......yy........",
  ".....nyyy.......",
  "....nn...y......",
  "...nn...........",
  "..yy............",
];

const staff: Sprite = [
  "............ll..",
  "...........llll.",
  "...........lggl.",
  "............ll..",
  "...........n....",
  "..........nn....",
  ".........nn.....",
  "........nn......",
  ".......nn.......",
  "......nn........",
  ".....nn.........",
  "....nn..........",
  "...nn...........",
  "..nn............",
  ".nn.............",
];

const javelin: Sprite = [
  "..............s.",
  ".............sss",
  "............sss.",
  "...........Sn...",
  "..........nn....",
  ".........nn.....",
  "........nn......",
  ".......nn.......",
  "......nn........",
  ".....nn.........",
  "....nn..........",
  "...nn...........",
  "..nn............",
  ".rr.............",
];

const bow: Sprite = [
  "......nnn.......",
  ".....n...w......",
  "....n....w......",
  "....n....w......",
  "...n.....w......",
  "...n.....w......",
  "...n.ssssssssS..",
  "...y.....w...SS.",
  "...n.....w......",
  "...n.....w......",
  "...n.....w......",
  "....n....w......",
  "....n....w......",
  ".....n...w......",
  "......nnn.......",
];

const hammer: Sprite = [
  "...SSSSSSSSS....",
  "...SsssssssS....",
  "...SssyyyssS....",
  "...SsyyyyysS....",
  "...SssyyyssS....",
  "...SsssssssS....",
  "...SSSSSSSSS....",
  ".......nn.......",
  ".......nn.......",
  ".......nn.......",
  ".......nn.......",
  ".......NN.......",
  ".......nn.......",
  ".......NN.......",
];

const sage: Sprite = [
  ".......pp.......",
  "......pccp......",
  ".....pcwcp......",
  "......pccp......",
  ".......pp.......",
  "......n..n......",
  ".......nn.......",
  ".......nn.......",
  ".......nn.......",
  ".......nn.......",
  "......nn........",
  ".......nn.......",
  ".......nn.......",
  ".......NN.......",
];

const axe: Sprite = [
  "................",
  ".....SSS........",
  "....Sssss.......",
  "...Ssssssnn.....",
  "...SsssssNn.....",
  "...Sssssnn......",
  "....SssnN.......",
  ".....Snn........",
  ".....nn.........",
  "....nn..........",
  "...nn...........",
  "..nn............",
  ".NN.............",
];

const tome: Sprite = [
  "................",
  "................",
  "...BBBBBBBBBB...",
  "...BbbbbbbbbBw..",
  "...BbbbyybbbBw..",
  "...BbbyccybbBw..",
  "...BbbyccybbBw..",
  "...BbbbyybbbBw..",
  "...BbbbbbbbbBw..",
  "...BbbbbbbbbBw..",
  "...BBBBBBBBBBw..",
  "....wwwwwwwwww..",
];

const amulet: Sprite = [
  ".....y....y.....",
  "......y..y......",
  ".......yy.......",
  ".......yy.......",
  "......yyyy......",
  ".....yccccy.....",
  "....yccwwccy....",
  "....ycwwwwcy....",
  "....yccwwccy....",
  ".....yccccy.....",
  "......yyyy......",
];

const mithril: Sprite = [
  "..............cc",
  ".............cwc",
  "............cwc.",
  "...........cwc..",
  "..........cwc...",
  ".........cwc....",
  "........cwc.....",
  "...y...cwc......",
  "....y.cwc.......",
  ".....ywc........",
  "......yy........",
  ".....byyy.......",
  "....bb...y......",
  "...bb...........",
  "..yy............",
];

// ---------------------------------------------------------------------------
// 食料

const bread: Sprite = [
  "................",
  "................",
  "................",
  "......UUUU......",
  "....UUuuuuUU....",
  "...UuuuiuuuuU...",
  "..UuuuiuuuiuuU..",
  "..UuuiuuuiuuuU..",
  ".UuuuuuuiuuuuuU.",
  ".UuuuuuuuuuuuuU.",
  ".UUuuuuuuuuuuUU.",
  "..UUUUUUUUUUUU..",
];

const jerky: Sprite = [
  "................",
  ".....QQQQQ......",
  "...QQqqqqqQQ....",
  "..QqqjjqqqqqQ...",
  "..QqjjqqqqqqQ...",
  "..QqjqqqqqqqQ...",
  "..QqqqqqqqqqQ...",
  "..QqqqqqqqqQQww.",
  "...QQqqqqqQwwew.",
  ".....QQQQQwew...",
  ".........wew....",
  "........wew.....",
  ".......wwew.....",
  "......weww......",
  "......ww........",
];

const wine: Sprite = [
  "......SS........",
  "......gg........",
  "......gg........",
  ".....gggg.......",
  "....gPPPPg......",
  "....gPPPPg..ww..",
  "....gwwwwg.wPPw.",
  "....gPPPPg.wPPw.",
  "....gPPPPg..ww..",
  "....gggggg..ww..",
  "...........wwww.",
];

const feast: Sprite = [
  "................",
  "................",
  ".....nnnnnn.....",
  "...nnffffffnn...",
  "..nffffffffffn.e",
  "..nffffwfffffnee",
  "..nffffffffffn..",
  "...nnnnnnnnnn...",
  ".wwwwwwwwwwwwww.",
  "..wwwwwwwwwwww..",
];

// ---------------------------------------------------------------------------
// 敵

const goblin: Sprite = [
  "................",
  "..g..gggg..g....",
  "..gggggggggg....",
  "...gGkggkGg.....",
  "...gggggggg.....",
  "....gwwwwg......",
  ".....gggg.......",
  "...nnnnnnnn..s..",
  "..g.nnnnnn.gs...",
  "....nnnnnn......",
  "....gg..gg......",
  "....gg..gg......",
  "...GGG..GGG.....",
];

const wolf: Sprite = [
  "................",
  "............S...",
  "...........SSS..",
  "..........SeeS..",
  "..S......SSSekS.",
  "..SS....SSSSSSSx",
  "...SSSSSSSSSSSS.",
  "...SeeeeeeeeSS..",
  "...SSSSSSSSSS...",
  "...SS.SS..SS.SS.",
  "...SS.SS..SS.SS.",
  "...k..k....k..k.",
];

const skeleton: Sprite = [
  ".....eeeee......",
  "....eeeeeee.....",
  "....exxexxe.....",
  "....eeeeeee.....",
  ".....exexe......",
  "......eee.......",
  "....eeeeeee.....",
  "...e.e.e.e.e....",
  "...e.eeeee.e....",
  ".....e.e.e......",
  "......eee.......",
  ".....e...e......",
  ".....e...e......",
  "....ee...ee.....",
];

const ghost: Sprite = [
  ".....wwwww......",
  "....wwwwwww.....",
  "...wwwwwwwww....",
  "...wwxwwwxww....",
  "...wwxwwwxww....",
  "...wwwwwwwww....",
  "...wwwxxxwww....",
  "...wwwwwwwww....",
  "...wwwwwwwww....",
  "...wwwwwwwww....",
  "...ww.www.ww....",
  "...w...w...w....",
];

const shaman: Sprite = [
  "...ee...........",
  "..exxe..........",
  "..eeee.gggg.....",
  "...n..gggggg....",
  "...n..gykkyg....",
  "...n..gggggg....",
  "...n...gwwg.....",
  "...n..pppppp....",
  "...nggppppppg...",
  "...n..pppppp....",
  "...n..pppppp....",
  "...n..gg..gg....",
  "...n..GG..GG....",
];

const orc: Sprite = [
  "....GGGGGG......",
  "...GGGGGGGG.....",
  "...GrGGGGrG.....",
  "...GGGGGGGG.....",
  "...GwGGGGwG.....",
  "....GGGGGG......",
  "..GGNNNNNNGG..S.",
  ".GG.NNNNNN.GGSS.",
  ".G..NNNNNN..GnS.",
  "....NNNNNN...n..",
  "....GG..GG...n..",
  "....GG..GG......",
  "...NNN..NNN.....",
];

const gargoyle: Sprite = [
  "................",
  ".S............S.",
  ".SS..SSSSSS..SS.",
  ".SSS.SrSSrS.SSS.",
  ".SSSSSSSSSSSSSS.",
  "..SSSSSwwSSSSS..",
  "...SS.SSSS.SS...",
  "......SSSS......",
  ".....SS..SS.....",
  ".....S....S.....",
  "....SS....SS....",
];

const necro: Sprite = [
  ".....PPPP.....l.",
  "....PPPPPP...lel",
  "....PxxxxP....n.",
  "....PxlxlP....n.",
  "....PxxxxP....n.",
  ".....PPPP.....n.",
  "...PPPPPPPP...n.",
  "..PPpPPPPpPP.en.",
  "..P.pPPPPp.P..n.",
  "....pPPPPp....n.",
  "...PPPPPPPP...n.",
  "..PPPPPPPPPP....",
];

// ---------------------------------------------------------------------------
// ボス

const dragon: Sprite = [
  "..........RR....",
  ".........RrrR...",
  "....R...RrrrrR..",
  "...RR...RrrkrR..",
  "..RrR...RrrrrRf.",
  ".RrrR..RrrrrRff.",
  ".RrrrRRrrrrR..f.",
  ".RrrrrrrrrR.....",
  "..RrryyyrrR.....",
  "..RrryyyyrrR....",
  "...RryyyyrrR....",
  "...RrrrrrrR.....",
  "....RR..RR......",
  "....Rk..Rk......",
];

const goblinChief: Sprite = [
  "....y.y.y.......",
  "....yyyyy.......",
  "...ggggggg......",
  "..gGggggggg.....",
  "..ggrkgrkgg.....",
  "..ggggggggg.....",
  "...gwwwwwg......",
  "....ggggg.......",
  "..RRRRRRRRR..s..",
  ".g.RRyRRRR.gs...",
  "...RRRRRRR.ss...",
  "...gg...gg......",
  "...gg...gg......",
  "..GGG...GGG.....",
];

const boneGeneral: Sprite = [
  "....SSSSS.......",
  "...SSrrrSS......",
  "...SeeeeeS......",
  "...exxexxe......",
  "...eeeeeee......",
  "....exexe.......",
  ".....eee.....s..",
  "...SSSSSSS..s...",
  "..e.SeSeS.ys....",
  "....SSSSS..y....",
  ".....e.e........",
  "....e...e.......",
  "...ee...ee......",
];

const wraithQueen: Sprite = [
  "....y.y.y.......",
  "....yyyyy.......",
  "...ccccccc......",
  "..ccccccccc.....",
  "..ccPcccPcc.....",
  "..ccPcccPcc.....",
  "..ccccccccc.....",
  "..cccPPPccc.....",
  "..ccccccccc.....",
  ".ppccccccccp....",
  ".p.ccccccc..p...",
  "...cc.c.cc......",
  "...c..c..c......",
];

const ogreChief: Sprite = [
  "..e..........e..",
  "..ee.nnnnnn.ee..",
  "...enmnnnnmne...",
  "....nnnnnnnn....",
  "....nrnnnnrn....",
  "....nnnnnnnn....",
  "....nwnwwnwn....",
  "..NNnnnnnnnnNN..",
  ".nn.RRRRRRRR.nnN",
  ".n..RRRRRRRR..NN",
  "....RRRRRRRR..N.",
  "....nn....nn....",
  "...NNN....NNN...",
];

const curse: Sprite = [
  "................",
  "......PPPP......",
  "....PPppppPP....",
  "...PppppppppP...",
  "...ppxxppxxpp...",
  "...ppxxppxxpp...",
  "...pppppppppp...",
  "....pppxxppp....",
  ".....pppppp.....",
  ".....p.p.p......",
];

/** 魔物の砦 */
export const fortSprite: Sprite = [
  "....r...........",
  "....rr......r...",
  "....r.......rr..",
  "...TtT......r...",
  "...TtT.....TtT..",
  "..TtTtT....TtT..",
  "..TtttT.T.TtttT.",
  "..TtttTTtTTtttT.",
  "..TtttttttttttT.",
  "..TtxtttttttxtT.",
  "..TttttxxxtttTT.",
  "..TttttxxxttttT.",
  "..TttttxxxttttT.",
  "TTTTTTTTTTTTTTTT",
];

const snowWolf: Sprite = wolf.map((r) => r.replaceAll("S", "c").replaceAll("e", "w"));

const frostGuard: Sprite = [
  "................",
  ".....SSSSS......",
  "....SsssssS.....",
  "....SsxsxsS.....",
  "....SsssssS.....",
  ".....SSSSS......",
  "..ccccccccccc...",
  ".cwwwwwwwwwwwc..",
  ".cwbbbbbbbbbwc..",
  ".cwbbbwwbbbbwc..",
  ".cwbbwwwwbbbwc..",
  ".cwbbbwwbbbbwc..",
  ".cwbbbbbbbbbwc..",
  "..cwwwwwwwwwc...",
  "...ccc....ccc...",
  "..SSSS....SSSS..",
];

const slime: Sprite = [
  "................",
  "................",
  "................",
  ".......gg.......",
  "....gggggggg....",
  "...gglgggggGg...",
  "..gglggggggggG..",
  "..gggkggggkggG..",
  "..ggggggggggGG..",
  "..gggggkkgggGG..",
  "..GggggggggggG..",
  "...GGGGGGGGGG...",
];

const slimeling: Sprite = [
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......gggg.....",
  "......gglggG....",
  ".....gggggggG...",
  ".....gkggkggG...",
  ".....ggggggGG...",
  "......GGGGGG....",
];

const snowQueen: Sprite = [
  ".....c.cc.c.....",
  "....cwcwwcwc....",
  ".....cccccc.....",
  "....wwooooww....",
  "...wwokookwww...",
  "...wwooooowww...",
  "....wwwwwww.....",
  "...ccwwwwwcc....",
  "..cwwwcwwcwwc...",
  "..cwwwwwwwwwc...",
  ".ccwwwwwwwwwcc..",
  ".cwwwwwwwwwwwc..",
  ".cwwwbwwwbwwwc..",
  "ccwwwwwwwwwwwcc.",
  "cwwwwwwwwwwwwwc.",
  "cccccccccccccccc",
];

/** エルム村 */
export const villageSprite: Sprite = [
  "................",
  "..........aa....",
  "....aa...aaaa...",
  "...aaaa.aaaaaa..",
  "..aaaaaaaaaaaaa.",
  ".aaaaaa..wwwwww.",
  "..wwwww..wnnxww.",
  "..wnxww..wnnxww.",
  "..wnxww..wnnwww.",
  "..wwwww..wwwwww.",
  "zzzzzzzzzzzzzzzz",
  "zgzzgzzzgzzzgzzg",
];

/** 英雄の種類ごとの絵（レベルが違っても同じ絵） */
const HERO_SPRITES: Record<string, Sprite> = { youth, knight, mage, hunter, priest, thief, bard, frost };

/** カードIDごとの絵（英雄以外） */
const CARD_SPRITES: Record<string, Sprite> = {
  weapon_club: club,
  weapon_sword: sword,
  weapon_staff: staff,
  weapon_javelin: javelin,
  weapon_bow: bow,
  weapon_hammer: hammer,
  weapon_sage: sage,
  weapon_axe: axe,
  weapon_tome: tome,
  weapon_amulet: amulet,
  weapon_mithril: mithril,
  weapon_frost: frostStaff,
  food_bread: bread,
  food_jerky: jerky,
  food_wine: wine,
  food_feast: feast,
  enemy_goblin: goblin,
  enemy_wolf: wolf,
  enemy_skeleton: skeleton,
  enemy_ghost: ghost,
  enemy_shaman: shaman,
  enemy_orc: orc,
  enemy_gargoyle: gargoyle,
  enemy_necro: necro,
  enemy_dragon: dragon,
  enemy_goblin_chief: goblinChief,
  enemy_bone_general: boneGeneral,
  enemy_wraith_queen: wraithQueen,
  enemy_ogre_chief: ogreChief,
  enemy_snow_wolf: snowWolf,
  enemy_frost_guard: frostGuard,
  enemy_slime: slime,
  enemy_slimeling: slimeling,
  enemy_snow_queen: snowQueen,
  curse,
};

/** カードの絵。英雄は heroId で引く。見つからなければ null */
export function spriteFor(defId: string, heroId?: string): Sprite | null {
  if (heroId) return HERO_SPRITES[heroId] ?? null;
  return CARD_SPRITES[defId] ?? null;
}

export const ALL_SPRITES = { ...HERO_SPRITES, ...CARD_SPRITES, fort: fortSprite, village: villageSprite };
