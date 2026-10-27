# 協作指南

歡迎一起改進 D2 Survivors 繁中化！最有幫助的是**回報與修正翻譯**，不會寫程式也能參與。

## 回報問題

- 翻譯漏翻、錯譯、用語不一致：用 [翻譯問題](https://github.com/keoy7am/D2Survivors-zhtw/issues/new?template=translation.yml) 範本。擴充圖示的「回報翻譯問題」按鈕會直接打開它並帶入版本。
- 黑屏、紅色 !、中文變成 `?` 等擴充錯誤：用 [擴充錯誤](https://github.com/keoy7am/D2Survivors-zhtw/issues/new?template=bug.yml) 範本。
- 回報前先確認用的是 [最新版](https://github.com/keoy7am/D2Survivors-zhtw/releases)，並搜尋有沒有人回報過。
- 遊戲玩法、平衡、存檔問題請找遊戲作者，本專案只負責中文化。

## 修改譯文（Pull Request）

1. Fork 後開一個分支。
2. 只改**譯文來源**，不要手改產生物：

   | 要改的 | 檔案 |
   |---|---|
   | 遊戲內文字 | `i18n/zh-TW.json`（英文原句 → 繁中） |
   | 網站、排行榜文字 | `i18n/site.json` |
   | 韓文字典沒有、但遊戲會顯示的字串 | `i18n/extra.json` |
   | 術語 | `i18n/glossary.json` |

   `extension/zh-TW.js`、`rules.json`、`meta.json`、`site-dict.js` 由建置產生，改了也會被覆蓋。
3. 遵守 [`i18n/STYLE.md`](i18n/STYLE.md)，重點：
   - 物品、技能、怪物、地名以《暗黑破壞神 II：獄火重生》台灣官方譯名為準（Aura＝靈氣、Stamina＝精力、Act＝章）。覺得官方譯名不順，請先開 issue 討論，不要直接改。
   - 佔位符：key 裡的 `#`／`*` 在譯文寫成 `{0}`、`{1}`…，每個編號都要出現且只出現一次；` · ` 分隔符個數不變。
   - 台灣用語、全形標點；不加譯註、括號說明。
   - 同一個詞改譯名時，整份字典一起改，不要只改一句。
4. 跑檢查並重新建置（需要 Node.js 22+）：

   ```sh
   npm test          # 譯文規則、補丁、字典解析
   npm run build     # 產生 extension/ 的字典，印出覆蓋率
   ```

   把建置產生的 `extension/` 變更一起提交。改到 `extension/` 的程式時，再跑 `npm run e2e`（需先 `npm install` 與 `npx playwright install chromium`）。
5. 用 `chrome://extensions` 載入 `extension/` 資料夾，到遊戲裡看一眼改過的地方：中文正常、沒有 `?`、沒有超出框。
6. 開 PR，說明改了什麼、為什麼；有官方來源或截圖請附上。

## 規範

- **commit 訊息**寫「改了什麼、為什麼」，不寫工作過程。英文或中文皆可。
- **一個 PR 一件事**：譯名統一、單句修正、程式修改分開提交，比較好審。
- **版本號與發佈由維護者決定**：PR 不要改 `extension/manifest.json` 的 `version`，維護者合併時會調整（同一個版本號不會有兩份內容）。PR 上 `npm test` 的版本檢查若失敗，是正常現象，交給維護者處理。
- **不提交遊戲作者的程式或素材**：`game/` 是本機抓下來分析用的，已被 gitignore。擴充只在使用者瀏覽器裡修補，不散布作者的程式碼。
- 改擴充程式（`extension/*.js`）前先讀 [`CLAUDE.md`](CLAUDE.md) 的「運作原理」，裡面記錄了踩過的坑（例如不能把 DNR 改回轉向 `data:`）。
- 對人友善、對事具體。回報與討論都歡迎，不接受人身攻擊。

## 遊戲改版時

遊戲改版後的更新流程（抓新版、補翻新字串、驗證）見 [`CLAUDE.md`](CLAUDE.md) 的「遊戲改版時的 SOP」。新字串的翻譯 PR 也很歡迎。
