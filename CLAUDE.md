# D2 Survivors 繁中擴充 — Agent 手冊

非官方 Chrome 擴充（MV3），把 https://d2survivors.lol 的遊戲翻成繁體中文。作者閉源，我們不改他的站，只在瀏覽器端轉向兩個檔案。

## 運作原理（改東西前先懂這段）
- 遊戲內建翻譯引擎（`translate-*.js`）：`d2s:lang=ko` 時載入 `ko-<hash>.js` 字典（`{英文原句: 譯文}`，比對不分大小寫；`#`＝數字、`*`＝任意片段，譯文用 `{0}{1}…`）。
- 遊戲文字畫在 canvas 上，用 D2 點陣字；原版只有諺文走 `fillText`，其他 >255 的字元畫成 `?`。
- 擴充做三件事：
  1. `rules.json`（靜態）：`ko-*.js`（不綁檔名）→ `extension/zh-TW.js`。新版遊戲的新字串不在字典裡，引擎自己顯示原文。
  2. `background.js` **執行期**補丁（`extension/patch-ui.js` 的 `PATCHERS`）：看到遊戲載入哪個 `ui-<hash>.js`／`translate-<hash>.js`，就抓那一版原檔打補丁，存進 `chrome.storage.local` 的 `patches`。改版後自動重打。
     - ui：CJK 也走 `fillText`、中文字之間可斷行、字型後備加系統繁中字型、相對 import 改絕對網址。打不上＝disabled。
     - translate（遊戲翻譯器，所有遊戲文字都經過它）：最外層查不到時試「名稱 (快捷鍵)」拆開（迷你面板提示 `Character (C)`）、「A. B」分段（地區標題）；韓文日期轉中文；仍查不到的字串記在頁面 `globalThis.__d2zhMissing`，popup「匯出漏翻清單」會帶上。打不上只略過，不影響翻譯。**補強只放在最外層**：深層遞迴是原引擎在試模板，提早給半套結果會搶掉更好的拆法（曾讓地區標題變成「第 I: … 章」）。
  3. `content.js`（isolated world）：把背景狀態與補丁碼同步到頁面 localStorage（`d2zh:off`、`d2zh:mods`），不同時重新整理遊戲頁一次；轉接 popup 的漏翻查詢給 main-world。網站層文字（選單、首頁、排行榜）照**韓文原文**換成繁中：`site-dict.js` 的 `D2ZH_SITE_KO` 由 build 從網站腳本的 `{en:{…},ko:{…}}` 配對產生（`i18n/site.json` 以英文原文為 key——不同物件有同名 key 代表不同句子，不能用 key 對照）。整句 → 模板（`{0}`）→ 長句子片段 → 句中模板 → 短片段。換過的元素標 `data-no-translate`，否則和遊戲自己的 DOM 翻譯器互相改寫，**整個分頁卡死**（曾發生）。`site.css`：繁中模式顯示英文版 FAQ 段落、繁中字型排在韓文字型前。
  4. `main-world.js`（MAIN world、document_start）：網站的 EN／繁中（原「한국어」）按鈕就是語言開關（`d2s:lang` en／ko），**不替使用者改選擇**；只有第一次安裝預設繁中、遊戲頁沒補丁碼時暫時退回 en（`d2zh:pendingKo`，補丁碼到了由 content.js 還原）。繁中時插 import map 把 `ui-<hash>.js` 對應到補丁版的 `blob:` 網址。
- **不要改回 DNR 轉向 `data:`**：正式版 Chrome 156 對被轉向到 `data:` 的 script 回 503，遊戲黑屏（Playwright 的 Chromium 141／151 卻正常，e2e 抓不到）。import map 也必須在 MAIN world 插，isolated world 插的 inline script 會被擴充 CSP 擋。e2e 全綠不等於正式版 Chrome 能用，發佈前要 owner 實測。
- 每個補丁 regex 必須恰好命中一次。對「遊戲實際載入過的版本」打不上（作者改了渲染器結構）才 `disabled=true`；剛安裝、還沒看過版本時預打失敗不算：停用字典規則、切回英文、badge 紅色 `!`、popup 顯示 `patchError`。不這樣做，中文會整片畫成 `?`。**這是唯一需要改程式的改版情況**；其他改版只需要補翻新字串。

## 檔案
- `i18n/zh-TW.json`：**唯一的譯文來源**（英文 key → 繁中）。`i18n/extra.json`：遊戲會顯示、但韓文字典沒有的字串（多半來自 D2 原版檔案；由 popup 漏翻匯出或 `tools/tour.cjs` 的 `js:[...globalThis.__d2zhMissing]` 找到）。`i18n/site.json`：網站層。`i18n/glossary.json`：術語表。`i18n/STYLE.md`：翻譯規範。
- `i18n/todo/`、`i18n/done/`、`game/`、`dist/`：產生物，不進 git。
- `extension/zh-TW.js`、`rules.json`、`meta.json`、`site-dict.js`：由 `npm run build` 產生，要進 git（朋友直接拿 extension/ 用）。擴充不內附作者的程式碼，ui 補丁都在使用者瀏覽器裡現打。

