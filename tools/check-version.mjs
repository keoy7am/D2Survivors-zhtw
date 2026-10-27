// 版本號守門：extension/ 和「目前 manifest 版本」的已發佈 tag 內容不同 → 失敗
// 同一個版本號不能同時代表兩份程式（owner 2026-10-27）：改了擴充就先調版本號，再推送或打包給 owner 測。
// meta.json 每次建置都會改 builtAt，不算。版本號沒有對應 tag（還沒發佈）就通過。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const tag = `v${version}`;
if (!git('tag', '-l', tag)) {
  console.log(`version ok（${version} 尚未發佈）`);
} else {
  const changed = git('diff', '--name-only', tag, '--', 'extension', ':!extension/meta.json');
  if (changed) {
    console.error(`extension/ 和已發佈的 ${tag} 不同，但 manifest 版本仍是 ${version}：先調版本號（問 owner）。\n${changed}`);
    process.exit(1);
  }
  console.log(`version ok（${version} 與 ${tag} 相同）`);
}
