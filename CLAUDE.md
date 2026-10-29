# D2 Survivors 繁中擴充 — Agent 手冊

非官方 Chrome 擴充（MV3），把 https://d2survivors.lol 的遊戲翻成繁體中文。作者閉源；我們不改他的站，只在瀏覽器端轉向與修補檔案。程式結構自己讀 `extension/`，這裡只寫讀程式看不出來的事。

## 改程式前要知道的坑

- **遊戲翻譯引擎**（`translate-*.js`）在 `d2s:lang=ko` 時載入 `ko-<hash>.js` 字典（`{英文原句: 譯文}`，不分大小寫；`#`＝數字、`*`＝任意片段，譯文用 `{0}{1}…`）。擴充用 `rules.json` 把 `ko-*.js` 轉向 `extension/zh-TW.js`。
- **中文字會畫成 `?`**：遊戲用 D2 點陣字畫 canvas，原版只有諺文走 `fillText`。所以 `background.js` 執行期替遊戲載入的 `ui-<hash>.js` 打補丁（`extension/patch-ui.js` 的 `PATCHERS`），存進 `chrome.storage.local`，改版後自動重打。
- **每個補丁 regex 必須恰好命中一次。** 對遊戲實際載入過的版本打不上才 `disabled=true`：停用字典規則、切回英文、badge 紅色 `!`、popup 顯示 `patchError`；剛安裝、還沒看過版本時預打失敗不算。不這樣做，中文會整片畫成 `?`。這是唯一需要改程式的改版情況，其他改版只需補翻新字串。
- **translate 補丁只補最外層查詢**（拆「名稱 (快捷鍵)」、「A. B」分段、韓文日期、魔法物品名、`*` 與 `#` 並存的模板）：深層遞迴是原引擎在試模板，提早給半套結果會搶掉更好的拆法（曾讓地區標題變成「第 I: … 章」）。查不到的字串記在頁面 `globalThis.__d2zhMissing`，popup「匯出漏翻清單」會帶上。
- **不要改回 DNR 轉向 `data:`**：正式版 Chrome 156 對被轉向到 `data:` 的 script 回 503，遊戲黑屏，而 Playwright 的 Chromium 141／151 卻正常，e2e 抓不到。改用 import map 把 `ui-<hash>.js` 對應到補丁版的 `blob:` 網址，而且 import map 必須在 MAIN world 插（isolated world 插的 inline script 會被擴充 CSP 擋），所有頁面都要插（排行榜頁也載入翻譯器，曾因此日期顯示韓文）。**e2e 全綠不等於正式版 Chrome 能用，發佈前要 owner 實測。**
- **網站層文字照韓文原文換成繁中**：`site-dict.js` 的 `D2ZH_SITE_KO` 由 build 從網站腳本的 `{en:{…},ko:{…}}` 配對產生；`i18n/site.json` 以英文為 key，不同物件有同名 key 代表不同句子，所以不能用 key 對照。換過的元素標 `data-no-translate`，否則和遊戲自己的 DOM 翻譯器互相改寫，整個分頁卡死（曾發生）。
- **語言開關就是網站的 EN／繁中按鈕**（`d2s:lang` en／ko），不替使用者改選擇。只有第一次安裝預設繁中、遊戲頁還沒有補丁碼時暫時退回 en（`d2zh:pendingKo`，補丁碼到了由 content.js 還原）。
- **更新擴充不會重新載入已開的分頁**：舊頁面沒有接收端、字典也是舊的。popup 用 content.js 回應的 `ping`（擴充版本）判斷，請玩家 F5。
- **popup「回報翻譯問題」以 query 預填 `.github/ISSUE_TEMPLATE/translation.yml` 的欄位 id**（`ext-version`、`game-version`）：改範本欄位 id 要同步改 popup.js。
- **效能設定**（popup → storage `perf` → content.js 同步成 `d2zh:perf` 並重新整理）：
  - `res`、`nolights`、`noshadows` 是遊戲作者內建的網址參數，main-world.js 在 `/play/` 的 document_start 補上、`#stage canvas` 出現時還原網址：排行榜紀錄會帶 `location.search`。只在 `d2s:files` 已設定時加（網址有參數會跳過第一次造訪的 setup 轉向；e2e／bench 要自己設 `hosted`）。加參數時把前後網址記在 sessionStorage `d2zh:perfUrl`，下次載入正好是加過參數的樣子就先還原，否則參數會黏在網址上。
  - `fps` 上限不是遊戲原生（包裝 `requestAnimationFrame`），UI 與說明要標明。遊戲邏輯用 ticker 的 `deltaMS`、排行榜 `pace` 用遊戲時間，所以速度與紀錄不變；遊戲改版後要重查。
  - 1.3.0 的 `perf: true` 由 content.js／popup 直接當成原生設定，不在 background 遷移：重開瀏覽器時未封裝擴充可能還在跑舊 worker。
  - e2e 量更新頻率前要把遊戲頁切回前景，背景分頁的 rAF 會被壓到每秒 1～2 次。
- **新版偵測**：打開遊戲或瀏覽器啟動時，12 小時內最多查一次 GitHub `releases/latest`；有新版 badge 藍色 `NEW`，優先序低於紅色 `!` 與 off。

## 檔案

- `i18n/zh-TW.json` 是唯一的譯文來源（英文 key → 繁中）。`i18n/extra.json`：遊戲會顯示、但韓文字典沒有的字串。`i18n/site.json`：網站層。`i18n/glossary.json`：術語表。`i18n/STYLE.md`：翻譯規範。
- `extension/zh-TW.js`、`rules.json`、`meta.json`、`site-dict.js` 由 `npm run build` 產生，要進 git（朋友直接拿 `extension/` 用）。擴充不內附作者的程式碼，ui 補丁在使用者瀏覽器裡現打。
- `i18n/todo/`、`i18n/done/`、`game/`、`dist/` 是產生物，不進 git。

## 流程

- 遊戲改版、補翻、翻譯品質審查：`/game-update` skill（細節與工具在它的 `reference.md`）。
- 發佈：`/release` skill。owner 已授權修好、驗證完就直接建 tag、推送、建 GitHub Release。發佈檔不得含 `.md`（pack 會擋）。
- 版本號：`extension/` 一改就 patch 遞增 `manifest.json`；同一個版號不能有兩份內容（`tools/check-version.mjs` 會擋）。

## 慣例

- 用 `npm run …`，不用全域 playwright。測試腳本會開 headless Chromium 連正式站。
- commit 訊息：Conventional Commits、繁體中文（例 `fix(i18n): 補上符文之語的名稱翻譯`），寫做了什麼和為什麼。
- 臨時腳本放 `tmp/`（已 gitignore），`tools/` 只放長期工具。
