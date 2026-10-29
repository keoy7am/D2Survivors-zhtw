# 遊戲改版與翻譯維護：細節與工具

`SKILL.md` 的步驟遇到下面這些情況時才讀對應段落。

## 改版 SOP 的分支處理

- **補丁失敗**（`補丁「…」命中 0 次`）：作者改了渲染器。到 `game/ui-*.js` 找 `drawForeign`／`wrapLines`／`charCodeAt(0);return` 附近，對照 `extension/patch-ui.js` 的 regex 調整，跑 `node tools/test-patch.mjs` 再 `npm run build`。名稱可能含 `$`。
- **官方預填**（`tools/prefill-official.mjs`）：D2R 官方字串表（GitHub `Wing924/d2r-wing`）有英／繁中／韓三語；英文相同且韓文與遊戲字典相同就直接取官方繁中。物品、技能、怪物、地名多半由這步解決。
- **字典解析失敗**：作者換了字典格式，改 `extension/dict-keys.js`，用 `node tools/test-dict-keys.mjs` 對帳。
- **e2e 失敗**：先看是哪一項；網站掛掉或 Cloudflare 擋 headless 時重跑一次。
- **翻譯批次**：`i18n/todo/` 每批派一個 subagent（`model: sonnet`），給它 `i18n/STYLE.md`、`i18n/glossary.json` 的路徑與批名，要求寫 `i18n/done/<批名>.json` 並跑 `node tools/verify-batch.mjs <批名>` 到通過。批次互不重疊，可以平行；量大時用 Workflow 的 pipeline（翻譯 → verify 未過再派一次修正）。
- **版本號**：同一個號碼不能有兩份內容。`extension/` 和目前版本的已發佈 tag 不同時，先 patch 遞增 `manifest.json`，再推送或打包（`tools/check-version.mjs` 會擋）。

## 網站層文字

`i18n/site.json` 以英文原文為 key。`node tools/site-keys.mjs game/*.js` 列出缺譯的英文句子，補翻後重建；build 也會報「網站層缺譯 N 條」。網站新增頁面時，把該頁 URL 加進 `tools/fetch-game.cjs` 才抓得到它的腳本。

## 執行中才組出來的字串（字典沒有整句）

例：寶箱獎勵「Fire Mastery level 3」、協同加成「… per level of A, B and C」、魔法物品名。

- `node tools/soak.cjs [秒數] [速度] [輸出.json]`：用遊戲開發參數 `?god&speed=N` 在測試瀏覽器長時間推進（不碰真實存檔／排行榜），結束時列出 `__d2zhMissing`。改版後跑一次 `300 20`，只剩 DISCORD 才算乾淨。
- `node tools/composed-check.mjs`（在 `npm test` 裡）：把技能名代入已知組合句型，用遊戲翻譯器＋字典翻，翻不出就失敗。找到新句型時加到它的清單，譯法放 `i18n/extra.json`。
- **加寬鬆模板前先做全字典回歸**（每個 key 代入值、比較加入前後的譯文）：曾有 `* level *` 讓「… per level of …」變成半中半英。

## 網站頁殘留掃描

`node tools/scan-site.cjs [截圖目錄]` 逐一點排行榜分頁、展開紀錄、進玩家頁，列出畫面上的韓文與沒翻的英文（玩家名稱、品牌名會混進來）。排行榜頁也載入遊戲的翻譯器與 ui，所以 import map 在所有頁面都要插，不只 `/play/`（曾因此日期顯示韓文）。

## 譯文品質

- **語境誤譯**（例：Report 譯成「舉報」）：`node tools/ui-candidates.mjs <官方字串表目錄> i18n/review` 篩出短介面字串（排除官方譯名與稀有物品名，附韓文版當語境），逐批找問題並對抗驗證；採用的修正寫成 JSON 用 `node tools/apply-fixes.mjs <檔>` 套用（逐條機械檢查）。驗證者的「統一術語」主張要對照官方字串表：曾有 Aura→光環、Stamina→耐力 被驗證通過，但官方是靈氣、精力，方向相反。
- **官方用語對照**：`node tools/audit-official.mjs <官方字串表目錄>` 列出「和 D2R 官方同一句英文（%d→# 模板）但譯文不同」的條目。單字型差異多半是語境不同（Gold＝金幣而非詞綴「黃金」）；句子型（物品詞條）照官方改，例外見 STYLE.md 的「刻意偏離官方」。
- **術語一致**：`node tools/audit-terms.mjs` 列出句子裡沒用術語表譯名的地方（Diablo II→暗黑破壞神 II 這類是誤報）；非官方人名用 `tools/fix-names.mjs` 的對照表統一。
