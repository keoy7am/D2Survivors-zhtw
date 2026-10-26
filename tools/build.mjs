// 由 game/（原版 JS）＋ i18n/zh-TW.json 產生擴充要用的檔案：
//   extension/zh-TW.js   繁中字典（取代遊戲的 ko 字典）
//   extension/rules.json 字典轉向規則
//   extension/meta.json  建置時的遊戲版本與覆蓋率
//   extension/site-dict.js 網站層文字
// 用法：node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { patchUi } from '../extension/patch-ui.js';
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

// ui 補丁在擴充執行期打（background.js），這裡只確認對目前版本打得上
patchUi(fs.readFileSync(path.join(game, uiFile), 'utf8'), uiFile);

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

// 字典不綁檔名：key 是英文原句，遊戲改版後舊譯文照用，新字串顯示原文。
// ui 的轉向是 background.js 依遊戲當下版本動態設定的，不在這裡。
const rules = [{
  id: 1, priority: 1,
  action: { type: 'redirect', redirect: { extensionPath: '/zh-TW.js' } },
  condition: { regexFilter: '^https://d2survivors\\.lol/assets/ko-[A-Za-z0-9_-]+\\.js$', resourceTypes: ['script'] },
}];
fs.writeFileSync(path.join(ext, 'rules.json'), JSON.stringify(rules, null, 2) + '\n');

const site = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'site.json'), 'utf8'));
fs.writeFileSync(path.join(ext, 'site-dict.js'), `// 由 tools/build.mjs 從 i18n/site.json 產生\nvar D2ZH_SITE = ${JSON.stringify(site)};\n`);

const total = Object.keys(ko).length;
const done = Object.keys(out).length;
fs.writeFileSync(path.join(ext, 'meta.json'), JSON.stringify({ ui: uiFile, ko: koFile, total, translated: done, builtAt: new Date().toISOString() }, null, 2) + '\n');
console.log(`ui=${uiFile} ko=${koFile} 覆蓋率 ${done}/${total} = ${(done / total * 100).toFixed(1)}%（舊版殘留 ${stale} 條）`);
