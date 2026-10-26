// 端到端：在 Playwright Chromium 載入擴充，跑三個情境，任一失敗 exit 1
//   1. 遊戲頁：ui/字典都轉向到擴充、lang=ko、背景記到版本並算出覆蓋率
//   2. 首頁：lang=en、data-t 文字換成繁中
//   3. 模擬遊戲改版（meta.json 的 ui 檔名對不上）：自動停用規則、切回英文、不再載入補丁
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
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
  return { ctx, sw, page: ctx.pages()[0] || (await ctx.newPage()) };
}
const track = (page) => {
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  return reqs;
};
const settle = (page) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(2500));

(async () => {
  // 1 + 2
  {
    const { ctx, sw, page } = await launch(EXT);
    const reqs = track(page);
    await page.goto('https://d2survivors.lol/play/');
    await settle(page);
    await settle(page); // content.js 可能因狀態同步重新整理一次
    check(await page.evaluate(() => document.documentElement.lang) === 'ko', '遊戲頁 lang=ko');
    check(reqs.some((u) => u.endsWith('/zh-TW.js') && u.startsWith('chrome-extension://')), '字典轉向擴充');
    check(reqs.some((u) => u.endsWith('/ui.js') && u.startsWith('chrome-extension://')), 'ui 轉向補丁版');
    const st = await sw.evaluate(() => chrome.storage.local.get(null));
    check(!!st.seenUi && st.disabled === false, `背景記到版本且未停用（seenUi=${st.seenUi}）`);
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
    await page.goto('https://d2survivors.lol/play/');
    await settle(page);
    await settle(page);
    const st = await sw.evaluate(() => chrome.storage.local.get(null));
    check(st.disabled === true, '改版時 disabled=true');
    const rs = await sw.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets());
    check(rs.length === 0, `轉向規則已停用（${JSON.stringify(rs)}）`);
    const reqs = track(page);
    await page.reload();
    await settle(page);
    check(await page.evaluate(() => localStorage.getItem('d2s:lang')) === 'en', '改版時切回英文');
    check(!reqs.some((u) => u.startsWith('chrome-extension://')), '改版時不再載入擴充檔案');
    await ctx.close();
  }
  console.log(failed ? `${failed} 項失敗` : '全部通過');
  process.exit(failed ? 1 : 0);
})();
