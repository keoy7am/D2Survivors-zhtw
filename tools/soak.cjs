// 長時間遊玩、收集執行中翻不出的字串（擴充翻譯器補丁記在 globalThis.__d2zhMissing）。
// 用遊戲的開發參數 ?god&speed=N 快速推進（只在這個測試瀏覽器裡，不碰真實存檔與排行榜），
// 一直走動、按 1 選升級卡，讓寶箱、升級、首領、任務訊息都出現。
// 用法：node tools/soak.cjs [秒數=120] [速度=8] [輸出 JSON]
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('playwright');

const [secs = '120', speed = '8', out] = process.argv.slice(2);
(async () => {
  const ext = path.resolve(__dirname, '..', 'extension');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'd2zh-soak-')), {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  // 擴充第一次進遊戲頁會快取補丁碼並重新整理一次
  await page.goto('https://d2survivors.lol/play/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  await page.goto(`https://d2survivors.lol/play/?god&speed=${speed}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  for (const [x, y, w] of [[640, 400, 3], [640, 409, 4], [640, 380, 1], [640, 738, 8]]) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(w * 1000);
  }
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  for (let i = 0, end = Date.now() + +secs * 1000; Date.now() < end; i++) {
    for (const k of ['1', 'Enter', 'Space']) await page.keyboard.press(k).catch(() => {});
    await page.keyboard.down(keys[i % 4]);
    await page.waitForTimeout(2000);
    await page.keyboard.up(keys[i % 4]);
  }
  const missing = await page.evaluate(() => [...(globalThis.__d2zhMissing ?? [])]);
  await page.screenshot({ path: path.join(os.tmpdir(), 'soak.png') });
  if (out) fs.writeFileSync(out, JSON.stringify(missing, null, 1));
  console.log(`漏翻 ${missing.length} 條`);
  for (const s of missing) console.log(' ', s);
  await ctx.close();
})();
