# D2 Survivors 繁中擴充 — Agent 手冊

非官方 Chrome 擴充（MV3），把 https://d2survivors.lol 的遊戲翻成繁體中文。作者閉源，我們不改他的站，只在瀏覽器端轉向兩個檔案。

## 運作原理（改東西前先懂這段）
- 遊戲內建翻譯引擎（`translate-*.js`）：`d2s:lang=ko` 時載入 `ko-<hash>.js` 字典（`{英文原句: 譯文}`，比對不分大小寫；`#`＝數字、`*`＝任意片段，譯文用 `{0}{1}…`）。
- 遊戲文字畫在 canvas 上，用 D2 點陣字；原版只有諺文走 `fillText`，其他 >255 的字元畫成 `?`。
- 擴充做三件事：
  1. `rules.json`：`ko-*.js`（不綁檔名）→ `extension/zh-TW.js`；`ui-<hash>.js`（**綁精確檔名**）→ `extension/ui.js`（補丁版）。
  2. `ui.js` 由 `tools/patch-ui.mjs` 產生：CJK 也走 `fillText`、中文字之間可斷行、字型後備加系統繁中字型、相對 import 改絕對網址。每個補丁 regex 必須恰好命中一次，否則建置失敗。
  3. `content.js`：遊戲頁設 `d2s:lang=ko`、其他頁設 `en`；網站層 `[data-t]` 文字用 `i18n/site.json` 換。
- 安全網（`background.js`）：遊戲載入的 `ui-*.js` 不是 `meta.json` 記的那個 → 停用規則、`disabled=true`、content.js 切回英文並重新整理、badge 顯示紅色 `!`。不這樣做，新版遊戲會整片 `?`。

## 檔案
- `i18n/zh-TW.json`：**唯一的譯文來源**（英文 key → 繁中）。`i18n/site.json`：網站層。`i18n/glossary.json`：術語表。`i18n/STYLE.md`：翻譯規範。
- `i18n/todo/`、`i18n/done/`、`game/`、`dist/`：產生物，不進 git。
- `extension/ui.js`、`zh-TW.js`、`rules.json`、`meta.json`、`site-dict.js`：由 `npm run build` 產生，要進 git（朋友直接拿 extension/ 用）。

## 遊戲改版時的 SOP（`/game-update` skill 也是這份）
徵兆：擴充圖示出現紅色 `!`，或 popup 顯示「遊戲已改版」。

1. `npm run update`：抓新版遊戲檔 → 單元檢查 → 建置（打補丁）→ 切出未翻批次 → 端到端測試。
   - **補丁失敗**（`補丁「…」命中 0 次`）：作者改了渲染器。到 `game/ui-*.js` 找 `drawForeign`／`wrapLines`／`charCodeAt(0);return` 附近，對照 `tools/patch-ui.mjs` 的 regex 調整，跑 `node tools/patch-ui.mjs`（斷行自測）再 `npm run build`。
   - **字典解析失敗**：作者換了字典格式，改 `extension/dict-keys.js`，用 `node tools/test-dict-keys.mjs` 對帳。
   - **e2e 失敗**：先看是哪一項；網站掛掉或 Cloudflare 擋 headless 時重跑一次。
2. 看 `npm run split` 的輸出：新增幾條未翻。翻譯批次在 `i18n/todo/`。
3. 翻譯：每批派一個 subagent（`model: sonnet`），提示裡給它 `i18n/STYLE.md`、`i18n/glossary.json` 的路徑與批名，要求寫 `i18n/done/<批名>.json` 並跑 `node tools/verify-batch.mjs <批名>` 到通過。批次互不重疊，可以平行。
4. `npm run merge` → `npm run build`（看覆蓋率）→ `npm run e2e`。
5. 實機看一眼：`node tools/smoke.cjs https://d2survivors.lol/play/ shot.png`，確認畫面是中文、沒有 `?`、沒有溢出。
6. `manifest.json` 的 `version` 加一 → `npm run pack` → commit、push。把 `dist/*.zip` 給朋友（解壓覆蓋舊資料夾，到 `chrome://extensions` 按重新載入）。

網站層文字（`i18n/site.json`）：`node tools/site-keys.mjs game/*.js` 列出缺的 key，補翻後重建。

## 慣例
- 用 `npm run …`，不用全域 playwright。測試腳本會開 headless Chromium 連正式站。
- commit 訊息寫做了什麼和為什麼，不寫工作過程。
