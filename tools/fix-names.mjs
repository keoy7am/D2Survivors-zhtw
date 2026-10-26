// 把譯文裡的非官方譯名統一換成官方譯名（i18n/zh-TW.json 就地更新）
// 用法：node tools/fix-names.mjs
import fs from 'node:fs';
import path from 'node:path';

// 錯譯 → 官方（D2R 台灣繁中）
const FIX = {
  夏希: '恰西',
  凱莎: '卡夏',
  '德卡·凱恩': '迪卡‧凱恩',
  艾許拉: '艾席拉',
  安達利爾: '安達莉爾',
  督瑞爾: '都瑞爾',
};
const p = path.resolve(import.meta.dirname, '..', 'i18n', 'zh-TW.json');
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
let n = 0;
for (const k of Object.keys(d)) {
  let v = d[k];
  for (const [a, b] of Object.entries(FIX)) v = v.split(a).join(b);
  if (v !== d[k]) { d[k] = v; n++; }
}
fs.writeFileSync(p, JSON.stringify(d, null, 1) + '\n');
console.log(`改了 ${n} 條`);
