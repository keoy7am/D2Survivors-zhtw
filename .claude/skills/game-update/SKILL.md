---
name: game-update
description: D2 Survivors 遊戲改版後更新繁中擴充：抓新版、重打渲染補丁、翻譯新增字串、驗證、打包、推送。觸發：使用者說「遊戲更新了」「擴充出現紅色驚嘆號」「更新翻譯」「game update」，或輸入 /game-update。
---

照專案根目錄 `CLAUDE.md` 的「遊戲改版時的 SOP」逐步做，每步的完成判準：

1. `npm run update` exit 0（失敗依 SOP 對應段落修，修完重跑）。
2. 記下 split 輸出的未翻條數；0 條就跳到第 4 步。
3. 對 `i18n/todo/` 每一批平行派 subagent（`model: sonnet`），每批 `node tools/verify-batch.mjs <批名>` 必須通過。subagent 回報完成不算數，由主迴圈跑 verify 確認。
4. `npm run merge` exit 0、`npm run build` 覆蓋率不低於改版前、`npm run e2e` 全部 PASS。
5. `node tools/smoke.cjs https://d2survivors.lol/play/ <截圖>` 並親眼看截圖：中文正常、沒有 `?`。
6. `manifest.json` version +1、`npm run pack`、commit、push。

回報使用者：新版檔名、新增／已翻條數、覆蓋率、zip 路徑。需要使用者拍板的（例如補丁改不動、要不要改譯名）用 AskUserQuestion 問。
