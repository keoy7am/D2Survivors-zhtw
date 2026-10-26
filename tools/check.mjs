// 單條譯文的機械檢查：回傳錯誤描述，合格回傳 null
const HANGUL = /[가-힣ㄱ-ㆎ]/;
const holes = (s) => (s.match(/\{\d+\}/g) ?? []).sort().join(',');
const dots = (s) => s.split(' · ').length - 1;

export function checkEntry(key, zh, ko) {
  if (typeof zh !== 'string' || !zh.trim()) return '空值';
  if (HANGUL.test(zh)) return '含諺文';
  if (holes(zh) !== holes(ko)) return `佔位符不符（韓 ${holes(ko) || '無'}／中 ${holes(zh) || '無'}）`;
  if (dots(zh) !== dots(ko)) return '「 · 」分隔數不符';
  return null;
}

// 自我檢查：node tools/check.mjs
if (process.argv[1] && import.meta.filename === (await import('node:path')).resolve(process.argv[1])) {
  const assert = (c, m) => { if (!c) throw new Error(m); };
  assert(checkEntry('SHOW ITEMS: #', '顯示物品：{0}', '아이템 표시: {0}') === null, '正常值');
  assert(checkEntry('SHOW ITEMS: #', '顯示物品', '아이템 표시: {0}')?.startsWith('佔位符'), '漏佔位符');
  assert(checkEntry('x', '아이', '아이') === '含諺文', '諺文');
  assert(checkEntry('a · b', '甲・乙', '갑 · 을') === '「 · 」分隔數不符', '分隔');
  assert(checkEntry('x', ' ', 'y') === '空值', '空值');
  console.log('check.mjs ok');
}
