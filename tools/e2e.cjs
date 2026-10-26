// 端到端：在 Playwright Chromium 載入擴充，跑三個情境，任一失敗 exit 1
//   1. 遊戲頁：字典轉向擴充、ui 跑的是執行期補丁版、lang=ko、覆蓋率已算
//   2. 首頁：lang=en、data-t 文字換成繁中
//   3. 模擬遊戲改版（meta.json 記的 ui 是不存在的舊版）：
//      安裝時補丁失敗→disabled；開遊戲看到真正的新版→自動重打補丁→恢復中文
// 用法：node tools/e2e.cjs
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('playwright');

const EXT = path.resolve(__dirname, '..', 'extension');
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failed++; };

async function launch(ext) {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'd2zh-')), {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
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
    await waitFor(async () => (await state(sw)).patchedUi);
    const reqs = [];
    page.on('request', (r) => reqs.push(r.url()));
    await page.goto('https://d2survivors.lol/play/');
    await settle(page);
    check(await page.evaluate(() => document.documentElement.lang) === 'ko', '遊戲頁 lang=ko');
    check(reqs.some((u) => u.endsWith('/zh-TW.js') && u.startsWith('chrome-extension://')), '字典轉向擴充');
    check(await patched(page), '遊戲跑的是補丁版 ui');
    const st = await state(sw);
    check(st.disabled === false && st.patchedUi === st.seenUi, `補丁對上遊戲版本（${st.patchedUi}）`);
    check(st.cov?.total > 10000, `覆蓋率已計算（${st.cov?.covered}/${st.cov?.total}）`);

    await page.goto('https://d2survivors.lol/');
    await settle(page);
    const home = await page.evaluate(() => ({
      lang: localStorage.getItem('d2s:lang'),
      nav: document.querySelector('[data-t="navBoards"]')?.textContent,
      hangul: /[가-힣]/.test(document.body.innerText),
    }));
    check(home.lang === 'en', '首頁 d2s:lang=en');
    check(home.nav === '排行榜', `首頁選單繁中（${home.nav}）`);
    check(!home.hangul, '首頁沒有韓文');
    await ctx.close();
  }
  // 3
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'd2zh-ext-'));
    fs.cpSync(EXT, tmp, { recursive: true, filter: (s) => !s.includes('_metadata') });
    const meta = JSON.parse(fs.readFileSync(path.join(tmp, 'meta.json')));
    meta.ui = 'ui-OLDVERSION.js';
    fs.writeFileSync(path.join(tmp, 'meta.json'), JSON.stringify(meta));
    const { ctx, sw, page } = await launch(tmp);
    check(await waitFor(async () => (await state(sw)).disabled === true), '補丁打不上時 disabled=true');
    check((await state(sw)).patchError?.includes('ui-OLDVERSION.js'), '記下補丁失敗原因');
    await page.goto('https://d2survivors.lol/play/').catch(() => {});
    check(await waitFor(async () => (await state(sw)).disabled === false), '看到新版 ui 後自動重打補丁、解除 disabled');
    await settle(page);
    await settle(page); // content.js 會重新整理一次
    check(await patched(page), '重新整理後跑的是新版的補丁');
    check(await page.evaluate(() => localStorage.getItem('d2s:lang')) === 'ko', '恢復中文（lang=ko）');
    await ctx.close();
  }
  console.log(failed ? `${failed} 項失敗` : '全部通過');
  process.exit(failed ? 1 : 0);
})();
