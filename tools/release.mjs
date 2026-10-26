// 發佈：設版本 → 打包 → commit → tag → push → GitHub Release（附 zip、改版內容）
// 用法：node tools/release.mjs <版本，如 0.1.0> <改版內容檔（Markdown，當 Release 內文）>
// 前置：工作區乾淨、在 main、已和 origin 同步；版本號由 owner 指定，tag 已存在就中止。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const [version, notes] = process.argv.slice(2);
const sh = (cmd, args, opt = {}) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', ...opt }).trim();
const die = (m) => { console.error(m); process.exit(1); };

if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) die('版本格式要像 0.1.0');
if (!notes || !fs.existsSync(notes) || !fs.readFileSync(notes, 'utf8').trim()) die('缺改版內容檔');
const tag = `v${version}`;
if (sh('git', ['branch', '--show-current']) !== 'main') die('不在 main');
if (sh('git', ['status', '--porcelain'])) die('工作區有未提交的變更');
sh('git', ['fetch', '-q', 'origin']);
if (sh('git', ['rev-parse', 'HEAD']) !== sh('git', ['rev-parse', 'origin/main'])) die('main 和 origin/main 不同步');
if (sh('git', ['tag', '-l', tag])) die(`tag ${tag} 已存在`);

const mf = path.join(root, 'extension', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
if (manifest.version !== version) {
  manifest.version = version;
  fs.writeFileSync(mf, JSON.stringify(manifest, null, 2) + '\n');
  sh('git', ['add', mf]);
  sh('git', ['commit', '-q', '-m', `Release ${tag}`]);
}
const zip = sh(process.execPath, [path.join(root, 'tools', 'pack.mjs')]).split('\n').pop();
sh('git', ['tag', '-a', tag, '-m', tag]);
sh('git', ['push', '-q', 'origin', 'main', tag], { stdio: 'inherit' });
const url = sh('gh', ['release', 'create', tag, zip, '--title', `D2 Survivors 繁中 ${tag}`, '--notes-file', notes]);
console.log(url);
