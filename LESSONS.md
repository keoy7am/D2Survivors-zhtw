# LESSONS

2026-10-26 | setup 頁整個分頁卡死（renderer 無回應）：擴充的網站層翻譯和遊戲自己的 DOM 翻譯器（MutationObserver）互相改寫同一批文字，無限迴圈；e2e 只走託管檔案直進遊戲，沒經過 setup 頁 | 換過的元素標 `data-no-translate`（遊戲翻譯器會跳過）；e2e 加「setup 頁 1 秒內 DOM 變動 < 50 次」 | 關掉網站層翻譯的對照組 0 次變動；修後 e2e 0 次
2026-10-26 | owner 按 EN 仍看到中文：擴充每次都把 data-t 文字蓋成中文，忽略網站自己的語言開關 | 網站 EN／한국어 開關就是原文／繁中，只在 d2s:lang=ko 時翻；以韓文原文對照（同名 key 在不同物件代表不同句子） | e2e「按 EN 顯示英文原文」
2026-10-26 | owner 用正式版 Chrome 156 裝擴充後遊戲黑屏：DNR 把 `ui-*.js`（script）轉向 `data:` 網址，Chrome 156 回 503，模組圖載入失敗；Playwright 的 Chromium 141／151 都正常，e2e 全綠沒抓到 | 改用 MAIN world content script 在 document_start 插 import map，把 ui 對應到 blob: 補丁版；isolated world 插 inline script 會被擴充 CSP 擋，所以必須 MAIN world | dbg 腳本 `__d2zhPatched: true`；e2e 141/151 全過；Chrome 156 待 owner 實測
2026-10-26 | 試跑 `tools/release.mjs` 時帶了腳本不支援的 `--dry`，腳本忽略它並真的建了 tag、推到 GitHub（推送後才因 `stdio: 'inherit'` 回傳 null 而崩潰，所以沒建 Release） | 腳本改成拒絕任何未知參數、正式支援 `--dry-run`、遠端已有同名 tag 也擋；誤建的 tag 立即從遠端與本機刪除 | `node tools/release.mjs 0.1.0 x --dry` exit 1；`--dry-run` 走完檢查後 `git ls-remote --tags origin` 為空
