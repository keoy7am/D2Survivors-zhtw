import { isNewer, RELEASES, checkUpdate } from './update.js';

const $ = (id) => document.getElementById(id);
const ISSUES = 'https://github.com/keoy7am/D2Survivors-zhtw/issues';
// 回報表單預填的版本資訊（.github/ISSUE_TEMPLATE 的欄位 id）；只放版本，不放任何個人資料
const info = { 'ext-version': chrome.runtime.getManifest().version };

(async () => {
  const meta = await (await fetch('meta.json')).json();
  const s = await chrome.storage.local.get(['seen', 'off', 'disabled', 'cov', 'patchError', 'update', 'perf']);
  const seen = s.seen ?? {};
  showPerf(s.perf);
  saved = JSON.stringify(readPerf());
  checkPerf(s.perf);
  showUpdate(s.update);
  $('ext-ver').textContent = `v${info['ext-version']}`;
  $('off').checked = !!s.off;
  if (s.disabled) {
    $('state').className = 'warn';
    $('state').textContent = `遊戲改版後中文渲染補丁打不上，已暫時改回英文，請等擴充更新。（${s.patchError ?? ''}）`;
  } else {
    $('state').textContent = s.off ? '已停用' : '翻譯運作中';
    $('state').title = '沒翻到的字串顯示原文';
  }
  if (s.cov) {
    $('cov').textContent = `覆蓋率 ${((s.cov.covered / s.cov.total) * 100).toFixed(1)}%`;
    $('cov').title = `${s.cov.covered} / ${s.cov.total} 條`;
  } else {
    $('cov').textContent = '覆蓋率：開一次遊戲後計算';
  }
  const changed = (seen['ui-'] && seen['ui-'] !== meta.files['ui-']) || (seen['ko-'] && seen['ko-'] !== meta.files['ko-']);
  info['game-version'] = `${seen['ui-'] ?? '未開過遊戲'}；覆蓋率 ${s.cov ? `${s.cov.covered}/${s.cov.total}` : '未計算'}；效能 ${describePerf(s.perf)}`;
  $('ver').textContent = `遊戲版本 ${seen['ui-'] ?? '（尚未開過遊戲）'}；譯文建置於 ${meta.builtAt.slice(0, 10)}${changed ? '，之後遊戲有改版，新字串會顯示原文' : ''}`;
})();

// 有新版時在最上方顯示下載連結（自動檢查或按「檢查更新」）
function showUpdate(u) {
  const box = $('update');
  box.replaceChildren();
  box.hidden = !(u?.latest && isNewer(u.latest, info['ext-version']));
  if (box.hidden) return false;
  box.append(`有新版 v${u.latest}（目前 v${info['ext-version']}）：`, Object.assign(document.createElement('a'), {
    href: '#', textContent: '下載',
    onclick: (e) => { e.preventDefault(); chrome.tabs.create({ url: u.url || RELEASES }); },
  }), '，解壓覆蓋舊資料夾後到 chrome://extensions 按重新載入。');
  return true;
}
$('check-update').addEventListener('click', async () => {
  $('check-update').disabled = true;
  $('msg').textContent = '檢查更新中…';
  const r = await checkUpdate(Date.now(), true);
  const { update } = await chrome.storage.local.get('update');
  $('msg').textContent = r.error ? `檢查失敗：${r.error}（稍後再試）`
    : showUpdate(update) ? `有新版 v${r.latest}，下載連結在最上方。` : `已是最新版（v${info['ext-version']}）。`;
  $('check-update').disabled = false;
});

$('off').addEventListener('change', (e) => chrome.storage.local.set({ off: e.target.checked }));

