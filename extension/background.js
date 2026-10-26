// 改版安全網＋覆蓋率。
// - 遊戲載入的 ui-<hash>.js 若不是本擴充打補丁的那一版：中文會被畫成「?」，
//   所以停用轉向規則、標記 disabled（content.js 會切回英文並重新整理）。
// - ko-<hash>.js 換版不影響渲染（字典轉向規則不綁檔名），只重算覆蓋率。
import zh from './zh-TW.js';
import { dictKeys } from './dict-keys.js';

const ORIGIN = 'https://d2survivors.lol/assets/';
const meta = fetch(chrome.runtime.getURL('meta.json')).then((r) => r.json());

async function coverage(koName) {
  const src = await (await fetch(ORIGIN + koName)).text();
  const keys = dictKeys(src);
  const missing = keys.filter((k) => !zh[k]);
  return { koName, total: keys.length, covered: keys.length - missing.length, missing };
}

async function refresh() {
  const m = await meta;
  const s = await chrome.storage.local.get(['seenUi', 'seenKo', 'off', 'cov']);
  const disabled = !!s.seenUi && s.seenUi !== m.ui;
  const on = !disabled && !s.off;
  await chrome.declarativeNetRequest.updateEnabledRulesets(on ? { enableRulesetIds: ['zh'] } : { disableRulesetIds: ['zh'] });
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
