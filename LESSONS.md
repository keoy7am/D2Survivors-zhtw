# LESSONS

2026-10-26 | 試跑 `tools/release.mjs` 時帶了腳本不支援的 `--dry`，腳本忽略它並真的建了 tag、推到 GitHub（推送後才因 `stdio: 'inherit'` 回傳 null 而崩潰，所以沒建 Release） | 腳本改成拒絕任何未知參數、正式支援 `--dry-run`、遠端已有同名 tag 也擋；誤建的 tag 立即從遠端與本機刪除 | `node tools/release.mjs 0.1.0 x --dry` exit 1；`--dry-run` 走完檢查後 `git ls-remote --tags origin` 為空
