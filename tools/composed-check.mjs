// 組合字串檢查：遊戲在執行中用「名稱＋片段」組出來的句子（寶箱獎勵、升級提示…）字典沒有整句，
// 要靠遊戲翻譯器的模板（# 數字、* 任意片段）才翻得到。這裡把 game/ 的技能／被動名稱代入各句型，
// 用遊戲真正的翻譯器（含擴充補丁）＋ extension/zh-TW.js 翻一次，列出還是英文的句型。
// 用法：node tools/composed-check.mjs   （先 npm run fetch、npm run build）
import fs from 'node:fs';
import path from 'node:path';
import { patchTranslate } from '../extension/patch-ui.js';

const root = path.resolve(import.meta.dirname, '..');
const game = path.join(root, 'game');
const file = (re) => fs.readdirSync(game).find((n) => re.test(n));
const tr = file(/^translate-.*\.js$/);
const code = patchTranslate(fs.readFileSync(path.join(game, tr), 'utf8'), tr);
const { t: Translator } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const zh = (await import('data:text/javascript;base64,' + fs.readFileSync(path.join(root, 'extension', 'zh-TW.js')).toString('base64'))).default;
const T = new Translator([zh]);

// 技能、被動、技能樹分頁名稱：keepSave 的資料表裡 name:`…`（含物品等其他名稱也無妨，只用來代入句型）
const ks = fs.readFileSync(path.join(game, file(/^keepSave-.*\.js$/)), 'utf8');
const names = [...new Set([...ks.matchAll(/name:`([A-Z][A-Za-z' -]{2,40})`/g)].map((m) => m[1]))].filter((n) => zh[n] !== undefined);

// 句型：寶箱獎勵（keepSave 的 `${d.title} ${f}`，f＝`level N` 或小寫的副標題）與其他已知的組合句
const shapes = [
  (n) => `${n} level 3`,
  (n) => `${n} replaces ${names[1].toLowerCase()}`,
  (n) => `${n} evolve ${names[2].toLowerCase()} into ${n.toLowerCase()}`,
  (n) => `+1 to ${n} 2 of 3`,
  (n) => `${n} evolved into ${names[3]}!`,
  // 寶箱摘要（screens 的「From the chests: 」逐項接 `, `、最後一項接 `.`；引擎一次剝掉 `!.` 兩個標點）
  (n) => `${n} evolved into ${names[3]}!.`,
  (n) => `${n} evolved into ${names[3]}!, `,
  (n) => `Level 3 ${n}`,
  // 局內技能列表（`${名稱} ${等級}${ (+加成)}${ - ready to evolve}`；進化後的技能沒有等級）
  (n) => `${n} 8 (+2) - ready to evolve`,
  (n) => `${n} 8 - ready to evolve`,
  (n) => `${n} (+2) - ready to evolve`,
];
const fixed = ['Full Rejuvenation Potion everything is maxed', 'Gold everything is maxed', '+5 stat points to spend', '37 gold', 'Stat points at the cap for level 12'];
const latin = (s) => /[A-Za-z]{3,}/.test(s.replace(/\b(DPS|MF|XP|FPS|D2R?|Shift|Ctrl|Esc)\b/g, ''));

let bad = 0;
for (const [i, shape] of shapes.entries()) {
  const miss = names.filter((n) => latin(T.translate(shape(n))));
  const ex = shape(names[0]);
  console.log(`${miss.length ? '✗' : '✓'} 句型 ${i + 1}「${ex}」→「${T.translate(ex)}」${miss.length ? `：${miss.length}/${names.length} 個名稱翻不出（例：${miss.slice(0, 3).join('、')}）` : ''}`);
  if (miss.length) bad++;
}
for (const s of fixed) {
  const out = T.translate(s);
  console.log(`${latin(out) ? '✗' : '✓'}「${s}」→「${out}」`);
  if (latin(out)) bad++;
}
// 升級商店超過最高階的效果：keepSave 把升級的 endless 文字裡的數字乘上倍率（常有小數）、以換行拆開逐行翻
const endless = [...ks.matchAll(/endless:`([^`]*)`/g), ...ks.matchAll(/\(`(?:strength|dexterity|vitality|energy)`,`[^`]*`,`([^`]*)`\)/g)]
  .map((m) => m[1].replace(/\\n/g, '\n').replace(/\$\{[^}]*\}/g, '4'));
const shopMiss = new Set();
for (const e of endless) for (const k of [0.2, 0.01, 12.34]) for (const line of e.replace(/\d+(\.\d+)?/g, (t) => String(+(t * k).toFixed(2))).split('\n'))
  if (latin(T.translate(line))) shopMiss.add(line.replace(/\d+(\.\d+)?/g, '#'));
console.log(`${shopMiss.size ? '✗' : '✓'} 升級商店超過最高階的效果 ${endless.length} 條${shopMiss.size ? `：${[...shopMiss].join('、')}` : ''}`);
if (!endless.length || shopMiss.size) bad++;
console.log(`名稱 ${names.length} 個；${bad ? `${bad} 種句型有缺` : '全部翻得到'}`);
process.exitCode = bad ? 1 : 0;
