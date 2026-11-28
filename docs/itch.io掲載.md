# itch.io 掲載と告知（収益化ロードマップ 段階1）

> 作成：2026-11-27。itch.io の画面の文言は変わることがあるので、違っていたら近い項目を探す。

---

## 1. アップロードする zip を作る

```sh
npm run build:itch
```

PowerShell で zip にする：

```powershell
Compress-Archive -Path "packages/client/dist-itch/*" -DestinationPath "packages/client/foodie-quest-itch.zip" -Force
```

- itch.io 用の組み立ては、画面を itch.io に置き、協力プレイは Render のサーバーにつなぐ（`client/src/deploy.ts`）
- 1人プレイは itch.io の中だけで動くので、Render が寝ていても待たずに遊べる
- 協力プレイの招待リンクは、Render のゲーム（https://foodie-quest.onrender.com/?room=…）を開く
- サーバーは itch.io の画面（`*.itch.zone`）からの接続だけを、ほかのサイトより特別に受け付ける（`server/src/origins.ts`）。**この変更が Render に反映されていないと、itch.io からの協力プレイはつながらない**

## 2. itch.io に作品を作る

1. https://itch.io にログインし、右上のメニューから **Upload new project**
2. 下の表のとおりに入れる

| 項目 | 入れるもの |
|---|---|
| Title | FOODIE QUEST |
| Project URL | `foodie-quest`（`https://tauzu.itch.io/foodie-quest` になる） |
| Short description or tagline | A co-op deckbuilder where your heroes need food to fight. |
| Classification | Games |
| Kind of project | **HTML**（ブラウザで遊べる） |
| Release status | **In development**（まだ手を入れ続けるので） |
| Pricing | **$0 or donate**（無料で遊べて、投げ銭もできる）。Suggested donation は $3 |
| Uploads | `foodie-quest-itch.zip` を上げ、**This file will be played in the browser** にチェック |
| Embed options | Viewport dimensions：**1200 × 720**（2026-11-28 にユーザーが設定。横 1200 でも PC 用の並びのまま（900 より狭いとスマートフォン寄りの並びになる）。多くの PC で、ブラウザの枠と itch.io のページの上の部分を引いても収まる高さ。ゲームの中はスクロールできるので、低くても欄は重ならない。狭い画面の人は全画面ボタンで遊べる）。**Mobile friendly** にチェック（Orientation：Landscape）。**Fullscreen button** にチェック。**Automatically start on page load** にチェック（外すと、押す前は灰色の画面に「Run game」だけになり味気ない。ブラウザは押すまで音を出させないので、急に鳴る心配はない） |
| Frame options | **Enable scrollbars** は外す（ゲームの中で、収まらない画面はパネルの中だけがスクロールする。外の枠までスクロールすると、どこが動いているのか分かりにくい）。**Click to launch in fullscreen** は外したままでよい |
| Genre | Card Game |
| Tags | `deckbuilding`, `card-game`, `roguelite`, `co-op`, `multiplayer`, `pixel-art`, `fantasy`, `turn-based`, `strategy`, `singleplayer` |
| AI generation disclosure | 使った場合は正直に書く（コードに AI の手伝いを受けたなど） |
| Community | **Comments** を有効にする（感想を集めるため） |
| Visibility | まず **Draft** で保存 → 自分で遊んで確かめてから **Public** |

- 言語（Languages）・操作（Inputs）・リンク（Links）を入れる欄は、2026-11 時点の作品の作成画面には見当たらなかった（ユーザーが確認）。言語は説明文の FEATURES に、Render と Ko-fi へのリンクは説明文の最後に書いてあるので、それで足りる。

### 作品ページの説明（Description）

そのまま貼れる英語の文。最後に日本語の短い紹介も付ける。

```
FOODIE QUEST – The Hungry Heroes of Elm Village

No hero fights on an empty stomach.

The Dread Dragon's army is marching on Elm Village, and help from the capital won't arrive in time.
Recruit heroes, feed them, and build your deck before the monsters reach the gate.

HOW IT PLAYS
• Each turn, either VISIT THE VILLAGE (buy cards, use village effects, level up heroes) or FIGHT an enemy on the march route.
• One hero fights for free. Every extra hero needs FOOD. Bread, jerky and feasts decide how big your party can be.
• Defeated monsters become loot in your deck: spend them as gold, then they're gone.
• Enemies advance every turn. Grow strong enough to slay the boss hidden at the bottom of the enemy deck before the village falls.

FEATURES
• Solo or online co-op for 1–4 players (share a room code or invite link, no account needed)
• 6 stages with different bosses, from the tutorial forest to the Frozen Pass
• 5 Danger levels per stage, 22 achievements, a card collection
• Pixel art and original chiptune music
• English / 日本語

Co-op tip: to play together, open the game at https://foodie-quest.onrender.com and share the invite link. (The free server may take about a minute to wake up.)

This is a solo indie project and still in development. Feedback is very welcome in the comments!
If you enjoy it, you can support development here: https://ko-fi.com/tauzu

―――
日本語：腹がへっては戦はできぬ。食料で英雄を呼び集め、魔竜の軍勢から村を守る、協力型デッキビルドRPG。1人でも、最大4人の協力プレイでも遊べます。
```

