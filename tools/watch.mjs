// 遊戲改版偵測（不用瀏覽器、不用 Claude）：從 /play/ 的 HTML 沿著模組引用找出目前的
// ui-*.js、translate-*.js、ko-*.js 檔名，和 extension/meta.json（上次建置對應的版本）比對。
// 用法：node tools/watch.mjs   結束碼 0＝沒變、10＝遊戲改版了（該跑 /game-update）、1＝偵測失敗（網路、結構變了）
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://d2survivors.lol';
const root = path.resolve(import.meta.dirname, '..');
const meta = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'meta.json'), 'utf8'));
const WANT = ['ui-', 'translate-', 'ko-'];

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'd2survivors-zhtw-watch' }, cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} 回 ${r.status}`);
  return r.text();
}

try {
  const html = await get(`${ORIGIN}/play/`);
  const queue = [...new Set([...html.matchAll(/assets\/([\w.-]+\.js)/g)].map((m) => m[1]))];
  const seen = new Set(queue);
  const found = {};
  // 沿著 import／動態 import 的字串引用走；字典本身（ko-）很大，只記檔名不下載
  for (let i = 0; i < queue.length && i < 120; i++) {
    const name = queue[i];
    for (const p of WANT) if (name.startsWith(p)) found[p] ??= name;
    if (WANT.every((p) => found[p])) break;
    if (name.startsWith('ko-') || name.startsWith('en-')) continue;
    const js = await get(`${ORIGIN}/assets/${name}`);
    for (const m of js.matchAll(/["'`]\.\/([\w.-]+\.js)["'`]/g)) if (!seen.has(m[1])) { seen.add(m[1]); queue.push(m[1]); }
  }
  const missing = WANT.filter((p) => !found[p]);
  if (missing.length) throw new Error(`找不到 ${missing.join('、')} 開頭的檔案（掃了 ${Math.min(queue.length, 120)} 個模組），網站結構可能變了`);
  const changed = WANT.filter((p) => found[p] !== meta.files[p]);
  console.log(JSON.stringify({ changed: changed.length > 0, current: found, built: meta.files, at: new Date().toISOString() }));
  process.exitCode = changed.length ? 10 : 0;
} catch (e) {
  console.error(`偵測失敗：${e.message ?? e}`);
  process.exitCode = 1;
}
