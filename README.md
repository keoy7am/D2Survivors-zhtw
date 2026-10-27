# D2 Survivors 繁體中文

非官方 Chrome 擴充：把 [D2 Survivors](https://d2survivors.lol)（以暗黑破壞神 II 為題材的網頁 survivors-like 遊戲）翻成繁體中文。

- 遊戲內文字全面中文化：選單、技能、升級卡片、物品、怪物、說明。物品、技能、怪物、地名採用《暗黑破壞神 II：獄火重生》台灣官方譯名。
- 網站首頁、排行榜、選單也一併中文化。
- 網站右上角的 **EN／繁中** 按鈕可隨時切換原文與中文。
- 遊戲改版時會自動適應：翻譯照常運作，新增的字串先顯示英文。
- 擴充圖示顯示翻譯覆蓋率，可匯出漏翻清單。

與遊戲作者 framara 及 Blizzard Entertainment 無關。

## 安裝（玩家）

從 [Releases](../../releases) 下載 `d2survivors-zhtw-<版本>.zip`，解壓後依資料夾裡的「安裝說明.html」操作：

1. Chrome 網址列輸入 `chrome://extensions`，打開「開發人員模式」。
2. 按「載入未封裝項目」，選解壓出來的 `d2survivors-zhtw` 資料夾。
3. 打開 https://d2survivors.lol/play/

只支援瀏覽器版（Chrome、Edge），桌面版 exe 用不到。

## 回報問題

按擴充圖示的「回報翻譯問題」，會打開 GitHub 的回報表單並帶入擴充與遊戲版本。也可以直接到 [Issues](https://github.com/keoy7am/D2Survivors-zhtw/issues/new/choose) 選範本：

- **翻譯問題**：漏翻、錯譯、用語不一致。大量漏翻請附上擴充圖示「匯出漏翻清單」的檔案。
- **擴充錯誤**：黑屏、紅色 !、中文變成 `?`、卡住。

## 協作

歡迎修正譯文或改進擴充，請先讀 [協作指南](CONTRIBUTING.md)（譯文來源、翻譯規範、檢查步驟、PR 規則）。

## 運作方式

遊戲本身內建翻譯引擎（以英文原句為 key 的韓文字典），並把文字畫在 canvas 上。擴充：

1. 把遊戲的韓文字典換成繁中字典（`extension/zh-TW.js`）。
2. 在瀏覽器裡對遊戲當下版本的 `ui-*.js` 打補丁，讓中文能畫在 canvas 上、能在中文字之間換行（`extension/patch-ui.js`），再用 import map 換上。
3. 網站層文字照網站顯示的韓文原文換成繁中。

細節與維護須知見 [`CLAUDE.md`](CLAUDE.md)。

## 開發

需要 Node.js 22+。

```sh
npm install            # 安裝 Playwright（e2e 用）
npx playwright install chromium

npm test               # 單元檢查：譯文規則、補丁、字典解析
npm run build          # 由 i18n/ 產生 extension/ 的字典與規則，印出覆蓋率
npm run e2e            # 在 Chromium 載入擴充，對正式站跑端到端測試
npm run pack           # 打包 dist/d2survivors-zhtw-<版本>.zip
```

### 遊戲改版時

```sh
npm run update         # 抓新版 → 檢查補丁 → 官方譯名預填 → 建置 → 切出待翻批次 → e2e
```

待翻的字串會切成 `i18n/todo/` 下的批次，翻好放進 `i18n/done/`，再 `npm run merge`。完整流程見 `CLAUDE.md` 的「遊戲改版時的 SOP」。

### 目錄

| 路徑 | 內容 |
|---|---|
| `extension/` | 擴充本體（直接以「載入未封裝項目」使用） |
| `i18n/zh-TW.json` | 遊戲字典譯文（英文原句 → 繁中），唯一的譯文來源 |
| `i18n/site.json` | 網站層譯文（英文原句 → 繁中） |
| `i18n/glossary.json`、`i18n/STYLE.md` | 術語表與翻譯規範 |
| `tools/` | 抓取、建置、驗證、打包、發佈腳本 |
| `docs/install.html` | 給玩家的安裝說明（打包進 zip） |

## 授權與聲明

Diablo®、Diablo II® 與 Blizzard Entertainment® 是 Blizzard Entertainment, Inc. 的商標。D2 Survivors 由 framara 製作。本擴充不包含遊戲作者的程式碼，只在使用者的瀏覽器裡修補。
