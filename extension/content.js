// 遊戲只在 lang=ko 時載入翻譯字典（rules.json 把字典轉向成繁中版）；ui 的中文渲染補丁由 main-world.js
// 用 import map 換上（不用 DNR 轉向：正式版 Chrome 會讓轉向 data: 的 script 回 503，遊戲卡死）。
// main-world.js 拿不到 chrome.*，所以這裡把 background 的狀態與補丁碼同步到頁面 localStorage；
// 和這一頁開頭用的快取不同時，更新快取並重新整理遊戲頁一次。
const OFF = 'd2zh:off';
const MODS = 'd2zh:mods'; // {'ui-': {name, code}, 'translate-': {name, code}}
const PENDING = 'd2zh:pendingKo'; // 使用者選了繁中、但暫時用英文顯示（等補丁碼／暫停中）
const isGame = location.pathname.startsWith('/play/');
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
write('d2zh:ui', null); // 舊版的單一模組快取

const cachedOff = read(OFF) === '1';
const cachedMods = read(MODS);

const sync = () => chrome.storage.local.get(['off', 'disabled', 'patches'], (s) => {
  const off = !!(s.off || s.disabled);
  const mods = s.patches?.['ui-'] ? JSON.stringify(s.patches) : null;
  let reload = false;
  if (off !== cachedOff) { write(OFF, off ? '1' : null); reload = true; }
  if (mods !== cachedMods) { write(MODS, mods); reload = true; }
  // 補丁碼到了且沒停用：把暫時退回的英文還原成使用者選的繁中
  if (!off && mods && read(PENDING)) { write(PENDING, null); write('d2s:lang', 'ko'); reload = true; }
  if (reload && isGame) location.reload();
});
sync();
chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'local' && ('off' in c || 'disabled' in c || 'patches' in c)) sync();
});

// popup 要匯出漏翻清單：遊戲執行中查不到翻譯的字串記在頁面（main-world.js 的翻譯器補丁），透過 postMessage 拿
chrome.runtime.onMessage.addListener((msg, _, reply) => {
  if (msg !== 'runtimeMissing') return;
  const id = Math.random().toString(36).slice(2);
  const on = (e) => {
    if (e.source !== window || e.data?.d2zh !== 'missingReply' || e.data.id !== id) return;
    removeEventListener('message', on);
    reply(e.data.list);
  };
  addEventListener('message', on);
  postMessage({ d2zh: 'missingAsk', id }, location.origin);
  setTimeout(() => { removeEventListener('message', on); reply([]); }, 1500);
  return true;
});

// 網站層文字（選單、頁尾、首頁、排行榜）不經過遊戲字典。網站選「한국어」（＝繁中）時畫面上是韓文，照韓文原文換：
// 整句吻合 → 模板（含 {0} 的句子，數字等部分照抄）→ 句中片段（「Linux (베타)」這種拼接字）。
const KO = Object.keys(D2ZH_SITE_KO).filter((k) => !/\{\d+\}/.test(k)).sort((a, b) => b.length - a.length);
const TPL = Object.keys(D2ZH_SITE_KO).filter((k) => /\{\d+\}/.test(k)).map((k) => {
  const ids = [];
  const body = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${body.replace(/\\\{(\d+)\\\}/g, (_, i) => { ids.push(i); return '(.+?)'; })}$`, 's');
  // 句中版：模板只是整段文字的一部分時（「模板句 另一句」），佔位符只吃不含空白的片段（多半是數字）
  const inner = new RegExp(body.replace(/\\\{(\d+)\\\}/g, '(\\S+?)'), 'g');
  return { re, inner, ids, zh: D2ZH_SITE_KO[k], fixed: k.replace(/\{\d+\}/g, '').length };
}).sort((a, b) => b.fixed - a.fixed); // 固定文字多的先比，避免「{0}명」這種短模板搶先
const toZh = (s) => {
  const t = s.trim();
  if (D2ZH_SITE_KO[t]) return s.replace(t, D2ZH_SITE_KO[t]);
  // 網站用 Intl 以韓文格式化的日期：10월 25일、2026년 10월 25일
  if (/^(\d+년\s*)?\d+월\s*\d+일$/.test(t)) return s.replace(t, t.replace(/(\d+)년\s*/, '$1年').replace(/(\d+)월\s*/, '$1月').replace(/(\d+)일/, '$1日'));
  // 整句模板要在切「 · 」之前比：有些模板本身就含「 · 」（排行榜技能變化統計）
  for (const { re, ids, zh } of TPL) {
    const m = re.exec(t);
    if (m) return s.replace(t, zh.replace(/\{(\d+)\}/g, (_, i) => m[ids.indexOf(i) + 1] ?? _));
  }
  // 「A · B」拼接句：各段分開翻
  if (t.includes(' · ')) return s.replace(t, t.split(' · ').map(toZh).join(' · '));
  // 拼接句：長的完整句子先換 → 句中模板 → 短片段（反過來的話短片段會把句子和模板拆爛）
  let v = s;
  const sub = (ko) => { if (v.includes(ko)) v = v.split(ko).join(D2ZH_SITE_KO[ko]); };
  KO.filter((k) => k.length >= 15).forEach(sub);
  for (const { inner, ids, zh } of TPL) v = v.replace(inner, (...m) => zh.replace(/\{(\d+)\}/g, (_, i) => m[ids.indexOf(i) + 1] ?? _));
  KO.filter((k) => k.length < 15).forEach(sub);
  return v;
};
const HANGUL = /[가-힣]/;
// 換過的元素標上 data-no-translate：遊戲自己的 DOM 翻譯器會跳過它，否則兩邊的 MutationObserver 會互相改寫到頁面卡死
const fix = (n) => {
  const el = n.parentElement;
  if (!el || el.closest('.lang, [data-in="ko"], script, style')) return;
  const v = toZh(n.nodeValue);
  if (v === n.nodeValue) return;
  if (!el.hasAttribute('data-no-translate')) el.setAttribute('data-no-translate', '');
  n.nodeValue = v;
};
const translate = () => {
  if (cachedOff || read('d2s:lang') !== 'ko') return;
  // 遊戲頁 DOM 很大又一直在變，只處理網站外框的 data-t；網站頁掃全頁
  const roots = isGame ? document.querySelectorAll('[data-t]') : [document.body];
  for (const r of roots) {
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) if (HANGUL.test(w.currentNode.nodeValue)) fix(w.currentNode);
  }
};
const relabel = () => {
  for (const b of document.querySelectorAll('.lang button[data-lang="ko"]')) {
    if (b.textContent !== '繁中') { b.textContent = '繁中'; b.setAttribute('aria-label', '繁體中文'); b.setAttribute('data-no-translate', ''); }
  }
};
const start = () => {
  const all = () => { relabel(); translate(); };
  all();
  new MutationObserver(all).observe(document.body, { subtree: true, childList: true, characterData: true });
};
document.body ? start() : document.addEventListener('DOMContentLoaded', start, { once: true });
