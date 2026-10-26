// 遊戲只在 lang=ko 時載入翻譯字典，字典與 ui 模組由 rules.json 轉向成繁中版。
// 遊戲模組在 HTML 解析完才執行，所以這裡要同步決定語言：用頁面 localStorage 的
// d2zh:off 當快取，背景頁的狀態（storage.local）回來後若不同就更新快取並重新整理一次。
const OFF = 'd2zh:off';
const isGame = location.pathname.startsWith('/play/');
const apply = (off) => {
  try {
    // 非遊戲頁用英文：網站的 FAQ 等段落只有英／韓兩份，英文比韓文好讀
    localStorage.setItem('d2s:lang', !off && isGame ? 'ko' : 'en');
    off ? localStorage.setItem(OFF, '1') : localStorage.removeItem(OFF);
  } catch {}
};
let cached = false;
try { cached = localStorage.getItem(OFF) === '1'; } catch {}
apply(cached);

const offNow = (s) => !!(s.off || s.disabled);
chrome.storage.local.get(['off', 'disabled'], (s) => {
  if (offNow(s) !== cached) { apply(offNow(s)); location.reload(); }
});
chrome.storage.onChanged.addListener((c, area) => {
  if (area !== 'local') return;
  // 遊戲改版：這一頁載入的是還沒打補丁的新版 ui，補丁規則備妥後重新整理一次
  if (isGame && c.patchedUi?.newValue) { location.reload(); return; }
  if (!('off' in c || 'disabled' in c)) return;
  chrome.storage.local.get(['off', 'disabled'], (s) => {
    if (offNow(s) !== cached) { apply(offNow(s)); location.reload(); }
  });
});

// 網站層（選單、頁尾、首頁）的 data-t 文字不經過遊戲字典，自己換
const translate = () => {
  if (cached) return;
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
