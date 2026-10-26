// 解析遊戲字典模組 `var e={"key":`值`,…};export{e as default};` 的 key。
// 擴充裡不能 eval（MV3 CSP），只好自己掃。tools/test-dict-keys.mjs 會拿真檔對帳。
const ESC = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };
function unescape(s) {
  return s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, e) =>
    e[0] === 'u' || e[0] === 'x'
      ? String.fromCodePoint(parseInt(e.replace(/^[ux]\{?|\}$/g, ''), 16))
      : ESC[e] ?? e);
}

export function dictKeys(src) {
  const keys = [];
  let i = src.indexOf('{') + 1;
  const str = (q) => { // 從 src[i]===q 讀到對應的結束引號
    let j = i + 1;
    while (src[j] !== q) {
      if (j >= src.length) throw new Error('字典格式變了：字串沒有結尾');
      j += src[j] === '\\' ? 2 : 1;
    }
    const raw = src.slice(i, j + 1);
    i = j + 1;
    return raw;
  };
  while (i < src.length && src[i] !== '}') {
    if (src[i] === '"' || src[i] === "'") keys.push(unescape(str(src[i]).slice(1, -1)));
    else { // 合法識別字的 key 會被壓縮器拿掉引號：Slayer:`…`
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 200));
      if (!m) throw new Error(`字典格式變了 @${i}`);
      keys.push(m[0]);
      i += m[0].length;
    }
    if (src[i] !== ':') throw new Error(`字典格式變了 @${i}`);
    i++;
    str(src[i]); // 值：反引號或雙引號
    if (src[i] === ',') i++;
  }
  return keys;
}
