// 把 i18n/done/*.json 中「通過驗證」的批次併入 i18n/zh-TW.json（唯一的譯文來源）
// 驗證沒過的批次整批略過並列出，不會半套寫入。
// 用法：node tools/merge.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const doneDir = path.join(root, 'i18n', 'done');
const dictPath = path.join(root, 'i18n', 'zh-TW.json');
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
const before = Object.keys(dict).length;
const bad = [];
let merged = 0;
for (const f of fs.existsSync(doneDir) ? fs.readdirSync(doneDir).filter((n) => n.endsWith('.json')).sort() : []) {
  const name = f.replace(/\.json$/, '');
  if (!fs.existsSync(path.join(root, 'i18n', 'todo', f))) { bad.push(`${name}（todo 裡沒有這批，可能是舊的）`); continue; }
  try {
    execFileSync(process.execPath, [path.join(root, 'tools', 'verify-batch.mjs'), name], { stdio: 'pipe' });
  } catch {
    bad.push(name);
    continue;
  }
  Object.assign(dict, JSON.parse(fs.readFileSync(path.join(doneDir, f), 'utf8')));
  merged++;
}
const sorted = Object.fromEntries(Object.keys(dict).sort().map((k) => [k, dict[k]]));
fs.writeFileSync(dictPath, JSON.stringify(sorted, null, 1) + '\n');
console.log(`併入 ${merged} 批；字典 ${before} → ${Object.keys(sorted).length} 條`);
if (bad.length) { console.error(`略過（驗證未過）：${bad.join(', ')}`); process.exit(1); }
