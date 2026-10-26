// 遊戲只在 lang=ko 時載入翻譯字典（rules.json 把字典轉向成繁中版）；ui 的中文渲染補丁由 main-world.js
// 用 import map 換上（不用 DNR 轉向：正式版 Chrome 會讓轉向 data: 的 script 回 503，遊戲卡死）。
// main-world.js 拿不到 chrome.*，所以這裡把 background 的狀態與補丁碼同步到頁面 localStorage；
// 和這一頁開頭用的快取不同時，更新快取並重新整理遊戲頁一次。
const OFF = 'd2zh:off';
const UI = 'd2zh:ui'; // {name, code}
const isGame = location.pathname.startsWith('/play/');
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

const cachedOff = read(OFF) === '1';
let cachedUi = null;
try { cachedUi = JSON.parse(read(UI)); } catch {}

// 背景狀態 → 快取；有變就重新整理（變化只在安裝、改版、切換停用時發生，不會連續重整）
const sync = () => chrome.storage.local.get(['off', 'disabled', 'patchedUi', 'patchedCode'], (s) => {
  const off = !!(s.off || s.disabled);
  const ui = !off && s.patchedUi && s.patchedCode ? { name: s.patchedUi, code: s.patchedCode } : null;
  const changed = off !== cachedOff || (ui?.name ?? null) !== (cachedUi?.name ?? null) || (ui && ui.code !== cachedUi?.code);
  if (!changed) return;
  write(OFF, off ? '1' : null);
  write(UI, ui ? JSON.stringify(ui) : null);
  if (isGame) location.reload();
});
sync();
chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'local' && ('off' in c || 'disabled' in c || 'patchedUi' in c || 'patchedCode' in c)) sync();
});

// 網站層（選單、頁尾、首頁）的 data-t 文字不經過遊戲字典，自己換
const translate = () => {
  if (cachedOff) return;
  for (const el of document.querySelectorAll('[data-t]')) {
    const zh = D2ZH_SITE[el.dataset.t];
    if (zh && el.textContent !== zh) el.textContent = zh;
  }
  for (const b of document.querySelectorAll('.lang button[data-lang="ko"]')) {
    if (b.textContent !== '繁中') { b.textContent = '繁中'; b.setAttribute('aria-label', '繁體中文'); }
  }
};
const start = () => {
  translate();
  new MutationObserver(translate).observe(document.body, { subtree: true, childList: true, characterData: true });
};
document.body ? start() : document.addEventListener('DOMContentLoaded', start, { once: true });