## 遊戲改版時的 SOP（`/game-update` skill 也是這份）
徵兆：popup 覆蓋率下降（新字串顯示英文）→ 補翻即可；或圖示紅色 `!`（補丁打不上）→ 要改 `patch-ui.js`。

1. `npm run update`：抓新版遊戲檔 → 單元檢查（含補丁對新版打不打得上）→ 官方字串表預填 → 建置 → 切出未翻批次 → 端到端測試。
   - **補丁失敗**（`補丁「…」命中 0 次`）：作者改了渲染器。到 `game/ui-*.js` 找 `drawForeign`／`wrapLines`／`charCodeAt(0);return` 附近，對照 `extension/patch-ui.js` 的 regex 調整，跑 `node tools/test-patch.mjs` 再 `npm run build`。
   - **官方預填**（`tools/prefill-official.mjs`）：D2R 官方字串表（GitHub `Wing924/d2r-wing`）有英／繁中／韓三語；英文相同且韓文與遊戲字典相同就直接取官方繁中。物品、技能、怪物、地名多半由這步解決。
   - **字典解析失敗**：作者換了字典格式，改 `extension/dict-keys.js`，用 `node tools/test-dict-keys.mjs` 對帳。
   - **e2e 失敗**：先看是哪一項；網站掛掉或 Cloudflare 擋 headless 時重跑一次。
2. 看 `npm run split` 的輸出：新增幾條未翻。翻譯批次在 `i18n/todo/`。
3. 翻譯：每批派一個 subagent（`model: sonnet`），提示裡給它 `i18n/STYLE.md`、`i18n/glossary.json` 的路徑與批名，要求寫 `i18n/done/<批名>.json` 並跑 `node tools/verify-batch.mjs <批名>` 到通過。批次互不重疊，可以平行（量大時用 Workflow 的 pipeline：翻譯 → verify 未過再派一次修正）。
4. `npm run merge` → `npm run build`（看覆蓋率）→ `npm run e2e`。
5. 實機看一眼：`node tools/smoke.cjs https://d2survivors.lol/play/ shot.png`，確認畫面是中文、沒有 `?`、沒有溢出。
6. commit、push，回報覆蓋率，等 owner 說「發佈」再走下面的發佈流程。**`manifest.json` 的 `version` 由 owner 決定，agent 不要自行調整。**把 `dist/*.zip` 給朋友（解壓覆蓋舊資料夾，到 `chrome://extensions` 按重新載入）。

網站層文字（`i18n/site.json`，英文原文 → 繁中）：`node tools/site-keys.mjs game/*.js` 列出缺譯的英文句子，補翻後重建；build 也會報「網站層缺譯 N 條」。網站新增頁面時，把該頁 URL 加進 `tools/fetch-game.cjs` 才抓得到它的腳本。

語境誤譯審查（例：Report 譯成「舉報」）：`node tools/ui-candidates.mjs <官方字串表目錄> i18n/review` 篩出短介面字串（排除官方譯名與稀有物品名，附韓文版當語境），逐批找問題＋對抗驗證，採用的修正寫成 JSON 用 `node tools/apply-fixes.mjs <檔>` 套用（逐條機械檢查）。**驗證者的「統一術語」主張要對照官方字串表**：曾有 Aura→光環、Stamina→耐力 被驗證通過，但官方是靈氣、精力，方向相反。

官方用語對照：`node tools/audit-official.mjs <官方字串表目錄>` 列出「和 D2R 官方同一句英文（%d→# 模板）但譯文不同」的條目；單字型差異多半是語境不同（Gold＝金幣而非詞綴「黃金」），句子型（物品詞條）照官方改，例外見 STYLE.md 的「刻意偏離官方」。

網站頁殘留掃描：`node tools/scan-site.cjs [截圖目錄]` 逐一點排行榜分頁、展開紀錄、進玩家頁，列出畫面上的韓文與沒翻的英文（玩家名稱、品牌名會混進來）。**排行榜頁也載入遊戲的翻譯器與 ui**，所以 import map 在所有頁面都要插，不只 `/play/`（曾因此日期顯示韓文）。

譯文品質：`node tools/audit-terms.mjs` 列出句子裡沒用術語表譯名的地方（Diablo II→暗黑破壞神 II 這類是誤報）；非官方人名用 `tools/fix-names.mjs` 的對照表統一。

## 發佈（使用者說「發佈」時；`/release` skill）
- 使用者說「發佈」就是授權建 tag、推送、建 GitHub Release，照 `.claude/skills/release/SKILL.md` 做：測試全過 → 撰寫玩家看得懂的改版內容 → `node tools/release.mjs <版本> <改版內容檔>`。
- 發佈檔（`npm run pack`）：`d2survivors-zhtw/` 資料夾＝擴充檔案＋`安裝說明.html`（來源 `docs/install.html`）。**不得含 `.md`**，pack 會擋。zip 由 Node 自己寫（UTF-8 檔名、斜線路徑），不用系統壓縮工具。
- 驗證發佈檔：解壓後 `EXT=<解壓資料夾>/d2survivors-zhtw node tools/e2e.cjs`。

## 慣例
- 用 `npm run …`，不用全域 playwright。測試腳本會開 headless Chromium 連正式站。
- commit 訊息寫做了什麼和為什麼，不寫工作過程。
