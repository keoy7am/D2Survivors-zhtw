// 用 Playwright 的 Chromium 載入未封裝擴充，打開遊戲頁，印出畫面文字與字典請求
// 用法：NODE_PATH="$(npm root -g)" node tools/smoke.cjs [url] [截圖路徑]
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const ext = path.resolve(__dirname, '..', 'extension');
  const url = process.argv[2] || 'https://d2survivors.lol/play/';
  const shot = process.argv[3];
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'd2zh-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1400, height: 900 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  const dictReqs = [];
  page.on('request', (r) => { if (/\/(ko|zh-TW)[-.]/.test(r.url())) dictReqs.push(r.url()); });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('URL', page.url());
  console.log('LANG', await page.evaluate(() => document.documentElement.lang));
  console.log('DICT', dictReqs);
  console.log((await page.evaluate(() => document.body.innerText)).slice(0, 800));
  // 畫面上殘留的韓文＝沒被我們接手的文字（網站層字典或 HTML 內嵌韓文段落）
  console.log('HANGUL', await page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) if (/[가-힣]/.test(w.currentNode.nodeValue)) out.push(w.currentNode.parentElement.outerHTML.slice(0, 120));
    return out.slice(0, 20);
  }));
  if (shot) await page.screenshot({ path: shot });
  await ctx.close();
})();
