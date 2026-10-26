// 把遊戲的 ui-<hash>.js 改成能畫中文的版本。每個補丁必須恰好命中一次，否則丟錯——
// 遊戲改版後跑這支，失敗就代表渲染器結構變了，要重新看原始碼。
const ORIGIN = 'https://d2survivors.lol/assets/';

const HELPERS = `
function __zhIs(h){const k=h.charCodeAt(0);return k>=11904&&!(k>=44032&&k<=55203)&&!(k>=12592&&k<=12687)}
var __zhClose='，。、；：！？）」』》〉】…—・％,.;:!?)%';
var __zhOpen='（「『《〈【(';
function __zhSplit(w){let o=[],c='';for(const h of w){const z=__zhIs(h),cl=__zhClose.includes(h),lo=c&&__zhOpen.includes(c.at(-1)),lz=c&&__zhIs(c.at(-1));if(c&&!cl&&!lo&&(z||lz)){o.push(c);c=h}else c+=h}o.push(c);return o}
`;

// 原版只在空白處斷行；中文沒有空白，改成「中文字之間也能斷」，標點不放行首
const WRAP = 'wrapLines(e,t){let n=[];for(let r of e.split(`\\n`)){let k=[];for(let w of r.split(` `)){let f=!0;for(let p of __zhSplit(w))k.push([f?` `:``,p]),f=!1}let e=``;for(let[s,i]of k){let r=e?e+s+i:i;e&&this.measure(r)>t?(n.push(e.endsWith(` ·`)?e.slice(0,-2):e),e=i===`·`?``:i):e=r}(e||!r)&&n.push(e)}return n}';

const FALLBACK = ', "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif';

// 自我檢查斷行：node tools/patch-ui.mjs
if (process.argv[1] && import.meta.filename === (await import('node:path')).resolve(process.argv[1])) {
  const Font = new Function(`${HELPERS}; return class{measure(s){return [...s].length}${WRAP}}`)();
  const f = new Font();
  const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
  eq(f.wrapLines('hello big world', 9), ['hello big', 'world']);           // 英文照舊在空白斷
  eq(f.wrapLines('一二三四五六', 4), ['一二三四', '五六']);                 // 中文字之間可斷
  eq(f.wrapLines('一二三，四五', 3), ['一二', '三，四', '五']);             // 逗號不放行首
  eq(f.wrapLines('（一二）三四', 4), ['（一二）', '三四']);                 // 括號跟著字走
  eq(f.wrapLines('火焰抗性 +30%', 7), ['火焰抗性', '+30%']);
  eq(f.wrapLines('a\n\nb', 9), ['a', '', 'b']);
  console.log('wrap ok');
}

export function patchUi(src, fileName) {
  const once = (s, re, to, label) => {
    const hits = s.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
    if (!hits || hits.length !== 1) throw new Error(`補丁「${label}」命中 ${hits ? hits.length : 0} 次（應為 1）`);
    return s.replace(re, to);
  };
  let s = src;
  // 1. 相對 import 會被解析到 chrome-extension:// 底下，改成絕對網址
  const rel = s.match(/from"\.\//g)?.length ?? 0;
  if (!rel) throw new Error('找不到相對 import，檔案結構變了');
  s = s.replace(/from"\.\//g, `from"${ORIGIN}`);
  if (/import\(/.test(s)) throw new Error('出現動態 import()，需要一併改寫成絕對網址');
  s = s.replace(/import\.meta\.url/g, JSON.stringify(ORIGIN + fileName));
  // 2. 「外文字」判斷：原本只有諺文走 fillText，加上 CJK（U+2E80 起，含全形標點）
  s = once(s, /(function \w+\((\w)\)\{let (\w)=\2\.charCodeAt\(0\);return )(\3>=44032)/, '$1$3>=11904||$4', '外文字判斷');
  // 3. 斷行
  s = once(s, /wrapLines\(e,t\)\{[\s\S]*?\}return n\}(?=balanceLines\()/, () => WRAP, '斷行');
  // 4. 字型後備：D2R 韓文字型只涵蓋諺文，中文要落到系統繁中字型
  s = once(s, /px "\$\{this\.foreignFamily\}"`/, () => 'px "${this.foreignFamily}"' + FALLBACK + '`', '字型後備');
  return s + HELPERS;
}
