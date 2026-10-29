---
name: release
description: 發佈 D2 Survivors 繁中擴充：打 tag、建 GitHub Release、附 zip 與改版內容。觸發：使用者說「發佈」「發布」「release」「出版」，或輸入 /release。
---

owner 2026-10-27 授權：**修好、驗證完就直接發佈**（建 tag、推送、建 GitHub Release），不必等 owner 說「發佈」或先實測。

1. **版本號**：使用者訊息裡有版本號就用它；否則用 manifest 目前的 version——改 `extension/` 時就已照慣例 **patch 遞增**調好（`check-version.mjs` 要求擴充一改就換號）。agent 自己定，不用問；minor／major 只在 owner 提時用。
2. **發佈前檢查**（任一失敗就停下來修，不發佈）：`npm test`、`npm run build`（記下覆蓋率）、`npm run e2e` 全部 PASS；`npm run pack` 後把 zip 解壓、`EXT=<解壓資料夾>/d2survivors-zhtw node tools/e2e.cjs` 也全過；`node tools/smoke.cjs` 截圖親眼看過（中文正常、沒有 `?`）。有未提交的變更先 commit、push。
   owner 不再先實測，但 e2e 用的 Chromium 和正式版 Chrome 行為可能不同（曾經 e2e 全綠、正式版黑屏）：動到載入／渲染機制（import map、DNR、main-world 時序、補丁）時，發佈後的回報要明講，請 owner 優先實機確認。
3. **撰寫改版內容**：寫到 scratchpad 的 `release-notes.md`。讀者是安裝擴充的玩家，不是開發者。素材：`git log <上一個 tag>..HEAD`（沒有 tag 就看全部）、`extension/meta.json`（覆蓋率、對應遊戲版本）。格式：

   ```
   ## 這一版的改變
   - （玩家看得到的變化，一行一項；沒有就省略這段）

   ## 修正
   - （有才寫）

   ## 翻譯狀態
   - 覆蓋率 X%（N / M 條），對應遊戲版本 <ui 檔名>

   ## 安裝／更新
   下載下方的 `d2survivors-zhtw-<版本>.zip`，解壓後依資料夾裡的「安裝說明.html」操作；更新時覆蓋舊資料夾，到 chrome://extensions 按「重新載入」，已開著的遊戲頁再重新整理（F5）。
   ```
   不寫內部工具、重構、測試等玩家無感的變更。第一版（沒有上一個 tag）改成「## 首次發佈」並簡介功能。
4. 先 `node tools/release.mjs --dry-run <版本> <release-notes.md 路徑>`（只檢查＋打包），通過後再去掉 `--dry-run` 正式跑：改 manifest version、打包（zip 內不得有 .md）、commit、tag、push、建 Release。第 2 步的檢查沒全過時，只能跑 `--dry-run`。
   - 若最後 `gh release create` 失敗（網路、權限），tag 已經推上去了，重跑腳本會被「tag 已存在」擋下。手動補建：`gh release create v<版本> dist/d2survivors-zhtw-<版本>.zip --title "D2 Survivors 繁中 v<版本>" --notes-file <release-notes.md>`。
5. 回報使用者：Release 網址、zip 檔名、覆蓋率。repo 是 public，Release 頁可以直接給朋友。
