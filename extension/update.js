// 新版偵測：手動載入的擴充不會自動更新，所以去 GitHub Releases 看有沒有新版，只提醒、不自動安裝。
// 最多 12 小時查一次（未登入的 GitHub API 每個 IP 每小時 60 次），失敗也記時間，不會一直重試。
// GitHub API 回 Access-Control-Allow-Origin: *，不需要額外的網站權限。只送一般 GET，不帶任何使用者資料。
export const RELEASES = 'https://github.com/keoy7am/D2Survivors-zhtw/releases';
const LATEST = 'https://api.github.com/repos/keoy7am/D2Survivors-zhtw/releases/latest';
const EVERY = 12 * 60 * 60 * 1000;

// '1.10.0' > '1.9.2'；前面的 v 與非數字後綴忽略
export function isNewer(latest, current) {
  const parse = (v) => String(v).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const [a, b] = [parse(latest), parse(current)];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

export async function checkUpdate(now = Date.now()) {
  const { update } = await chrome.storage.local.get('update');
  if (update && now - update.checkedAt < EVERY) return;
  const next = { ...update, checkedAt: now };
  try {
    const r = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`GitHub 回 ${r.status}`);
    const { tag_name, html_url } = await r.json();
    next.latest = String(tag_name).replace(/^v/, '');
    next.url = String(html_url).startsWith(RELEASES + '/') ? html_url : RELEASES; // 只開本 repo 的 Releases 頁
  } catch (e) {
    console.warn('新版檢查失敗', e);
  }
  await chrome.storage.local.set({ update: next });
}
