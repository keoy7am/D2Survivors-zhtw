// 對照 D2R 官方字串表：遊戲字典裡「和官方同一句英文」（含 %d→# 的模板）的條目，譯文是否和官方一致
// 只列出不一致的，給人判斷（官方用語優先；遊戲自己改寫過的句子可能本來就不同）
// 用法：node tools/audit-official.mjs <官方字串表目錄> [輸出 json]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dir = process.argv[2];
const clean = (s) => (s ?? '').replace(/ÿc./g, '').replace(/^\[[a-z]{2}\]/, '').trim();
// 官方模板 → 遊戲字典的寫法：%d/%+d/%s → #、*；比對時不分大小寫、空白正規化
const toKey = (s) => clean(s).replace(/%\+?d%%/g, '#%').replace(/%\+?d/g, '#').replace(/%s/g, '*').replace(/%%/g, '%').replace(/\s+/g, ' ').toUpperCase();
const official = new Map();
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
  for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, ''))) {
    if (!r.enUS || !r.zhTW || /\n/.test(r.enUS)) continue;
    const k = toKey(r.enUS);
    if (!official.has(k)) official.set(k, { file: f, en: clean(r.enUS), zh: clean(r.zhTW) });
  }
}
const dict = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'zh-TW.json'), 'utf8'));
// 比較時去掉佔位符、空白、標點差異
const shape = (s) => s.replace(/\{\d+\}|%\+?d|%s|[#*]/g, '').replace(/[\s,，.。:：;；()（）%+\-]/g, '');
const diff = [];
for (const [k, v] of Object.entries(dict)) {
  if (/^[a-z]+:/.test(k)) continue;
  const o = official.get(k.replace(/\s+/g, ' ').toUpperCase());
  if (!o || shape(o.zh) === shape(v)) continue;
  diff.push({ k, ours: v, official: o.zh, file: o.file });
}
console.log(`和官方同句但譯文不同：${diff.length} 條`);
for (const d of diff.slice(0, 60)) console.log(`${d.k}\n  我們：${d.ours}\n  官方：${d.official}（${d.file}）`);
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(diff, null, 1));
