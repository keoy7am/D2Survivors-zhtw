// 執行期補丁＋覆蓋率。
// - 遊戲載入哪一版 ui-<hash>.js，就抓那一版原檔打中文渲染補丁（patch-ui.js），
//   補丁碼存進 storage，content.js 用 import map 換上。遊戲改版後自動重打，翻譯照常運作；
//   新字串不在字典裡，遊戲引擎本來就會顯示原文。
// - 只有補丁打不上（作者改了渲染器結構）才 disabled：停用字典規則、切回英文，
//   不然中文會被畫成「?」。
// - ko-<hash>.js 換版只影響覆蓋率（字典規則不綁檔名）。
import zh from './zh-TW.js';
import { dictKeys } from './dict-keys.js';
import { patchUi } from './patch-ui.js';

const ORIGIN = 'https://d2survivors.lol/assets/';
const OLD_UI_RULE = 100;
const meta = fetch(chrome.runtime.getURL('meta.json')).then((r) => r.json());

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} 回 ${r.status}`);
  return r.text();
}

// 確保「這一版 ui」的補丁碼在 storage 裡（content.js 用 import map 換上它）；回傳是否成功
async function ensurePatched(uiName) {
  const { patchedUi, patchedCode } = await chrome.storage.local.get(['patchedUi', 'patchedCode']);
  if (patchedUi === uiName && patchedCode) return true;
  try {
    const code = patchUi(await fetchText(ORIGIN + uiName), uiName);
    // 同一次 set：content.js 收到一個變更事件、重新整理一次
    await chrome.storage.local.set({ patchedUi: uiName, patchedCode: code, patchError: null });
    return true;
  } catch (e) {
    console.warn('ui 補丁失敗', e);
    await chrome.storage.local.set({ patchedUi: null, patchedCode: null, patchError: `${uiName}：${e.message ?? e}` });
    return false;
  }
}

async function coverage(koName) {
  const keys = dictKeys(await fetchText(ORIGIN + koName));
  const missing = keys.filter((k) => !zh[k]);
  return { koName, total: keys.length, covered: keys.length - missing.length, missing };
}

let running = Promise.resolve();
const refresh = () => (running = running.then(refreshNow, refreshNow)); // 串行，避免兩次補丁互踩

async function refreshNow() {
  const m = await meta;
  // 舊版擴充用 DNR 把 ui 轉向 data:，正式版 Chrome 會回 503 讓遊戲卡死；升級上來的要清掉
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [OLD_UI_RULE] });
  const s = await chrome.storage.local.get(['seenUi', 'seenKo', 'off', 'cov']);
  // 還沒看過遊戲載入哪一版時（剛安裝），先對建置時的版本預打；失敗不算 disabled——
  // 遊戲可能已經換版，等真的看到版本再判斷，不要讓剛裝好的人看到紅色「!」
  const ok = await ensurePatched(s.seenUi ?? m.ui);
  const disabled = !ok && !!s.seenUi;
  await chrome.declarativeNetRequest.updateEnabledRulesets(!disabled && !s.off ? { enableRulesetIds: ['zh'] } : { disableRulesetIds: ['zh'] });
  await chrome.storage.local.set({ disabled });
  let cov = s.cov;
  const koName = s.seenKo ?? m.ko;
  if (cov?.koName !== koName) {
    try {
      const { missing, ...c } = await coverage(koName);
      cov = c;
      await chrome.storage.local.set({ cov });
    } catch (e) {
      console.warn('覆蓋率計算失敗', e);
    }
  }
  const pct = cov ? Math.floor((cov.covered / cov.total) * 100) : null;
  await chrome.action.setBadgeBackgroundColor({ color: disabled ? '#c62828' : s.off ? '#757575' : '#2e7d32' });
  await chrome.action.setBadgeText({ text: disabled ? '!' : s.off ? 'off' : pct === null ? '' : `${pct}` });
}

chrome.webRequest.onBeforeRequest.addListener(
  (d) => {
    const name = d.url.slice(ORIGIN.length);
    const key = name.startsWith('ui-') ? 'seenUi' : 'seenKo';
    chrome.storage.local.get(key).then((s) => {
      if (s[key] !== name) chrome.storage.local.set({ [key]: name }).then(refresh);
    });
  },
  { urls: [`${ORIGIN}ui-*.js`, `${ORIGIN}ko-*.js`] },
);

chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);
chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && 'off' in c) refresh(); });

// popup 要匯出漏翻清單
chrome.runtime.onMessage.addListener((msg, _, reply) => {
  if (msg !== 'missing') return;
  (async () => {
    const m = await meta;
    const { seenKo } = await chrome.storage.local.get('seenKo');
    reply(await coverage(seenKo ?? m.ko));
  })().catch((e) => reply({ error: String(e) }));
  return true;
});
