const $ = (id) => document.getElementById(id);

(async () => {
  const meta = await (await fetch('meta.json')).json();
  const s = await chrome.storage.local.get(['seenUi', 'seenKo', 'off', 'disabled', 'cov', 'patchError']);
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
  const changed = (s.seenUi && s.seenUi !== meta.ui) || (s.seenKo && s.seenKo !== meta.ko);
  $('ver').textContent = `遊戲版本 ${s.seenUi ?? '（尚未開過遊戲）'}；譯文建置於 ${meta.builtAt.slice(0, 10)}${changed ? '，之後遊戲有改版，新字串會顯示原文' : ''}`;
})();

$('off').addEventListener('change', (e) => chrome.storage.local.set({ off: e.target.checked }));

$('export').addEventListener('click', async () => {
  $('msg').textContent = '計算中…';
  const r = await chrome.runtime.sendMessage('missing');
  if (r.error) { $('msg').textContent = `失敗：${r.error}`; return; }
  // 格式與 i18n/todo 批次相同，可以直接丟給翻譯流程
  const blob = new Blob([JSON.stringify(r.missing.map((k) => ({ k })), null, 1)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `d2zh-missing-${r.koName.replace(/\.js$/, '')}.json` });
  a.click();
  $('msg').textContent = `已匯出 ${r.missing.length} 條`;
});
