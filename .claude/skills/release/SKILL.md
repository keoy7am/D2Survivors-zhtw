---
name: release
description: 發佈 D2 Survivors 繁中擴充：打 tag、建 GitHub Release、附 zip 與改版內容。觸發：使用者說「發佈」「發布」「release」「出版」，或輸入 /release。
---

使用者說「發佈」就是授權：建 tag、推送、建 GitHub Release，不必再確認。

1. **版本號**：使用者訊息裡有版本號就用它；沒有就看 `extension/manifest.json` 目前的 version 與最新 tag（`git tag -l 'v*' --sort=-v:refname | head -1`）：
   - 目前 version 還沒有對應的 tag → 用目前的 version。
   - 已經有 tag → 用 AskUserQuestion 問版本號，建議值放第一個。
   版本號由 owner 決定，不要自己跳號。
2. **發佈前檢查**（任一失敗就停下來回報）：`npm test`、`npm run build`（記下覆蓋率）、`npm run e2e` 全部 PASS。有未提交的譯文或程式變更先 commit、push。
3. **撰寫改版內容**：寫到 scratchpad 的 `release-notes.md`。讀者是安裝擴充的玩家，不是開發者。素材：`git log <上一個 tag>..HEAD`（沒有 tag 就看全部）、`extension/meta.json`（覆蓋率、對應遊戲版本）。格式：

   ```
   ## 這一版的改變
   - （玩家看得到的變化，一行一項；沒有就省略這段）

   ## 修正
   - （有才寫）

   ## 翻譯狀態
   - 覆蓋率 X%（N / M 條），對應遊戲版本 <ui 檔名>

   ## 安裝／更新
   下載下方的 `d2survivors-zhtw-<版本>.zip`，解壓後依資料夾裡的「安裝說明.html」操作；更新時覆蓋舊資料夾，到 chrome://extensions 按「重新載入」。
   ```
   不寫內部工具、重構、測試等玩家無感的變更。第一版（沒有上一個 tag）改成「## 首次發佈」並簡介功能。
4. 先 `node tools/release.mjs --dry-run <版本> <release-notes.md 路徑>`（只檢查＋打包），通過後再去掉 `--dry-run` 正式跑：改 manifest version、打包（zip 內不得有 .md）、commit、tag、push、建 Release。**使用者沒說「發佈」時，只能跑 `--dry-run`。**
5. 回報使用者：Release 網址、zip 檔名、覆蓋率。
