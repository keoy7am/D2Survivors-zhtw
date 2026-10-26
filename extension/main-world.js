// 跑在頁面 MAIN world、document_start，在任何遊戲模組載入前同步處理：
// - 語言：網站的 EN／繁中（原「한국어」）按鈕就是開關，存在 d2s:lang（en／ko），這裡不替使用者改選擇；
//   只有第一次安裝時預設成繁中，以及遊戲頁暫時拿不到補丁碼時先退回英文（沒補丁的 ui 會把中文畫成「?」），
//   等補丁碼到了由 content.js 還原成繁中。
// - import map：繁中時把 ui-<hash>.js 對應到中文渲染補丁版（blob: 網址）。
// 為什麼不在 content.js 做：isolated world 插入的 inline script 受擴充 CSP 限制，import map 會被拒絕。
// 這裡拿不到 chrome.*，狀態與補丁碼由 content.js 從 background 同步到頁面 localStorage。
(() => {
  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  if (!read('d2zh:init')) { write('d2zh:init', '1'); write('d2s:lang', 'ko'); }
  if (!location.pathname.startsWith('/play/') || read('d2s:lang') !== 'ko') return;
  let ui = null;
  try { ui = JSON.parse(read('d2zh:ui')); } catch {}
  if (read('d2zh:off') === '1' || !ui?.code) {
    write('d2s:lang', 'en');
    write('d2zh:pendingKo', '1');
    return;
  }
  const url = URL.createObjectURL(new Blob([ui.code], { type: 'text/javascript' }));
  const map = document.createElement('script');
  map.type = 'importmap';
  map.textContent = JSON.stringify({ imports: { [`https://d2survivors.lol/assets/${ui.name}`]: url } });
  document.documentElement.prepend(map);
})();
