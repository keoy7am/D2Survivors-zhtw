import { isNewer, RELEASES } from './update.js';

const $ = (id) => document.getElementById(id);
const ISSUES = 'https://github.com/keoy7am/D2Survivors-zhtw/issues';
// 回報表單預填的版本資訊（.github/ISSUE_TEMPLATE 的欄位 id）；只放版本，不放任何個人資料
const info = { 'ext-version': chrome.runtime.getManifest().version };

(async () => {
  const meta = await (await fetch('meta.json')).json();
  const s = await chrome.storage.local.get(['seen', 'off', 'disabled', 'cov', 'patchError', 'update', 'perf']);
  const seen = s.seen ?? {};
  showPerf(s.perf);
  if (s.update?.latest && isNewer(s.update.latest, info['ext-version'])) {
    $('update').hidden = false;
    $('update').append(`有新版 v${s.update.latest}（目前 v${info['ext-version']}）：`, Object.assign(document.createElement('a'), {
      href: '#', textContent: '下載',
      onclick: (e) => { e.preventDefault(); chrome.tabs.create({ url: s.update.url || RELEASES }); },
    }), '，解壓覆蓋舊資料夾後到 chrome://extensions 按重新載入。');
  }
  $('off').checked = !!s.off;
  if (s.disabled) {
    $('state').className = 'row warn';
    $('state').textContent = `遊戲改版後中文渲染補丁打不上，已暫時改回英文，請等擴充更新。（${s.patchError ?? ''}）`;
  } else {
    $('state').textContent = s.off ? '已停用' : '翻譯運作中（沒翻到的字串顯示原文）';
  }
  if (s.cov) {
    const pct = ((s.cov.covered / s.cov.total) * 100).toFixed(1);
    $('cov').textContent = `覆蓋率 ${pct}%（${s.cov.covered} / ${s.cov.total} 條）`;
  } else {
    $('cov').textContent = '覆蓋率：打開一次遊戲後才會計算';
  }
  const changed = (seen['ui-'] && seen['ui-'] !== meta.files['ui-']) || (seen['ko-'] && seen['ko-'] !== meta.files['ko-']);
  info['game-version'] = `${seen['ui-'] ?? '未開過遊戲'}；覆蓋率 ${s.cov ? `${s.cov.covered}/${s.cov.total}` : '未計算'}；效能 ${describePerf(s.perf)}`;
  $('ver').textContent = `遊戲版本 ${seen['ui-'] ?? '（尚未開過遊戲）'}；譯文建置於 ${meta.builtAt.slice(0, 10)}${changed ? '，之後遊戲有改版，新字串會顯示原文' : ''}`;
})();

$('off').addEventListener('change', (e) => chrome.storage.local.set({ off: e.target.checked }));

// 效能設定 perf = { res, nolights, noshadows, fps }：res／nolights／noshadows 是遊戲內建的網址參數，fps 是擴充額外限制。
// 原生、極致兩個按鈕只是把選項一次填好，之後仍可逐項調整
const PRESETS = {
  'p-native': { res: 0.75, nolights: true, noshadows: true, fps: null },
  'p-max': { res: 0.5, nolights: true, noshadows: true, fps: 60 },
  'p-reset': { res: null, nolights: false, noshadows: false, fps: null },
};
function showPerf(p) {
  $('res').value = p?.res ? String(p.res) : '';
  $('nolights').checked = !!p?.nolights;
  $('noshadows').checked = !!p?.noshadows;
  $('fps').value = p?.fps ? String(p.fps) : '';
}
function describePerf(p) {
  const on = [p?.res && `解析度 ${p.res}`, p?.nolights && '關光照', p?.noshadows && '關陰影', p?.fps && `${p.fps} FPS`].filter(Boolean);
  return on.length ? on.join('、') : '預設';
}
const savePerf = (p) => chrome.storage.local.set({ perf: p });
const readPerf = () => ({
  res: Number($('res').value) || null,
  nolights: $('nolights').checked,
  noshadows: $('noshadows').checked,
  fps: Number($('fps').value) || null,
});
for (const id of ['res', 'nolights', 'noshadows', 'fps']) $(id).addEventListener('change', () => savePerf(readPerf()));
for (const [id, p] of Object.entries(PRESETS)) $(id).addEventListener('click', () => { showPerf(p); savePerf(p); });

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
