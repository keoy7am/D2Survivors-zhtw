// 列出網站層（選單、頁尾、首頁、排行榜）的英文字串，對帳 i18n/site.json 還缺哪些
// 這些字串不在遊戲字典裡，而是寫死在網站腳本的 {en:{…},ko:{…}} 物件
// 用法：node tools/site-keys.mjs game/*.js   （stdout：缺的 {英文原文: ""}，翻好併入 i18n/site.json）
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const have = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'site.json'), 'utf8'));

// 物件字面值：lang:{key:`值`,…} —— 值是不含反引號的 template literal；含函式的物件只取得到前面那段
export function langDicts(src, lang) {
  const out = [];
  for (const m of src.matchAll(new RegExp(`\\b${lang}:\\{((?:\\w+:\`[^\`]*\`,?)+)`, 'g'))) {
    const d = {};
    for (const kv of m[1].matchAll(/(\w+):`([^`]*)`/g)) d[kv[1]] = kv[2];
    out.push(d);
  }
  return out;
}

// i18n/site.json 以英文原文為 key（不同物件常有同名 key 代表不同句子）
if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  const all = new Set();
  for (const f of process.argv.slice(2)) {
    if (/[\\/]ko-[^\\/]*\.js$/.test(f)) continue;
    for (const d of langDicts(fs.readFileSync(f, 'utf8'), 'en')) for (const v of Object.values(d)) all.add(v);
  }
  const missing = [...all].filter((v) => !have[v]);
  console.log(JSON.stringify(Object.fromEntries(missing.map((v) => [v, ''])), null, 1));
  console.error(`共 ${all.size} 句，缺 ${missing.length}`);
}
