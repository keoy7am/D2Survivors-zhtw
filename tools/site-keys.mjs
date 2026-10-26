// 列出網站層（選單、頁尾、首頁）的 data-t 英文字串，對帳 i18n/site.json 還缺哪些
// 這些字串不在遊戲字典裡，而是寫死在 site-*.js、landing-*.js 的 {en:{…},ko:{…}} 物件
// 用法：node tools/site-keys.mjs <js 檔>...
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const have = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'site.json'), 'utf8'));
const en = {};
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(f, 'utf8');
  // 物件字面值：en:{key:`值`,…} —— 值是不含反引號的 template literal
  for (const m of s.matchAll(/\ben:\{((?:\w+:`[^`]*`,?)+)\}/g))
    for (const kv of m[1].matchAll(/(\w+):`([^`]*)`/g)) en[kv[1]] = kv[2];
}
const missing = Object.keys(en).filter((k) => !have[k]);
console.log(JSON.stringify(Object.fromEntries(missing.map((k) => [k, en[k]])), null, 1));
console.error(`共 ${Object.keys(en).length} 個 key，缺 ${missing.length}`);