### 画像（itch.io に上げるもの）

用意したもの（`docs/itch/`）。手元のゲームを英語で開き、画面なしの Chrome で自動で遊ばせて撮った（2026-11-27）。

| 種類 | ファイル | 中身 |
|---|---|---|
| Cover image | `cover.png`（630 × 500） | タイトルの背景（夜空・月・山）に、肉と剣の絵とロゴ、「Co-op deckbuilder RPG · 1–4 players · Play in browser」 |
| Screenshot 1 | `screenshot-1-title.png`（1280 × 720） | 英語のタイトル画面 |
| Screenshot 2 | `screenshot-2-battle.png`（1280 × 960） | 進軍ルートに敵が5体、戦闘で「You can defeat it!」が出た場面 |
| Screenshot 3 | `screenshot-3-boss.png`（1280 × 960） | ボス（Bone General）が現れ、進軍ルートの背景が赤くなった場面 |
| Screenshot 4 | `screenshot-4-stages.png`（1280 × 960） | ステージ選択と危険度 |
| GIF | `gameplay.gif`（960 × 600、約14秒、1.2MB） | 敵を選ぶ → 食料と英雄を出す → 武器を持たせる → 倒して経験値が入る。押した場所に黄色い丸が出る |

- itch.io の作品の編集画面で、**Cover image** に `cover.png`、**Screenshots** に静止画4枚を上げる
- `gameplay.gif` は **Description** のいちばん上に画像として入れる（右の列のスクリーンショットは小さいので、GIF は説明文で大きく見せる。右の列には入れない）
- ページの見た目（Edit theme）の Screenshots の LAYOUT は **Sidebar** にする。埋め込みが 1280 と広いので、Auto だと Hidden になり、スクリーンショットが出ない
- Reddit と X の告知には `gameplay.gif` を付ける
- 協力プレイのロビーの画面はまだない。あると協力プレイが伝わりやすい

## 3. 公開したあと

- itch.io の **Edit game → Metadata** で **Public** にする
- 作品ページの **devlog** に「First public build」を書く（新着に出る）
- GoatCounter で、itch.io から来た人の数を見る（参照元に `itch.io` や `itch.zone` が出る）

---

## 4. 告知文の下書き

告知のたびに、動く画面（GIF か短い動画）を付ける。宣伝だけの投稿は嫌われるので、「遊んで意見がほしい」という形にする。投稿する前に、それぞれの掲示板の決まり（自作の宣伝の扱い・曜日の決まり）を読む。

### Reddit：r/WebGames

タイトル：

```
[FOODIE QUEST] A co-op deckbuilder where your heroes need food to fight (browser, solo or 1–4 players online)
```

本文：

```
Hi! I made a small deckbuilding RPG that runs in the browser.

Monsters march toward your village every turn. You either visit the village to buy cards and level up heroes, or fight an enemy on the route. The twist: only one hero fights for free, and every extra hero needs food. Defeated monsters become loot in your deck that you can spend as gold.

You can play solo, or create a room and share the link to play co-op with up to 4 friends (no account needed).

Play: https://tauzu.itch.io/foodie-quest

It's still in development, so I'd love to hear what's confusing or what feels off. Thanks for playing!
```

### Reddit：r/playmygame

タイトル：

```
FOODIE QUEST – a co-op deckbuilder RPG where heroes need food to fight. Looking for feedback on the tutorial and balance
```

本文（上の r/WebGames と同じ本文に、聞きたいことを足す）：

```
Things I'd especially like feedback on:
1. Did the tutorial make the rules clear?
2. Did the food → hero limit feel interesting or just restrictive?
3. Which stage did you stop at, and why?
```

### Reddit：r/deckbuildinggames

自作の宣伝ができる曜日・スレッドが決まっていることがあるので、決まりを読んでから。本文は r/playmygame と同じでよい。

### X（英語）

```
FOODIE QUEST is now on itch.io 🍞⚔️

A co-op deckbuilder where your heroes need food to fight.
Solo or 1–4 players online, right in your browser.

https://tauzu.itch.io/foodie-quest

#indiedev #gamedev #deckbuilder #pixelart #indiegame
```

### X（日本語）

```
「FOODIE QUEST」を itch.io で公開しました🍞⚔️

腹がへっては戦はできぬ。
食料で英雄を呼び集め、魔竜の軍勢から村を守る協力型デッキビルドRPG。
ブラウザで、1人でも最大4人でも遊べます。

https://foodie-quest.onrender.com
（英語版：https://tauzu.itch.io/foodie-quest ）

#indiegame #ゲーム制作 #デッキ構築 #ドット絵
```

### 告知のあと

- その日の GoatCounter の数（開いた・遊び始めた・最後まで遊んだ）と、どこから来たかをこの文書の下に書き足す
- Reddit のコメントには、その日のうちに返事をする
- もらった意見は `docs/進捗.md` に書き、直したら「直しました」と返す（次の告知の話題にもなる）

## 5. 記録

| 日付 | 場所 | 開いた | 遊び始めた | 最後まで | メモ |
|---|---|---|---|---|---|
| | | | | | |
