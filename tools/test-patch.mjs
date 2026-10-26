// 補丁自我檢查：斷行行為＋對 game/ 裡目前版本的 ui 打得上
// 用法：node tools/test-patch.mjs
import fs from 'node:fs';
import path from 'node:path';
import { HELPERS, WRAP, patchUi, patchTranslate } from '../extension/patch-ui.js';

const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
// 只拼本檔與 patch-ui.js 的常數，沒有外部輸入
const Font = new Function(`${HELPERS}; return class{measure(s){return [...s].length}${WRAP}}`)();
const f = new Font();
eq(f.wrapLines('hello big world', 9), ['hello big', 'world']); // 英文照舊在空白斷
eq(f.wrapLines('一二三四五六', 4), ['一二三四', '五六']); // 中文字之間可斷
eq(f.wrapLines('一二三，四五', 3), ['一二', '三，四', '五']); // 逗號不放行首
eq(f.wrapLines('（一二）三四', 4), ['（一二）', '三四']); // 括號跟著字走
eq(f.wrapLines('火焰抗性 +30%', 7), ['火焰抗性', '+30%']);
eq(f.wrapLines('a\n\nb', 9), ['a', '', 'b']);

let threw = false;
try { patchUi('import{a}from"./x.js";var y=1;', 'ui-x.js'); } catch { threw = true; }
eq(threw, true); // 結構不符必須丟錯，不能靜默產出半套補丁

const game = path.resolve(import.meta.dirname, '..', 'game');

// 翻譯器補丁：拿 game/ 裡真的 translate-*.js 打補丁後載入，驗行為
const tr = fs.existsSync(game) && fs.readdirSync(game).find((n) => /^translate-.*\.js$/.test(n));
if (tr) {
  const code = patchTranslate(fs.readFileSync(path.join(game, tr), 'utf8'), tr);
  const { t: Translator } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  // 含真字典裡會搶先命中的模板「Act *」（曾讓地區標題變成「第 I: … 章」）
  const T = new Translator([{ Character: '角色', 'Act I': '第一章', 'Act *': '第 {0} 章', 'The Sightless Eye': '無目之眼', 'Blood Moor': '鮮血荒地', 'Inventory (I)': '物品欄 (I)' }]);
  eq(T.translate('Character (C)'), '角色 (C)'); // 快捷鍵後綴
  eq(T.translate('Inventory (I)'), '物品欄 (I)'); // 字典有整句時照字典
  eq(T.translate('Act I: The Sightless Eye. Blood Moor'), '第一章: 無目之眼 · 鮮血荒地'); // 「. 」拼接
  eq(T.translate('點擊拾取 · Shift＋點擊出售'), '點擊拾取 · Shift＋點擊出售');
  eq(globalThis.__d2zhMissing.has('點擊拾取 · Shift＋點擊出售'), false); // 已是中文的不算漏翻
  eq(T.translate('10월 26일'), '10月26日'); // 韓文日期
  eq(T.translate('Totally Unknown Thing'), 'Totally Unknown Thing');
  eq(globalThis.__d2zhMissing.has('Totally Unknown Thing'), true); // 漏翻紀錄
  eq(globalThis.__d2zhMissing.has('Character (C)'), false);
  console.log(`translate patch ok（${tr}）`);
}

const ui = fs.existsSync(game) && fs.readdirSync(game).find((n) => /^ui-.*\.js$/.test(n));
if (ui) {
  const out = patchUi(fs.readFileSync(path.join(game, ui), 'utf8'), ui);
  if (/from"\.\//.test(out)) throw new Error('還有相對 import');
  console.log(`patch ok（${ui}）`);
} else console.log('patch ok（game/ 不存在，略過真檔）');
