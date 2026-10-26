// 用 D2R 官方字串表（enUS/zhTW/koKR 對照）預填譯文：遊戲的韓文是照官方韓文翻的，
// 所以「英文相同」且「韓文也與遊戲字典相同」就是同一條官方字串，直接取官方繁中。
// 英文相同但韓文不同時，只有在所有同英文條目的繁中都一致時才採用。
// 字串表來源：github.com/Wing924/d2r-wing 的 origin/data/local/lng/strings/*.json（不進 repo）
// 用法：node tools/prefill-official.mjs [字串表目錄]（省略時下載到系統暫存目錄）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkEntry } from './check.mjs';

const root = path.resolve(import.meta.dirname, '..');
const FILES = ['item-gems', 'item-modifiers', 'item-nameaffixes', 'item-names', 'item-runes', 'levels', 'mercenaries', 'monsters', 'npcs', 'objects', 'shrines', 'skills', 'ui'];
const SRC = 'https://raw.githubusercontent.com/Wing924/d2r-wing/HEAD/origin/data/local/lng/strings/';
let dir = process.argv[2];
if (!dir) {
  dir = path.join(os.tmpdir(), 'd2r-strings');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of FILES) {
    const p = path.join(dir, `${f}.json`);
    if (fs.existsSync(p)) continue;
    const r = await fetch(`${SRC}${f}.json`);
    if (!r.ok) throw new Error(`下載 ${f}.json 失敗：${r.status}`);
    fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
}
const clean = (s) => (s ?? '').replace(/ÿc./g, '').replace(/^\[[a-z]{2}\]/, '').trim();
const norm = (s) => clean(s).replace(/\s+/g, ' ').toUpperCase();

const byEn = new Map();
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
  const rows = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, ''));
  for (const r of rows) {
    if (!r.enUS || !r.zhTW || /\n/.test(r.enUS)) continue;
    const k = norm(r.enUS);
    if (!byEn.has(k)) byEn.set(k, []);
    byEn.get(k).push({ zh: clean(r.zhTW), ko: clean(r.koKR) });
  }
}

const game = path.join(root, 'game');
const ko = (await import(pathToFileURL(path.join(game, fs.readdirSync(game).find((n) => /^ko-.*\.js$/.test(n)))).href)).default;
const dictPath = path.join(root, 'i18n', 'zh-TW.json');
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
let strong = 0, unique = 0;
for (const [k, v] of Object.entries(ko)) {
  if (dict[k] || /[#*]/.test(k) || /^[a-z]+:/.test(k)) continue;
  const rows = byEn.get(norm(k));
  if (!rows) continue;
  const hit = rows.find((r) => r.ko === v.trim());
  const zhs = [...new Set(rows.map((r) => r.zh))];
  const zh = hit ? hit.zh : zhs.length === 1 ? zhs[0] : null;
  if (!zh || checkEntry(k, zh, v)) continue;
  dict[k] = zh;
  hit ? strong++ : unique++;
}
const sorted = Object.fromEntries(Object.keys(dict).sort().map((k) => [k, dict[k]]));
fs.writeFileSync(dictPath, JSON.stringify(sorted, null, 1) + '\n');
console.log(`官方預填：韓文吻合 ${strong} 條、英文唯一對應 ${unique} 條；字典共 ${Object.keys(sorted).length} 條`);