// 效能設定 perf = { res, nolights, noshadows, fps }：res／nolights／noshadows 是遊戲內建的網址參數，fps 是擴充額外限制。
// 原生、極致兩個按鈕只是把選項一次填好，之後仍可逐項調整
const PRESETS = {
  'p-native': { res: 0.75, nolights: true, noshadows: true, fps: null },
  'p-max': { res: 0.5, nolights: true, noshadows: true, fps: 60 },
  'p-reset': { res: null, nolights: false, noshadows: false, fps: null },
};
function showPerf(p) {
  if (p === true) p = PRESETS['p-native']; // 1.3.0 的單一開關
  $('res').value = p?.res ? String(p.res) : '';
  $('nolights').checked = !!p?.nolights;
  $('noshadows').checked = !!p?.noshadows;
  $('fps').value = p?.fps ? String(p.fps) : '';
}
function describePerf(p) {
  if (p === true) p = PRESETS['p-native'];
  const on = [p?.res && `解析度 ${p.res}`, p?.nolights && '關光照', p?.noshadows && '關陰影', p?.fps && `${p.fps} FPS`].filter(Boolean);
  return on.length ? on.join('、') : '預設';
}
const readPerf = () => ({
  res: Number($('res').value) || null,
  nolights: $('nolights').checked,
  noshadows: $('noshadows').checked,
  fps: Number($('fps').value) || null,
});
// 解析度、光照、陰影遊戲只在載入時讀一次，一定要重新整理：選項先填好，按「套用」才存（遊戲頁只重新整理一次）
let saved = null; // 已套用的設定（JSON），popup 打開時由 showPerf 後記下
const dirty = () => {
  const changed = JSON.stringify(readPerf()) !== saved;
  $('p-apply').disabled = !changed;
  $('perf-note').textContent = changed ? '尚未套用' : '';
};
for (const id of ['res', 'nolights', 'noshadows', 'fps']) $(id).addEventListener('change', dirty);
for (const [id, p] of Object.entries(PRESETS)) $(id).addEventListener('click', () => { showPerf(p); dirty(); });
// 確認效能設定真的生效：問目前分頁的遊戲頁（main-world.js 量），沒生效就說原因
const norm = (p) => {
  if (p === true) p = PRESETS['p-native'];
  return JSON.stringify({ res: p?.res || null, nolights: !!p?.nolights, noshadows: !!p?.noshadows, fps: p?.fps || null });
};
async function checkPerf(stored) {
  const p = JSON.parse(norm(stored));
  const say = (cls, text) => { $('perf-status').className = `row ${cls}`; $('perf-status').textContent = text; };
  if (!p.res && !p.nolights && !p.noshadows && !p.fps) { say('', ''); return; }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!/^https:\/\/d2survivors\.lol\/play\/(index\.html)?([?#]|$)/.test(tab?.url ?? '')) {
    say('dim', '在遊戲頁點擴充圖示，可以確認設定是否生效。');
    return;
  }
  say('dim', '確認設定是否生效中…');
  let r = null;
  try { r = await chrome.tabs.sendMessage(tab.id, 'perfStatus'); } catch {}
  if (!r) { say('warn', '⚠ 無法確認：遊戲頁還在載入，或擴充剛更新（重新整理遊戲頁再試）。'); return; }
  if (norm(r.perf) !== norm(p)) { say('warn', '⚠ 遊戲頁還在用舊設定：重新整理遊戲頁後生效。'); return; }
  const native = p.res || p.nolights || p.noshadows;
  if (native && !r.files) { say('warn', '⚠ 還沒選過遊戲檔案：解析度、光照、陰影要在遊戲設定頁選好檔案後才會生效。'); return; }
  const done = [];
  if (p.res) {
    if (r.ratio === null || Math.abs(r.ratio - p.res) > 0.03) {
      say('warn', `⚠ 解析度沒有生效（設定 ${p.res}，實際 ${r.ratio?.toFixed(2) ?? '量不到'}）：遊戲可能改版了，請回報。`);
      return;
    }
    done.push(`解析度 ${p.res}`);
  }
  // 光照、陰影和解析度是遊戲同一次從網址讀入的，看不到畫面就以解析度生效為準
  if (p.nolights) done.push('關光照');
  if (p.noshadows) done.push('關陰影');
  if (p.fps) {
    if (r.fps > p.fps * 1.15) { say('warn', `⚠ 畫面上限沒有生效（設定 ${p.fps}，實際每秒 ${r.fps} 次）。`); return; }
    done.push(`畫面上限 ${p.fps}（實際每秒 ${r.fps} 次）`);
  }
  say('ok', `✓ 已生效：${done.join('、')}`);
}

$('p-apply').addEventListener('click', async () => {
  const p = readPerf();
  await chrome.storage.local.set({ perf: p });
  saved = JSON.stringify(p);
  dirty();
  $('perf-note').textContent = '已套用';
  $('perf-status').className = 'row dim';
  $('perf-status').textContent = '遊戲頁重新整理後，再點一次擴充圖示可以確認是否生效。';
});

// 匯出：字典沒翻的 key ＋ 目前分頁遊戲執行中查不到翻譯的字串（快捷鍵提示、遊戲從 D2 檔案讀出的文字等）
$('export').addEventListener('click', async () => {
  $('msg').textContent = '計算中…';
  const r = await chrome.runtime.sendMessage('missing');
  if (r.error) { $('msg').textContent = `失敗：${r.error}`; return; }
  let runtime = [];
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    runtime = (await chrome.tabs.sendMessage(tab.id, 'runtimeMissing')) ?? [];
  } catch {} // 目前分頁不是遊戲頁
  const keys = [...new Set([...r.missing, ...runtime])];
  // 格式與 i18n/todo 批次相同，可以直接丟給翻譯流程
  const blob = new Blob([JSON.stringify(keys.map((k) => ({ k })), null, 1)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `d2zh-missing-${r.koName.replace(/\.js$/, '')}.json` });
  a.click();
  $('msg').textContent = `已匯出 ${keys.length} 條（字典 ${r.missing.length}、遊戲畫面 ${runtime.length}），可在回報時附上這個檔案`;
});

$('report').addEventListener('click', () => {
  chrome.tabs.create({ url: `${ISSUES}/new?${new URLSearchParams({ template: 'translation.yml', ...info })}` });
});
$('report-other').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${ISSUES}/new?${new URLSearchParams({ template: 'bug.yml', ...info })}` });
});
