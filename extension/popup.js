const $ = (id) => document.getElementById(id);

(async () => {
  const meta = await (await fetch('meta.json')).json();
  const s = await chrome.storage.local.get(['seen', 'off', 'disabled', 'cov', 'patchError']);
  const seen = s.seen ?? {};
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
  $('ver').textContent = `遊戲版本 ${seen['ui-'] ?? '（尚未開過遊戲）'}；譯文建置於 ${meta.builtAt.slice(0, 10)}${changed ? '，之後遊戲有改版，新字串會顯示原文' : ''}`;
})();

$('off').addEventListener('change', (e) => chrome.storage.local.set({ off: e.target.checked }));

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
  $('msg').textContent = `已匯出 ${keys.length} 條（字典 ${r.missing.length}、遊戲畫面 ${runtime.length}）`;
});
