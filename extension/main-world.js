// 跑在頁面 MAIN world、document_start：在任何遊戲模組載入前，同步決定語言並插入 import map，
// 把 ui-<hash>.js 對應到中文渲染補丁版（blob: 網址）。
// 為什麼不在 content.js 做：isolated world 插入的 inline script 受擴充 CSP 限制，import map 會被拒絕。
// 這裡拿不到 chrome.*，狀態與補丁碼由 content.js 從 background 同步到頁面 localStorage（d2zh:off、d2zh:ui）。
(() => {
  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const isGame = location.pathname.startsWith('/play/');
  const off = read('d2zh:off') === '1';
  let ui = null;
  try { ui = JSON.parse(read('d2zh:ui')); } catch {}
  // 遊戲頁手上沒有補丁碼時先用英文：沒補丁的 ui 會把中文畫成「?」
  const zh = !off && (!isGame || !!ui?.code);
  try { localStorage.setItem('d2s:lang', zh && isGame ? 'ko' : 'en'); } catch {}
  if (!zh || !isGame) return;
  const url = URL.createObjectURL(new Blob([ui.code], { type: 'text/javascript' }));
  const map = document.createElement('script');
  map.type = 'importmap';
  map.textContent = JSON.stringify({ imports: { [`https://d2survivors.lol/assets/${ui.name}`]: url } });
  document.documentElement.prepend(map);
})();
