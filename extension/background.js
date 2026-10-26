// 執行期補丁＋覆蓋率。
// - 遊戲載入哪一版 ui-<hash>.js／translate-<hash>.js，就抓那一版原檔打補丁（patch-ui.js 的 PATCHERS），
//   補丁碼存進 storage（patches），content.js 同步到頁面、main-world.js 用 import map 換上。
//   遊戲改版後自動重打，翻譯照常運作；新字串不在字典裡，遊戲引擎本來就會顯示原文。
// - ui 補丁打不上（作者改了渲染器）才 disabled：停用字典規則、退回英文，不然中文會被畫成「?」。
//   translate 補丁只是補強（快捷鍵後綴、日期、漏翻紀錄），打不上就略過，不影響翻譯。
// - ko-<hash>.js 換版只影響覆蓋率（字典規則不綁檔名）。
import zh from './zh-TW.js';
import { dictKeys } from './dict-keys.js';
import { PATCHERS } from './patch-ui.js';

const ORIGIN = 'https://d2survivors.lol/assets/';
const OLD_UI_RULE = 100;
const PREFIXES = Object.keys(PATCHERS); // 'ui-'、'translate-'
const meta = fetch(chrome.runtime.getURL('meta.json')).then((r) => r.json());

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} 回 ${r.status}`);
  return r.text();
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
  const s = await chrome.storage.local.get(['seen', 'off', 'cov', 'patches']);
  const seen = s.seen ?? {};
  const patches = { ...(s.patches ?? {}) };
  const errors = [];
  let changed = false;
  for (const prefix of PREFIXES) {
    // 還沒看過遊戲載入哪一版時（剛安裝），先對建置時的版本預打
    const name = seen[prefix] ?? m.files[prefix];
    if (patches[prefix]?.name === name) continue;
    try {
      patches[prefix] = { name, code: PATCHERS[prefix](await fetchText(ORIGIN + name), name) };
    } catch (e) {
      console.warn(`${name} 補丁失敗`, e);
      delete patches[prefix];
      errors.push(`${name}：${e.message ?? e}`);
    }
    changed = true;
  }
  // 預打失敗不算 disabled（遊戲可能已經換版），等真的看到版本再判斷，不要讓剛裝好的人看到紅色「!」
  const disabled = !patches['ui-'] && !!seen['ui-'];
  // 同一次 set：content.js 收到一個變更事件、重新整理一次
  if (changed) await chrome.storage.local.set({ patches, patchError: errors.join('；') || null });
  await chrome.declarativeNetRequest.updateEnabledRulesets(!disabled && !s.off ? { enableRulesetIds: ['zh'] } : { disableRulesetIds: ['zh'] });
  await chrome.storage.local.set({ disabled });
  let cov = s.cov;
  const koName = seen['ko-'] ?? m.files['ko-'];
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
    const prefix = ['ko-', ...PREFIXES].find((p) => name.startsWith(p));
    chrome.storage.local.get('seen').then(({ seen = {} }) => {
      if (seen[prefix] !== name) chrome.storage.local.set({ seen: { ...seen, [prefix]: name } }).then(refresh);
    });
  },
  { urls: [`${ORIGIN}ko-*.js`, ...PREFIXES.map((p) => `${ORIGIN}${p}*.js`)] },
);

chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);
chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && 'off' in c) refresh(); });

// popup 要匯出漏翻清單：字典沒翻的 key
chrome.runtime.onMessage.addListener((msg, _, reply) => {
  if (msg !== 'missing') return;
  (async () => {
    const m = await meta;
    const { seen = {} } = await chrome.storage.local.get('seen');
    reply(await coverage(seen['ko-'] ?? m.files['ko-']));
  })().catch((e) => reply({ error: String(e) }));
  return true;
});
