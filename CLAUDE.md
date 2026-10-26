# D2 Survivors 繁中擴充 — Agent 手冊

非官方 Chrome 擴充（MV3），把 https://d2survivors.lol 的遊戲翻成繁體中文。作者閉源，我們不改他的站，只在瀏覽器端轉向兩個檔案。

## 運作原理（改東西前先懂這段）
- 遊戲內建翻譯引擎（`translate-*.js`）：`d2s:lang=ko` 時載入 `ko-<hash>.js` 字典（`{英文原句: 譯文}`，比對不分大小寫；`#`＝數字、`*`＝任意片段，譯文用 `{0}{1}…`）。
- 遊戲文字畫在 canvas 上，用 D2 點陣字；原版只有諺文走 `fillText`，其他 >255 的字元畫成 `?`。
- 擴充做三件事：
  1. `rules.json`（靜態）：`ko-*.js`（不綁檔名）→ `extension/zh-TW.js`。新版遊戲的新字串不在字典裡，引擎自己顯示原文。
  2. `background.js` **執行期**補丁：看到遊戲載入哪個 `ui-<hash>.js`，就抓那一版原檔，用 `extension/patch-ui.js` 打補丁（CJK 也走 `fillText`、中文字之間可斷行、字型後備加系統繁中字型、相對 import 改絕對網址），以動態規則把那個精確檔名轉向成 `data:` 網址。改版後自動重打，content.js 會在補丁備妥時重新整理遊戲頁一次。
  3. `content.js`：遊戲頁設 `d2s:lang=ko`、其他頁設 `en`；網站層 `[data-t]` 文字用 `i18n/site.json` 換。
- 每個補丁 regex 必須恰好命中一次。對「遊戲實際載入過的版本」打不上（作者改了渲染器結構）才 `disabled=true`；剛安裝、還沒看過版本時預打失敗不算：停用字典規則、切回英文、badge 紅色 `!`、popup 顯示 `patchError`。不這樣做，中文會整片畫成 `?`。**這是唯一需要改程式的改版情況**；其他改版只需要補翻新字串。

## 檔案
- `i18n/zh-TW.json`：**唯一的譯文來源**（英文 key → 繁中）。`i18n/site.json`：網站層。`i18n/glossary.json`：術語表。`i18n/STYLE.md`：翻譯規範。
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

網站層文字（`i18n/site.json`）：`node tools/site-keys.mjs game/*.js` 列出缺的 key，補翻後重建。

譯文品質：`node tools/audit-terms.mjs` 列出句子裡沒用術語表譯名的地方（Diablo II→暗黑破壞神 II 這類是誤報）；非官方人名用 `tools/fix-names.mjs` 的對照表統一。

## 發佈（使用者說「發佈」時；`/release` skill）
- 使用者說「發佈」就是授權建 tag、推送、建 GitHub Release，照 `.claude/skills/release/SKILL.md` 做：測試全過 → 撰寫玩家看得懂的改版內容 → `node tools/release.mjs <版本> <改版內容檔>`。
- 發佈檔（`npm run pack`）：`d2survivors-zhtw/` 資料夾＝擴充檔案＋`安裝說明.html`（來源 `docs/install.html`）。**不得含 `.md`**，pack 會擋。zip 由 Node 自己寫（UTF-8 檔名、斜線路徑），不用系統壓縮工具。
- 驗證發佈檔：解壓後 `EXT=<解壓資料夾>/d2survivors-zhtw node tools/e2e.cjs`。

## 慣例
- 用 `npm run …`，不用全域 playwright。測試腳本會開 headless Chromium 連正式站。
- commit 訊息寫做了什麼和為什麼，不寫工作過程。
