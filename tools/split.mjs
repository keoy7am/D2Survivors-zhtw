// 把「遊戲字典裡還沒翻的 key」切成翻譯批次：i18n/todo/<分類>-NNN.json
// 每批是 [{k: 英文 key, ko?: 韓文參考（只在有佔位符時附上）}]
// 用法：node tools/split.mjs [每批條數=350]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const game = path.join(root, 'game');
const koFile = fs.readdirSync(game).find((n) => /^ko-.*\.js$/.test(n));
const ko = (await import(pathToFileURL(path.join(game, koFile)).href)).default;
const zh = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'zh-TW.json'), 'utf8'));
const size = +(process.argv[2] ?? 350);

const groups = { term: [], short: [], mid: [], long: [] };
for (const k of Object.keys(ko)) {
  if (zh[k]) continue;
  const g = /^[a-z]+:/.test(k) ? 'term' : k.length <= 30 ? 'short' : k.length <= 120 ? 'mid' : 'long';
  groups[g].push(k);
}
const dir = path.join(root, 'i18n', 'todo');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
let n = 0;
for (const [g, keys] of Object.entries(groups)) {
  for (let i = 0; i < keys.length; i += size) {
    const batch = keys.slice(i, i + size).map((k) => (/[#*]/.test(k) ? { k, ko: ko[k] } : { k }));
    fs.writeFileSync(path.join(dir, `${g}-${String(i / size).padStart(3, '0')}.json`), JSON.stringify(batch, null, 1));
    n++;
  }
  console.log(g, keys.length);
}
console.log(`${n} 批 → i18n/todo/`);
