// 跑在頁面 MAIN world、document_start，在任何遊戲模組載入前同步處理：
// - 語言：網站的 EN／繁中（原「한국어」）按鈕就是開關，存在 d2s:lang（en／ko），這裡不替使用者改選擇；
//   只有第一次安裝時預設成繁中，以及遊戲頁暫時拿不到補丁碼時先退回英文（沒補丁的 ui 會把中文畫成「?」），
//   等補丁碼到了由 content.js 還原成繁中。
// - import map：繁中時把 ui-<hash>.js、translate-<hash>.js 對應到補丁版（blob: 網址）。
// 為什麼不在 content.js 做：isolated world 插入的 inline script 受擴充 CSP 限制，import map 會被拒絕。
// 這裡拿不到 chrome.*，狀態與補丁碼由 content.js 從 background 同步到頁面 localStorage（d2zh:mods）。
(() => {
  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  // popup 的「匯出漏翻清單」：回傳翻譯器補丁記下的漏翻字串（content.js 轉接）
  addEventListener('message', (e) => {
    if (e.source !== window || e.data?.d2zh !== 'missingAsk') return;
    postMessage({ d2zh: 'missingReply', id: e.data.id, list: [...(globalThis.__d2zhMissing ?? [])] }, location.origin);
  });
  // 效能設定（popup → content.js 同步成 d2zh:perf：{res, nolights, noshadows, fps}），只在遊戲頁套用
  let perf = null;
  try { perf = JSON.parse(read('d2zh:perf')); } catch {}
  const onGame = /^\/play\/(index\.html)?$/.test(location.pathname);
  // 原生：遊戲作者內建的畫質網址參數，itemArt 模組載入時讀一次 location.search：
  // res＝渲染解析度、nolights＝關光照、noshadows＝關陰影（都不在排行榜的作弊參數表裡）。
  // 遊戲畫布出現時 itemArt 早已讀完（它是遊戲入口的靜態 import），立刻把網址還原：排行榜紀錄會帶 location.search。
  // 只在已選過遊戲檔案（d2s:files）時才加：網址有參數會讓遊戲跳過第一次造訪的 setup 頁轉向。
  // 畫布出現前就重新整理（F5、遊戲自己 reload），會帶著我們加的參數載入；不先拿掉，它會被當成原本的網址
  // 永遠黏在網址上（關掉設定也不恢復、跟著排行榜紀錄上傳）。所以加參數時在 sessionStorage 記下前後網址，
  // 這次網址正好是上次加過參數的樣子就先還原。
  const MARK = 'd2zh:perfUrl';
  let mark = null;
  try { mark = JSON.parse(sessionStorage.getItem(MARK)); } catch {}
  if (mark && location.href === mark.url) history.replaceState(history.state, '', mark.clean);
  try { sessionStorage.removeItem(MARK); } catch {}
  if (onGame && perf && (perf.res || perf.nolights || perf.noshadows) && read('d2s:files')) {
    const clean = location.href;
    const url = new URL(clean);
    // popup 有設定的項目覆蓋網址上的同名參數（玩家存的設定為準）；留在遊戲預設的項目不動網址
    if (perf.res) url.searchParams.set('res', String(perf.res));
    for (const k of ['nolights', 'noshadows']) if (perf[k]) url.searchParams.set(k, '');
    history.replaceState(history.state, '', url);
    try { sessionStorage.setItem(MARK, JSON.stringify({ url: location.href, clean })); } catch {}
    const restore = () => {
      if (!document.querySelector('#stage canvas')) return;
      history.replaceState(history.state, '', clean);
      // 紀錄不在這裡清：按 F5 時舊頁面可能剛好在卸載前執行到這裡，瀏覽器卻仍用帶參數的網址重新載入
      watch.disconnect();
    };
    const watch = new MutationObserver(restore);
    watch.observe(document.documentElement, { subtree: true, childList: true });
  }
  // 非原生：畫面更新上限。遊戲沒設上限（每次 requestAnimationFrame 都跑邏輯＋繪圖），這裡放慢瀏覽器回呼的頻率。
  // 遊戲邏輯依每幀實際經過時間推進（ticker deltaMS），遊戲速度與紀錄的遊戲時間不變。
  // 每個真實畫面只決定一次放不放行；放行間隔用累加的方式，高刷新率螢幕上平均才會接近設定值。
  if (onGame && perf?.fps >= 30) {
    const raf = requestAnimationFrame.bind(window);
    const caf = cancelAnimationFrame.bind(window);
    const gap = 1000 / perf.fps;
    let last = -Infinity;
    let openAt = -1;
    const open = (t) => {
      if (t === openAt) return true;
      if (t - last < gap - 1) return false;
      last = t - last > gap * 2 ? t : last + gap;
      openAt = t;
      return true;
    };
    let seq = 0;
    const live = new Map(); // 我們回傳的 id → 目前真正排著的 rAF id（延後時會換），cancel 才取消得到
    window.requestAnimationFrame = (cb) => {
      const id = ++seq;
      const step = (t) => {
        if (!open(t)) { live.set(id, raf(step)); return; }
        live.delete(id);
        cb(t);
      };
      live.set(id, raf(step));
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      if (live.has(id)) { caf(live.get(id)); live.delete(id); }
    };
  }
  // popup 打開時問「效能設定有沒有生效」（content.js 轉接）：量一次畫布解析度；有鎖幀再數 1 秒畫面更新次數。
  // 只在被問時量，平常不常駐。回傳這一頁載入時實際用的設定，popup 拿去和存檔的設定比對
  addEventListener('message', (e) => {
    if (e.source !== window || e.data?.d2zh !== 'perfAsk') return;
    const c = document.querySelector('#stage canvas');
    const done = (fps) => postMessage({
      d2zh: 'perfReply', id: e.data.id, perf, onGame, files: !!read('d2s:files'),
      ratio: c?.clientWidth ? c.width / c.clientWidth : null, fps,
    }, location.origin);
    if (!(perf?.fps >= 30)) { done(null); return; }
    let n = 0;
    const end = performance.now() + 1000;
    const count = () => { n++; performance.now() < end ? requestAnimationFrame(count) : done(n); };
    requestAnimationFrame(count);
  });
  if (!read('d2zh:init')) { write('d2zh:init', '1'); write('d2s:lang', 'ko'); }
  if (read('d2s:lang') !== 'ko') return;
  let mods = null;
  try { mods = JSON.parse(read('d2zh:mods')); } catch {}
  if (read('d2zh:off') === '1' || !mods?.['ui-']?.code) {
    // 只有遊戲頁需要退回英文；網站頁（首頁、排行榜）的中文由 content.js 換，不靠補丁
    if (location.pathname.startsWith('/play/')) { write('d2s:lang', 'en'); write('d2zh:pendingKo', '1'); }
    return;
  }
  // 所有頁面都換：排行榜頁也載入遊戲的翻譯器與 ui（裝備、技能名稱、日期）
  const imports = {};
  for (const { name, code } of Object.values(mods)) {
    imports[`https://d2survivors.lol/assets/${name}`] = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }
  const map = document.createElement('script');
  map.type = 'importmap';
  map.textContent = JSON.stringify({ imports });
  document.documentElement.prepend(map);
})();
