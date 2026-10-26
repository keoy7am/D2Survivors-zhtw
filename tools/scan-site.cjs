// 掃網站頁（繁中模式）殘留的韓文與沒翻的英文：排行榜逐一點分頁、展開紀錄、進玩家頁
// 用法：node tools/scan-site.cjs [截圖目錄]
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('playwright');

const EXT = process.env.EXT || path.resolve(__dirname, '..', 'extension');
const shots = process.argv[2];

// 畫面上看得到的文字節點：含韓文，或連續 3 個以上英文字（玩家名稱、品牌名會混進來，由人判斷）
const SCAN = () => {
  const out = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const n = w.currentNode;
    const el = n.parentElement;
    if (!el || el.closest('script,style,.lang') || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
    const t = n.nodeValue.trim();
    if (/[가-힣]/.test(t) || /[A-Za-z]{3,}\s+[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(t)) out.add(`<${el.tagName.toLowerCase()}.${el.className}> ${t.slice(0, 100)}`);
  }
  for (const c of document.querySelectorAll('canvas.d2-text')) if (/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(c.textContent)) out.add(`<canvas> ${c.textContent.slice(0, 100)}`);
  return [...out];
};

(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'd2zh-')), {
    ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : { channel: 'chromium' }),
    headless: true, viewport: { width: 1400, height: 900 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.waitForTimeout(4000);
  // 先開一次遊戲頁讓補丁碼快取進頁面
  await page.goto('https://d2survivors.lol/play/').catch(() => {});
  await page.waitForTimeout(8000);
  const report = async (label) => {
    await page.waitForTimeout(2500);
    const found = await page.evaluate(SCAN);
    const miss = await page.evaluate(() => [...(globalThis.__d2zhMissing ?? [])]);
    console.log(`\n=== ${label}（韓文／英文 ${found.length}、翻譯器漏翻 ${miss.length}）`);
    for (const f of found.slice(0, 25)) console.log('  ' + f);
    if (miss.length) console.log('  漏翻：' + miss.slice(0, 25).join(' ｜ '));
    if (shots) await page.screenshot({ path: path.join(shots, `${label.replace(/[^\w-]+/g, '_')}.png`), fullPage: true });
  };
  if (shots) fs.mkdirSync(shots, { recursive: true });
  await page.goto('https://d2survivors.lol/leaderboards/');
  await report('leaderboards');
  const n = (await page.$$('.lb-tab')).length;
  for (let i = 1; i < n; i++) { await (await page.$$('.lb-tab'))[i].click(); await report(`tab-${i}`); } // 點完會重新渲染，每次重查
  await (await page.$$('.lb-tab'))[0].click();
  await page.waitForTimeout(1500);
  const row = await page.$('tbody tr, .lb-row');
  if (row) {
    await row.click();
    await report('row-open');
    // 展開的紀錄（裝備框、技能用 D2 字型畫在 canvas 上）：單獨截圖，確認中文沒有變成「?」
    const box = await page.$('.lb-run-title');
    if (shots && box) await (await box.evaluateHandle((e) => e.closest('section, article, .lb-run, div'))).asElement().screenshot({ path: path.join(shots, 'row-detail.png') });
  }
  const player = await page.$('a[href*="player"], .lb-name a');
  if (player) { await player.click(); await page.waitForLoadState('networkidle').catch(() => {}); await report('player-page'); }
  await ctx.close();
})();
