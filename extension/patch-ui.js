// 把遊戲的 ui-<hash>.js 改成能畫中文的版本。background.js 在執行期對「遊戲當下那一版」打補丁，
// tools/build.mjs 也用它檢查補丁對最新版還打得上。每個補丁必須恰好命中一次，否則丟錯——
// 失敗代表作者改了渲染器結構，擴充會退回英文，要人來看原始碼調整這裡的 regex。
const ORIGIN = 'https://d2survivors.lol/assets/';

export const HELPERS = `
globalThis.__d2zhPatched=true;
function __zhIs(h){const k=h.charCodeAt(0);return k>=11904&&!(k>=44032&&k<=55203)&&!(k>=12592&&k<=12687)}
var __zhClose='，。、；：！？）」』》〉】…—・％,.;:!?)%';
var __zhOpen='（「『《〈【(';
function __zhSplit(w){let o=[],c='';for(const h of w){const z=__zhIs(h),cl=__zhClose.includes(h),lo=c&&__zhOpen.includes(c.at(-1)),lz=c&&__zhIs(c.at(-1));if(c&&!cl&&!lo&&(z||lz)){o.push(c);c=h}else c+=h}o.push(c);return o}
`;

// 原版只在空白處斷行；中文沒有空白，改成「中文字之間也能斷」，標點不放行首
export const WRAP = 'wrapLines(e,t){let n=[];for(let r of e.split(`\\n`)){let k=[];for(let w of r.split(` `)){let f=!0;for(let p of __zhSplit(w))k.push([f?` `:``,p]),f=!1}let e=``;for(let[s,i]of k){let r=e?e+s+i:i;e&&this.measure(r)>t?(n.push(e.endsWith(` ·`)?e.slice(0,-2):e),e=i===`·`?``:i):e=r}(e||!r)&&n.push(e)}return n}';

const FALLBACK = ', "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif';

const once = (s, re, to, label) => {
  const hits = s.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
  if (!hits || hits.length !== 1) throw new Error(`補丁「${label}」命中 ${hits ? hits.length : 0} 次（應為 1）`);
  return s.replace(re, to);
};

// 補丁版從 blob: 網址載入（main-world.js 的 import map），相對 import 會失效，改成絕對網址
function absolutize(s, fileName) {
  s = s.replace(/from"\.\//g, `from"${ORIGIN}`);
  if (/import\(/.test(s)) throw new Error('出現動態 import()，需要一併改寫成絕對網址');
  return s.replace(/import\.meta\.url/g, JSON.stringify(ORIGIN + fileName));
}

export function patchUi(src, fileName) {
  if (!/from"\.\//.test(src)) throw new Error('找不到相對 import，檔案結構變了');
  let s = absolutize(src, fileName);
  // 2. 「外文字」判斷：原本只有諺文走 fillText，加上 CJK（U+2E80 起，含全形標點）
  s = once(s, /(function \w+\((\w)\)\{let (\w)=\2\.charCodeAt\(0\);return )(\3>=44032)/, '$1$3>=11904||$4', '外文字判斷');
  // 3. 斷行（整個方法換掉，參數名不管壓縮成什麼都行）
  s = once(s, /wrapLines\(\w+,\w+\)\{[\s\S]*?\}return \w+\}(?=balanceLines\()/, () => WRAP, '斷行');
  // 4. 字型後備：D2R 韓文字型只涵蓋諺文，中文要落到系統繁中字型
  s = once(s, /px "\$\{this\.foreignFamily\}"`/, () => 'px "${this.foreignFamily}"' + FALLBACK + '`', '字型後備');
  return s + HELPERS;
}

// 遊戲翻譯器（translate-<hash>.js 的 class，以英文原句查字典）補強，所有遊戲文字都經過它：
// - 查不到時多試兩種拆法：「名稱 (快捷鍵)」→ 翻名稱再接回快捷鍵（Character (C)）；「A. B」→ 分段翻（地區標題）
// - 遊戲用 Intl 以韓文格式化的日期（10월 26일）轉成中文（10月26日）
// - 仍查不到的英文字串記在 globalThis.__d2zhMissing，popup 的「匯出漏翻清單」會帶上
// 只在最外層（r===0）補強：深層遞迴是原引擎在試模板（如「Act *」），太早給出半套結果會搶掉更好的拆法
export const TRANSLATE_HELPERS = (C) => `
;(()=>{const P=${C}.prototype,L=P.lookup,T=P.translate,M=globalThis.__d2zhMissing??=new Set();
const latin=s=>(s.match(/[A-Za-z]{3,}/g)||[]).join('').length;
P.lookup=function(t,r){const x=L.call(this,t,r);if(x!==null||r!==0)return x;
const m=/^(.+?)(\\s*\\([^()]{1,12}\\))$/s.exec(t);if(m){const y=this.find(m[1],1);if(y!==null)return y+m[2]}
return null};
P.translate=function(e){let r=T.call(this,e);if(typeof r!=='string')return r;
if(e.includes('. ')&&latin(r)>0){const c=e.split('. ').map(p=>T.call(this,p)).join(' · ');if(latin(c)<latin(r))r=c}
if(!/[\\u3400-\\u9fff]/.test(e)&&M.size<5000&&(r===e&&/[A-Za-z]{3}/.test(e)||/[A-Za-z]{3,}\\s+[A-Za-z]{3,}\\s+[A-Za-z]{3,}/.test(r)))M.add(e.trim());
if(/\\d\\s*[년월일]/.test(r))r=r.replace(/(\\d+)년\\s*/g,'$1年').replace(/(\\d+)월\\s*/g,'$1月').replace(/(\\d+)일/g,'$1日');
return r};
globalThis.__d2zhTranslatePatched=true})();`;

export function patchTranslate(src, fileName) {
  const m = src.match(/var (\w+)=class\{exact=new Map/g);
  if (!m || m.length !== 1) throw new Error(`翻譯器 class 命中 ${m ? m.length : 0} 次（應為 1）`);
  const C = /var (\w+)=class/.exec(m[0])[1];
  for (const method of ['lookup(', 'find(', 'translate(']) if (!src.includes(method)) throw new Error(`翻譯器少了 ${method}，結構變了`);
  return absolutize(src, fileName) + TRANSLATE_HELPERS(C);
}

// 檔名前綴 → 補丁函式（background.js、build、測試共用）
export const PATCHERS = { 'ui-': patchUi, 'translate-': patchTranslate };
