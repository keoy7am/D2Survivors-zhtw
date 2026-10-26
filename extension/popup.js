const $ = (id) => document.getElementById(id);

(async () => {
  const meta = await (await fetch('meta.json')).json();
  const s = await chrome.storage.local.get(['seenUi', 'seenKo', 'off', 'disabled', 'cov']);
  $('off').checked = !!s.off;
  $('state').innerHTML = s.disabled
    ? '<span class="warn">遊戲已改版，翻譯已自動暫停（不然中文會變成「?」）。請更新本擴充。</span>'
    : s.off ? '已停用' : '翻譯運作中';
  if (s.cov) {
    const pct = ((s.cov.covered / s.cov.total) * 100).toFixed(1);
    $('cov').textContent = `覆蓋率 ${pct}%（${s.cov.covered} / ${s.cov.total} 條）`;
  } else {
    $('cov').textContent = '覆蓋率：打開一次遊戲後才會計算';
  }
  const same = (a, b) => (!a || a === b ? '' : ' ← 遊戲目前是 ' + a);
  $('ver').textContent = `擴充對應版本：${meta.ui}${same(s.seenUi, meta.ui)}；字典 ${meta.ko}${same(s.seenKo, meta.ko)}；建置於 ${meta.builtAt.slice(0, 10)}`;
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
