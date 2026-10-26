// 把 extension/ 打包成 dist/d2survivors-zhtw-<版本>-<ui檔名>.zip，給朋友「載入未封裝項目」用
// 用法：npm run pack（Windows 用 PowerShell Compress-Archive，其他系統用 zip）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const ext = path.join(root, 'extension');
const { version } = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
const { ui } = JSON.parse(fs.readFileSync(path.join(ext, 'meta.json'), 'utf8'));
const out = path.join(root, 'dist', `d2survivors-zhtw-${version}-${ui.replace(/\.js$/, '')}.zip`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });

// 複製到暫存的 d2survivors-zhtw/ 再壓縮，解壓後是一個乾淨資料夾（不含 Chrome 產生的 _metadata）
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'd2zh-pack-'));
const dir = path.join(stage, 'd2survivors-zhtw');
fs.cpSync(ext, dir, { recursive: true, filter: (s) => !s.includes('_metadata') });
fs.copyFileSync(path.join(root, 'INSTALL.md'), path.join(dir, 'INSTALL.md'));
if (process.platform === 'win32') {
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${dir}' -DestinationPath '${out}'`]);
} else {
  execFileSync('zip', ['-qr', out, 'd2survivors-zhtw'], { cwd: stage });
}
fs.rmSync(stage, { recursive: true, force: true });
console.log(out);
