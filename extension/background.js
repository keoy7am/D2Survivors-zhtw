// 執行期補丁＋覆蓋率。
// - 遊戲載入哪一版 ui-<hash>.js，就抓那一版原檔打中文渲染補丁（patch-ui.js），
//   用動態規則把那個精確檔名轉向成 data: 網址。遊戲改版後自動重打，翻譯照常運作；
//   新字串不在字典裡，遊戲引擎本來就會顯示原文。
// - 只有補丁打不上（作者改了渲染器結構）才 disabled：停用字典規則、切回英文，
//   不然中文會被畫成「?」。
// - ko-<hash>.js 換版只影響覆蓋率（字典規則不綁檔名）。
import zh from './zh-TW.js';
import { dictKeys } from './dict-keys.js';
import { patchUi } from './patch-ui.js';

const ORIGIN = 'https://d2survivors.lol/assets/';
const UI_RULE = 100;
const meta = fetch(chrome.runtime.getURL('meta.json')).then((r) => r.json());
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} 回 ${r.status}`);
  return r.text();
}

// 確保「這一版 ui」有補丁規則；回傳是否成功
async function ensurePatched(uiName) {
  const { patchedUi } = await chrome.storage.local.get('patchedUi');
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  if (patchedUi === uiName && rules.some((r) => r.id === UI_RULE)) return true;
  try {
    const code = patchUi(await fetchText(ORIGIN + uiName), uiName);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [UI_RULE],
      addRules: [{
        id: UI_RULE, priority: 2,
        action: { type: 'redirect', redirect: { url: 'data:text/javascript;charset=utf-8,' + encodeURIComponent(code) } },
        condition: { regexFilter: `^${esc(ORIGIN + uiName)}$`, resourceTypes: ['script'] },
      }],
    });
    // content.js 看到 patchedUi 變了會重新整理遊戲頁（觸發這次補丁的那一頁還是舊的 ui）
    await chrome.storage.local.set({ patchedUi: uiName, patchError: null });
    return true;
  } catch (e) {
    console.warn('ui 補丁失敗', e);
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [UI_RULE] });
    await chrome.storage.local.set({ patchedUi: null, patchError: `${uiName}：${e.message ?? e}` });
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
  const s = await chrome.storage.local.get(['seenUi', 'seenKo', 'off', 'cov']);
  const disabled = !(await ensurePatched(s.seenUi ?? m.ui));
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
