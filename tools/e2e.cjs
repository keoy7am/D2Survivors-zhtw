// 端到端：在 Playwright Chromium 載入擴充，跑三個情境，任一失敗 exit 1
//   1. 遊戲頁：字典轉向擴充、ui 跑的是執行期補丁版、lang=ko、覆蓋率已算
//   2. 首頁：預設繁中、沒有韓文；EN／繁中按鈕切換原文與中文；setup 頁不卡死
//   3. 模擬遊戲改版（meta.json 記的 ui 是不存在的舊版）：
//      安裝時預打失敗但不亮紅燈；開遊戲看到真正的新版→自動打補丁→中文
//   4. 模擬補丁打不上：disabled、退回英文
// 用法：node tools/e2e.cjs
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('playwright');

// EXT=<資料夾> 可改測解壓後的發佈檔
const EXT = process.env.EXT || path.resolve(__dirname, '..', 'extension');
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failed++; };

async function launch(ext) {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'd2zh-')), {
    // CHROMIUM=<chrome.exe> 可換較新的 Chromium（Playwright 內建版落後正式版 Chrome，行為可能不同）
    ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { channel: 'chromium' }),
    headless: true, viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const ours = (w) => w.url().endsWith('/background.js');
  const sw = ctx.serviceWorkers().find(ours) || (await ctx.waitForEvent('serviceworker', { predicate: ours }));
  return { ctx, sw, page: ctx.pages()[0] || (await ctx.newPage()) };
}
// worker 剛啟動時 chrome.* 可能還沒掛上，查不到就當空狀態，由 waitFor 重試
const state = (sw) => sw.evaluate(() => chrome.storage.local.get(null)).catch(() => ({}));
const settle = (page) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(2500));
const waitFor = async (fn, ms = 20000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 500))) if (await fn()) return true;
  return false;
};
const patched = (page) => page.evaluate(() => globalThis.__d2zhPatched === true).catch(() => false);

