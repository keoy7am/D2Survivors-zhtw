// 術語一致性稽核：英文 key 含術語表裡的專有名詞（整個字、首字大寫），譯文卻沒用術語表譯名
// 只看「多字或長名詞」，避免 Bone、Blood 這類普通字誤報。
// 用法：node tools/audit-terms.mjs [輸出 json 路徑]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dict = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'zh-TW.json'), 'utf8'));
const gloss = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'glossary.json'), 'utf8'));
const terms = Object.entries(gloss)
  .filter(([en, zh]) => /^[A-Z]/.test(en) && (en.includes(' ') || en.length >= 6) && zh && !/[A-Za-z]/.test(zh))
  .sort((a, b) => b[0].length - a[0].length);
const hits = [];
const byTerm = {};
for (const [k, v] of Object.entries(dict)) {
  if (/^[a-z]+:/.test(k)) continue;
  for (const [en, zh] of terms) {
    if (!new RegExp(`(^|[^A-Za-z'])${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z'])`).test(k)) continue;
    if (v.includes(zh)) continue;
    hits.push({ k, v, term: en, want: zh });
    byTerm[en] = (byTerm[en] ?? 0) + 1;
  }
}
const top = Object.entries(byTerm).sort((a, b) => b[1] - a[1]).slice(0, 40);
console.log(top.map(([t, n]) => `${n}\t${t} → ${gloss[t]}`).join('\n'));
console.log(`共 ${hits.length} 處（${Object.keys(byTerm).length} 個術語）`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(hits, null, 1));
