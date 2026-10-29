---
name: game-update
description: D2 Survivors 遊戲改版後更新繁中擴充：抓新版、重打渲染補丁、翻譯新增字串、驗證、發佈。觸發：使用者說「遊戲更新了」「擴充出現紅色驚嘆號」「更新翻譯」「game update」，或輸入 /game-update。
---

徵兆：popup 覆蓋率下降（新字串顯示英文）→ 補翻即可；圖示紅色 `!`（補丁打不上）→ 要改 `extension/patch-ui.js`。各步遇到失敗或要用到翻譯工具時，讀同資料夾的 `reference.md` 對應段落。

1. `npm run fetch`，再 `npm test`。補丁失敗（`補丁「…」命中 0 次`）→ 修 `extension/patch-ui.js`，`node tools/test-patch.mjs` 過了才繼續。這是唯一要改程式的情況。
2. 版本號：`extension/` 會變（幾乎一定），先把 `manifest.json` 的 version **patch 遞增**（`check-version.mjs` 會擋重複版號）。
3. `npm run prefill`、`npm run build`、`npm run split`：記下未翻條數；`node tools/site-keys.mjs game/*.js` 記下網站層缺譯。
4. 翻譯：`i18n/todo/` 每批與網站層缺譯各派 subagent（`model: sonnet`），提示裡要求先 grep `i18n/zh-TW.json`／`glossary.json` 沿用既有譯名、遵守 `i18n/STYLE.md`。主迴圈：每批 `node tools/verify-batch.mjs <批名>` 必須過；兩個 agent 對同一個詞給不同譯名時，查 D2R 官方字串表（`%TEMP%/d2r-strings`，見 prefill-official.mjs）定案並統一。
5. `npm run merge`、`npm run build`：**覆蓋率必須 100%**；`site-keys` 缺 0。
6. `npm test`（含 composed-check 組合句型）、`npm run e2e` 全過；`node tools/smoke.cjs https://d2survivors.lol/play/ <截圖>` 親眼看（中文、沒有 `?`、沒有溢出）；`node tools/soak.cjs 300 20` 漏翻只剩 DISCORD（有新的組合句 → 加模板並做全字典回歸，見 reference.md）。
7. commit、push、`npm run pack`，解壓 zip 跑 `EXT=<資料夾>/d2survivors-zhtw node tools/e2e.cjs` 全過 → 照 `/release` skill 直接發佈（owner 授權：驗證完就發）。

回報使用者：新版檔名、新增／已翻條數、覆蓋率、Release 網址；動到補丁或載入機制時請 owner 實機確認。