(async () => {
  // 1 + 2
  {
    const { ctx, sw, page } = await launch(EXT);
    await waitFor(async () => (await state(sw)).patches?.['ui-']);
    const reqs = [];
    page.on('request', (r) => reqs.push(r.url()));
    await page.goto('https://d2survivors.lol/play/');
    await settle(page);
    await settle(page); // 第一次進來先快取補丁碼、重新整理一次
    check(await page.evaluate(() => document.documentElement.lang) === 'ko', '遊戲頁 lang=ko');
    check(reqs.some((u) => u.endsWith('/zh-TW.js') && u.startsWith('chrome-extension://')), '字典轉向擴充');
    check(await patched(page), '遊戲跑的是補丁版 ui');
    check(await page.evaluate(() => globalThis.__d2zhTranslatePatched === true), '遊戲跑的是補丁版翻譯器');
    const st = await state(sw);
    check(st.disabled === false && st.patches?.['ui-']?.name === st.seen?.['ui-'], `補丁對上遊戲版本（${st.patches?.['ui-']?.name}）`);
    check(st.cov?.total > 10000, `覆蓋率已計算（${st.cov?.covered}/${st.cov?.total}）`);

    // 新版偵測：真的查到 GitHub 的最新版；假裝有新版時圖示顯示 NEW、popup 顯示下載提示
    check(await waitFor(async () => (await state(sw)).update?.latest), `新版檢查查到 GitHub 最新版（v${(await state(sw)).update?.latest}）`);
    const realUpdate = (await state(sw)).update;
    await sw.evaluate(() => chrome.storage.local.set({ update: { latest: '99.0.0', url: 'https://github.com/keoy7am/D2Survivors-zhtw/releases', checkedAt: Date.now() } }));
    check(await waitFor(() => sw.evaluate(async () => (await chrome.action.getBadgeText({})) === 'NEW')), '有新版時圖示顯示 NEW');
    const popup = await ctx.newPage();
    await popup.goto(sw.url().replace(/[^/]+$/, 'popup.html'));
    await popup.waitForTimeout(500);
    const notice = await popup.evaluate(() => { const el = document.getElementById('update'); return el.hidden ? null : el.textContent; });
    check(notice?.includes('v99.0.0'), `popup 顯示新版提示（${notice}）`);
    const [issue] = await Promise.all([ctx.waitForEvent('page'), popup.click('#report')]);
    await issue.waitForLoadState('commit').catch(() => {});
    // 沒登入 GitHub 時會先轉到登入頁，表單網址放在 return_to
    const u = new URL(issue.url());
    const q = new URL(u.searchParams.get('return_to') ?? u.href, u.origin).searchParams;
    check(q.get('template') === 'translation.yml' && q.get('ext-version') && q.get('game-version')?.includes('ui-'),
      `回報按鈕開翻譯回報表單並帶入版本（${q.get('ext-version')}；${q.get('game-version')}）`);
    await issue.close();
    await popup.close();
    await sw.evaluate((u) => chrome.storage.local.set({ update: u }), realUpdate);

    await page.goto('https://d2survivors.lol/');
    await settle(page);
    const look = () => page.evaluate(() => ({
      lang: localStorage.getItem('d2s:lang'),
      nav: document.querySelector('[data-t="navBoards"]')?.textContent,
      hangul: /[가-힣]/.test(document.body.innerText + [...document.querySelectorAll('*')].map((e) => getComputedStyle(e, '::before').content).join('')),
    }));
    const home = await look();
    check(home.lang === 'ko' && home.nav === '排行榜', `首頁預設繁中（${home.lang} ${home.nav}）`);
    check(!home.hangul, '首頁沒有韓文（FAQ 改顯示英文那份）');
    await page.click('.lang button[data-lang="en"]');
    await page.waitForTimeout(1000);
    const en = await look();
    check(en.lang === 'en' && en.nav === 'Leaderboards', `按 EN 顯示英文原文（${en.nav}）`);
    await page.click('.lang button[data-lang="ko"]');
    await page.waitForTimeout(1000);
    check((await look()).nav === '排行榜', '按繁中切回中文');

    // setup 頁：網站層翻譯和遊戲的 DOM 翻譯器不能互相改寫（曾經卡死整個分頁）
    await page.goto('https://d2survivors.lol/play/setup.html').catch(() => {});
    await settle(page);
    const busy = await Promise.race([
      page.evaluate(() => new Promise((res) => {
        let n = 0;
        new MutationObserver((l) => { n += l.length; }).observe(document.body, { subtree: true, childList: true, characterData: true });
        setTimeout(() => res({ n, nav: document.querySelector('[data-t="navBoards"]')?.textContent }), 1000);
      })),
      new Promise((res) => setTimeout(() => res(null), 15000)),
    ]);
    check(busy && busy.n < 50, `setup 頁沒卡死（1 秒內 DOM 變動 ${busy?.n ?? '逾時'} 次）`);
    check(busy?.nav === '排行榜', `setup 頁選單繁中（${busy?.nav}）`);
    await ctx.close();
  }
  // 3
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'd2zh-ext-'));
    fs.cpSync(EXT, tmp, { recursive: true, filter: (s) => !s.includes('_metadata') });
    const meta = JSON.parse(fs.readFileSync(path.join(tmp, 'meta.json')));
    meta.files['ui-'] = 'ui-OLDVERSION.js';
    fs.writeFileSync(path.join(tmp, 'meta.json'), JSON.stringify(meta));
    const { ctx, sw, page } = await launch(tmp);
    check(await waitFor(async () => (await state(sw)).patchError?.includes('ui-OLDVERSION.js')), '剛安裝時預打舊版失敗，記下原因');
    // 曾經的 bug：擴充自己抓舊檔（404）被 webRequest 記成「遊戲載入過」，幾秒後才翻成 disabled。等一下再看
    await waitFor(async () => 'disabled' in (await state(sw)));
    await page.waitForTimeout(4000);
    const pre = await state(sw);
    check(!pre.seen?.['ui-'], `擴充自己抓的檔不算遊戲載入過（seen ui-：${pre.seen?.['ui-'] ?? '無'}）`);
    check(pre.disabled === false, '還沒看過遊戲版本，不亮紅色 !（disabled=false）');
    await page.goto('https://d2survivors.lol/play/').catch(() => {});
    check(await waitFor(async () => { const st = await state(sw); return !!st.seen?.['ui-'] && st.patches?.['ui-']?.name === st.seen['ui-']; }), '看到新版 ui 後自動打補丁');
    await settle(page);
    await settle(page); // content.js 會重新整理一次
    check(await patched(page), '重新整理後跑的是新版的補丁');
    check(await page.evaluate(() => localStorage.getItem('d2s:lang')) === 'ko', '中文（lang=ko）');
    await ctx.close();
  }
  // 4. 補丁打不上（模擬作者改了渲染器）：退回英文、不載入字典
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'd2zh-ext-'));
    fs.cpSync(EXT, tmp, { recursive: true, filter: (s) => !s.includes('_metadata') });
    fs.writeFileSync(path.join(tmp, 'patch-ui.js'), "const f = () => { throw new Error('模擬：渲染器變了'); };\nexport const PATCHERS = { 'ui-': f, 'translate-': f };\n");
    const { ctx, sw, page } = await launch(tmp);
    await page.goto('https://d2survivors.lol/play/').catch(() => {});
    check(await waitFor(async () => (await state(sw)).disabled === true), '已見版本且補丁失敗 → disabled=true');
    await settle(page);
    await settle(page);
    const reqs = [];
    page.on('request', (r) => reqs.push(r.url()));
    await page.reload();
    await settle(page);
    check(await page.evaluate(() => localStorage.getItem('d2s:lang')) === 'en', '退回英文');
    check(!reqs.some((u) => u.startsWith('chrome-extension://')), '不再載入擴充字典');
    check(!(await patched(page)), '沒有補丁版 ui');
    await ctx.close();
  }
  console.log(failed ? `${failed} 項失敗` : '全部通過');
  process.exit(failed ? 1 : 0);
})();
