// 效能量測：開一局遊戲，量對局中主執行緒的 JS／任務時間與每幀間隔
// 用法：node tools/bench.cjs <noext|ours|bookmark> [秒數=20]
//   noext    不載入擴充（英文原版，基準）
//   ours     載入 extension/
//   bookmark 不載入擴充，進遊戲頁後執行第三方書籤版 d2_zh.js（只為比較）
// 環境變數 EXT=<資料夾> 可換擴充；PERF=1 先開啟效能模式（若擴充支援）
// headless 的 WebGL 是軟體模擬，絕對值偏高；只看同一台機器、同一指令下的相對差異
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('playwright');

const BOOKMARK = 'https://jtnhrbpvvm-spec.github.io/taiwan_game2/D2%E4%BF%AE%E6%94%B9%E7%89%88/d2_zh.js';
const [mode = 'ours', secs = '20'] = process.argv.slice(2);

(async () => {
  const ext = process.env.EXT || path.resolve(__dirname, '..', 'extension');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'd2zh-bench-')), {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
    args: mode === 'ours' ? [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] : [],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  page.on('dialog', (d) => d.dismiss());
  if (mode === 'ours') {
    // 擴充第一次進遊戲頁會快取補丁碼並重新整理一次，先走一遍
    await page.goto('https://d2survivors.lol/play/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(6000);
    if (process.env.PERF) {
      const sw = ctx.serviceWorkers().find((w) => w.url().endsWith('/background.js'));
      // 效能模式只在選過遊戲檔案（d2s:files）時生效；自動化瀏覽器沒有，模擬「選了託管檔案」
      await page.evaluate(() => localStorage.setItem('d2s:files', 'hosted'));
      await sw.evaluate(() => chrome.storage.local.set({ perf: true }));
      await page.waitForTimeout(3000);
    }
  }
  await page.goto('https://d2survivors.lol/play/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  // 進一局：主選單 → 單人 → 選角 → 開始（座標同 tools/tour.cjs 的導覽）
  for (const [x, y, w] of [[640, 400, 3], [640, 409, 4], [640, 380, 1], [640, 738, 8]]) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(w * 1000);
  }
  // 書籤版在主選單會跳改版說明擋住點擊，所以進了對局才執行
  if (mode === 'bookmark') {
    await page.evaluate((u) => import(`${u}?v=${Date.now()}`), BOOKMARK);
    await page.waitForTimeout(3000);
  }
  // 開局就會先跳升級選卡（遊戲暫停）：按 1 選第一張，量測中也持續處理
  await page.keyboard.press('1');
  await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await page.evaluate(() => {
    globalThis.__bench = [];
    let last = performance.now();
    const tick = (t) => { globalThis.__bench.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const a = await metrics();
  // 一直按方向鍵走動，讓畫面與怪物持續變化
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  for (let i = 0, end = Date.now() + +secs * 1000; Date.now() < end; i++) {
    await page.keyboard.press('1');
    await page.keyboard.down(keys[i % 4]);
    await page.waitForTimeout(1500);
    await page.keyboard.up(keys[i % 4]);
  }
  const b = await metrics();
  const frames = (await page.evaluate(() => globalThis.__bench)).slice(5).sort((x, y) => x - y);
  const q = (p) => frames[Math.floor(frames.length * p)]?.toFixed(1);
  const span = b.Timestamp - a.Timestamp;
  const per = (k) => (((b[k] - a[k]) / span) * 1000).toFixed(0);
  const inGame = await page.evaluate(() => document.body.className);
  console.log(JSON.stringify({
    mode, perf: !!process.env.PERF, seconds: +span.toFixed(1),
    scriptMsPerSec: +per('ScriptDuration'), taskMsPerSec: +per('TaskDuration'),
    layoutMsPerSec: +per('LayoutDuration'), styleMsPerSec: +per('RecalcStyleDuration'),
    scriptMsPerFrame: +(((b.ScriptDuration - a.ScriptDuration) * 1000) / frames.length).toFixed(3),
    fps: +(frames.length / span).toFixed(1), frameP50: +q(0.5), frameP95: +q(0.95),
    heapMB: +(b.JSHeapUsedSize / 1048576).toFixed(0), bodyClass: inGame.slice(0, 80),
  }));
  await page.screenshot({ path: path.join(os.tmpdir(), `bench-${mode}.png`) });
  await ctx.close();
})();
