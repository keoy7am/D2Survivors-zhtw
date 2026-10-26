// 驗證一批譯文：node tools/verify-batch.mjs <批名>（例：short-003）
// 對帳 i18n/todo/<批名>.json 與 i18n/done/<批名>.json：key 集合相等、每條過 check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkEntry } from './check.mjs';

const root = path.resolve(import.meta.dirname, '..');
const name = process.argv[2];
const todo = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'todo', `${name}.json`), 'utf8'));
let done;
try {
  done = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'done', `${name}.json`), 'utf8'));
} catch (e) {
  console.error(`讀不到或不是合法 JSON：${e.message}`);
  process.exit(1);
}
const game = path.join(root, 'game');
const ko = (await import(pathToFileURL(path.join(game, fs.readdirSync(game).find((n) => /^ko-.*\.js$/.test(n)))).href)).default;

const errs = [];
const want = new Set(todo.map((t) => t.k));
for (const k of want) {
  if (!(k in done)) { errs.push(`缺 key：${k}`); continue; }
  const e = checkEntry(k, done[k], ko[k]);
  if (e) errs.push(`${e}：${k} => ${done[k]}`);
}
for (const k of Object.keys(done)) if (!want.has(k)) errs.push(`多出不在本批的 key（可能被改過字）：${k}`);
if (errs.length) {
  console.error(errs.slice(0, 40).join('\n'));
  console.error(`\n${name}：${errs.length} 個問題`);
  process.exit(1);
}
console.log(`${name}：${want.size} 條全部通過`);
