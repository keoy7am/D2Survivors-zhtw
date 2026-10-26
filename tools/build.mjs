// 由 game/（原版 JS）＋ i18n/zh-TW.json 產生擴充要用的檔案：
//   extension/ui.js      打過中文渲染補丁的 ui 模組
//   extension/zh-TW.js   繁中字典（取代遊戲的 ko 字典）
//   extension/rules.json 只轉向「這一版」的精確檔名
//   extension/meta.json  版本與覆蓋率
// 用法：node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { patchUi } from './patch-ui.mjs';
import { checkEntry } from './check.mjs';

const root = path.resolve(import.meta.dirname, '..');
const game = path.join(root, 'game');
const ext = path.join(root, 'extension');
const pick = (p) => {
  const l = fs.readdirSync(game).filter((n) => n.startsWith(p) && n.endsWith('.js'));
  if (l.length !== 1) throw new Error(`game/ 裡 ${p}*.js 有 ${l.length} 個，先跑 fetch-game.cjs`);
  return l[0];
};
const uiFile = pick('ui-');
const koFile = pick('ko-');

fs.writeFileSync(path.join(ext, 'ui.js'), patchUi(fs.readFileSync(path.join(game, uiFile), 'utf8'), uiFile));

const ko = (await import(pathToFileURL(path.join(game, koFile)).href)).default;
const zh = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'zh-TW.json'), 'utf8'));
const out = {};
const problems = [];
let stale = 0;
for (const [k, v] of Object.entries(zh)) {
  if (!(k in ko)) { stale++; continue; } // 舊版才有的字串，留著不刪，改版回來可能又用到
  const err = checkEntry(k, v, ko[k]);
  if (err) problems.push(`${err}：${k}`);
  else out[k] = v;
}
if (problems.length) {
  console.error(problems.slice(0, 30).join('\n'));
  console.error(`共 ${problems.length} 條不合格，已略過（遊戲會顯示英文）`);
}
const body = Object.entries(out).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',');
fs.writeFileSync(path.join(ext, 'zh-TW.js'), `var e={${body}};export{e as default};\n`);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rule = (id, file, to) => ({
  id, priority: 1,
  action: { type: 'redirect', redirect: { extensionPath: to } },
  condition: { regexFilter: `^https://d2survivors\\.lol/assets/${esc(file)}$`, resourceTypes: ['script'] },
});
fs.writeFileSync(path.join(ext, 'rules.json'), JSON.stringify([rule(1, koFile, '/zh-TW.js'), rule(2, uiFile, '/ui.js')], null, 2) + '\n');

const total = Object.keys(ko).length;
const done = Object.keys(out).length;
fs.writeFileSync(path.join(ext, 'meta.json'), JSON.stringify({ ui: uiFile, ko: koFile, total, translated: done, builtAt: new Date().toISOString() }, null, 2) + '\n');
console.log(`ui=${uiFile} ko=${koFile} 覆蓋率 ${done}/${total} = ${(done / total * 100).toFixed(1)}%（舊版殘留 ${stale} 條）`);
