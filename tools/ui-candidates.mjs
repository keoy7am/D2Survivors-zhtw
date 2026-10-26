// 列出「短介面字串」給人工／模型審查情境誤譯（例：Report 被譯成「舉報」，實為回報問題按鈕）
// 排除：帶前綴的術語、能在 D2R 官方字串表精確對上的條目（官方譯名可信）、長句子
// 用法：node tools/ui-candidates.mjs <官方字串表目錄> <輸出目錄> [每批條數=150]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const [dir, out, size = '150'] = process.argv.slice(2);
const norm = (s) => (s ?? '').replace(/ÿc./g, '').replace(/^\[[a-z]{2}\]/, '').replace(/\s+/g, ' ').trim().toUpperCase();
const official = new Set();
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
  for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, ''))) if (r.enUS) official.add(norm(r.enUS));
}
const dict = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'zh-TW.json'), 'utf8'));
const site = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'site.json'), 'utf8'));
const gloss = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'glossary.json'), 'utf8'));
// 隨機稀有物品名（Death Needle、Bitter Flange）：一到兩個首字大寫的字、每個字都在術語表裡
const rareName = (k) => /^[A-Z][A-Za-z']+( [A-Z][A-Za-z']+)?$/.test(k) && k.split(' ').every((w) => gloss[w]);
const game = path.join(root, 'game');
const ko = (await import(pathToFileURL(path.join(game, fs.readdirSync(game).find((f) => /^ko-.*\.js$/.test(f)))).href)).default;
const pick = [];
for (const [k, v] of Object.entries(dict)) {
  if (/^[a-z]+:/.test(k) || k.length > 60 || official.has(norm(k)) || rareName(k)) continue;
  pick.push({ k, zh: v, ko: ko[k], src: 'game' }); // 韓文版由懂遊戲的人翻，是判斷語境的好線索
}
for (const [k, v] of Object.entries(site)) if (k.length <= 60) pick.push({ k, zh: v, src: 'site' });
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const n = +size;
for (let i = 0; i < pick.length; i += n) fs.writeFileSync(path.join(out, `ui-${String(i / n).padStart(3, '0')}.json`), JSON.stringify(pick.slice(i, i + n), null, 1));
console.log(`${pick.length} 條 → ${Math.ceil(pick.length / n)} 批`);
