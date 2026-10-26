// 把 extension/ 打包成 dist/d2survivors-zhtw-<版本>.zip，給朋友「載入未封裝項目」用
// zip 內是一個 d2survivors-zhtw/ 資料夾：擴充檔案＋安裝說明.html，不含任何 .md
// 用 Node 內建 zlib 自己寫 zip：系統工具各有毛病（Windows PowerShell 寫反斜線路徑，Mac 解壓會壞）
// 用法：npm run pack
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const ext = path.join(root, 'extension');
const { version } = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
const out = path.join(root, 'dist', `d2survivors-zhtw-${version}.zip`);

const files = fs.readdirSync(ext, { recursive: true })
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => !f.startsWith('_metadata') && fs.statSync(path.join(ext, f)).isFile())
  .map((f) => [`d2survivors-zhtw/${f}`, fs.readFileSync(path.join(ext, f))]);
files.push(['d2survivors-zhtw/安裝說明.html', fs.readFileSync(path.join(root, 'docs', 'install.html'))]);
const md = files.filter(([n]) => /\.md$/i.test(n));
if (md.length) throw new Error(`發佈檔不可含 .md：${md.map(([n]) => n).join(', ')}`);

export function zip(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const body = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data);
    const head = (sig, extra) => {
      const b = Buffer.alloc(extra);
      b.writeUInt32LE(sig, 0);
      return b;
    };
    const lh = head(0x04034b50, 30);
    lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8); // UTF-8 檔名、deflate
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    const ch = head(0x02014b50, 46);
    ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    local.push(lh, nameBuf, body);
    central.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, zip(files));
console.log(out);
