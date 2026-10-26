// 對帳：擴充裡的字典解析器 vs 直接 import 遊戲字典，key 必須完全一致
// 用法：node tools/test-dict-keys.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { dictKeys } from '../extension/dict-keys.js';

const game = path.resolve(import.meta.dirname, '..', 'game');
const f = path.join(game, fs.readdirSync(game).find((n) => /^ko-.*\.js$/.test(n)));
const want = Object.keys((await import(pathToFileURL(f).href)).default);
const got = dictKeys(fs.readFileSync(f, 'utf8'));
if (JSON.stringify(got) !== JSON.stringify(want)) {
  const i = got.findIndex((k, j) => k !== want[j]);
  throw new Error(`不一致：解析 ${got.length} 條／實際 ${want.length} 條，第 ${i} 條 ${JSON.stringify(got[i])} vs ${JSON.stringify(want[i])}`);
}
const tricky = dictKeys(String.raw`var e={"a\"b":` + '`x\\`y`' + String.raw`,'c\'d"':"d\"e",Id:'z',"é\n":'q'};export{e as default};`);
const want2 = ['a"b', `c'd"`, 'Id', 'é\n'];
if (JSON.stringify(tricky) !== JSON.stringify(want2)) throw new Error('跳脫字元處理錯：' + JSON.stringify(tricky));
console.log(`dict-keys ok（${got.length} 條）`);
