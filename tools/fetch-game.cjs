// 抓遊戲目前版本的 JS（原版、不載入擴充）到 game/，給 build.mjs 用
// 用法：node tools/fetch-game.cjs
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const out = path.resolve(__dirname, '..', 'game');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('d2s:lang', 'ko'));
  const saved = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!/\.js(\?|$)/.test(u) || !u.includes('d2survivors.lol/assets/')) return;
    try {
      const body = await r.body();
      const name = path.basename(new URL(u).pathname);
      fs.writeFileSync(path.join(out, name), body);
      saved.push(name);
    } catch {}
  });
  // 首頁、排行榜的腳本帶網站層字串（build／site-keys 用），遊戲頁的帶 ui/ko
  for (const u of ['https://d2survivors.lol/', 'https://d2survivors.lol/leaderboards/', 'https://d2survivors.lol/play/']) {
    await page.goto(u, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
  }
  await browser.close();
  const need = ['ui-', 'ko-'].map((p) => saved.filter((n) => n.startsWith(p)));
  console.log(`抓到 ${saved.length} 個檔；ui: ${need[0]}；ko: ${need[1]}`);
  if (need.some((l) => l.length !== 1)) process.exit(1);
})();
