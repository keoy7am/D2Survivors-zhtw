// 載入擴充、照步驟操作遊戲並截圖，用來實機看翻譯效果
// 用法：node tools/tour.cjs <輸出目錄> 步驟...
//   click:x,y   點擊（畫面座標，視窗 1280x800）
//   key:Enter   按鍵
//   wait:秒     等待
//   shot:名稱   截圖成 <輸出目錄>/<名稱>.png
//   text        印出 DOM 文字（前 600 字）
//   hover:x,y   滑鼠移過去（看提示文字）
//   js:程式碼    在頁面執行並印出結果（例：js:[...window.__d2zhMissing]）
// 環境變數 NOEXT=1 時不載入擴充（看原版英文）
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const [out, ...steps] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const ext = path.resolve(__dirname, '..', 'extension');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'd2zh-')), {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
    args: process.env.NOEXT ? [] : [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('https://d2survivors.lol/play/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  for (const s of steps) {
    const [op, arg = ''] = s.split(/:(.*)/s);
    if (op === 'click') { const [x, y] = arg.split(',').map(Number); await page.mouse.click(x, y); }
    else if (op === 'hover') { const [x, y] = arg.split(',').map(Number); await page.mouse.move(x, y); }
    else if (op === 'js') console.log('JS', JSON.stringify(await page.evaluate(arg)));
    else if (op === 'key') await page.keyboard.press(arg);
    else if (op === 'wait') await page.waitForTimeout(+arg * 1000);
    else if (op === 'shot') await page.screenshot({ path: path.join(out, `${arg}.png`) });
    else if (op === 'text') console.log((await page.evaluate(() => document.body.innerText)).slice(0, 600));
    else throw new Error(`不認得的步驟：${s}`);
    await page.waitForTimeout(400);
  }
  await ctx.close();
})();
