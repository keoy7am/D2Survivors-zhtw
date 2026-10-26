// 套用譯文修正：輸入 [{k, new}] 或 {英文: 繁中} 的 JSON，逐條過 check.mjs 才寫進 i18n/zh-TW.json
// 用法：node tools/apply-fixes.mjs <修正檔.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkEntry } from './check.mjs';

const root = path.resolve(import.meta.dirname, '..');
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const fixes = Array.isArray(input) ? input.map((f) => [f.k, f.new]) : Object.entries(input);
const game = path.join(root, 'game');
const ko = (await import(pathToFileURL(path.join(game, fs.readdirSync(game).find((n) => /^ko-.*\.js$/.test(n)))).href)).default;
const p = path.join(root, 'i18n', 'zh-TW.json');
const dict = JSON.parse(fs.readFileSync(p, 'utf8'));
const sp = path.join(root, 'i18n', 'site.json');
const site = JSON.parse(fs.readFileSync(sp, 'utf8'));
let n = 0;
const bad = [];
for (const [k, v] of fixes) {
  // 遊戲字典優先；網站層字串（site.json）用原譯當佔位符對照
  const [target, ref] = k in dict ? [dict, ko[k] ?? dict[k]] : k in site ? [site, site[k]] : [null];
  if (!target) { bad.push(`不在字典：${k}`); continue; }
  const e = checkEntry(k, v, ref);
  if (e) { bad.push(`${e}：${k} => ${v}`); continue; }
  if (target[k] !== v) { target[k] = v; n++; }
}
fs.writeFileSync(p, JSON.stringify(dict, null, 1) + '\n');
fs.writeFileSync(sp, JSON.stringify(site, null, 1) + '\n');
console.log(`套用 ${n} 條`);
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
