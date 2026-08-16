/**
 * 离线单文件构建：
 * 把 ES Modules 依赖图内联为 data: URL 模块，生成 offline/index.html。
 * 双击即可在本地浏览器游玩（无需 Node / 服务器 / 网络）。
 * 运行：node scripts/build-offline.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entryRel = 'src/main.js';
const rewritten = new Map();
let musicAsset = null;

const toB64 = (str) => Buffer.from(str, 'utf8').toString('base64');

function resolveSpec(fromAbs, spec) {
  let p = resolve(dirname(fromAbs), spec);
  if (!existsSync(p) && existsSync(`${p}.js`)) p = `${p}.js`;
  return p;
}

function rewriteModule(absPath) {
  if (rewritten.has(absPath)) return rewritten.get(absPath);
  let src = readFileSync(absPath, 'utf8');
  // 若存在背景音乐文件，把它内联进 music.js，保证离线单文件也有 BGM
  if (absPath.endsWith(`${sep}audio${sep}music.js`)) {
    const candidates = ['assets/music.ogg', 'assets/music.mp3', 'assets/music.m4a'];
    const hit = candidates.find((rel) => existsSync(resolve(root, rel)));
    if (hit) {
      musicAsset = hit;
      const data = readFileSync(resolve(root, hit));
      const ext = hit.endsWith('.mp3') ? 'mpeg' : hit.endsWith('.m4a') ? 'mp4' : 'ogg';
      src = src.replace(
        "const MUSIC_SRC = '__MUSIC_DATA_URL__';",
        `const MUSIC_SRC = 'data:audio/${ext};base64,${data.toString('base64')}';`,
      );
      console.log(`inlined music: ${hit} (${data.length} bytes)`);
    }
  }
  const out = src.replace(
    /import\s+([^'"]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/g,
    (m, bindings, spec) => {
      const target = resolveSpec(absPath, spec);
      const targetSrc = rewriteModule(target);
      return `import ${bindings} from "data:text/javascript;base64,${toB64(targetSrc)}";`;
    },
  );
  rewritten.set(absPath, out);
  return out;
}

const entry = rewriteModule(resolve(root, entryRel));
const entryUrl = `data:text/javascript;base64,${toB64(entry)}`;

const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const newHtml = html.replace(
  /<script type="module" src="\.\/src\/main\.js"><\/script>/,
  `<script type="module">\n  import("${entryUrl}");\n</script>`,
);

mkdirSync(resolve(root, 'offline'), { recursive: true });
writeFileSync(resolve(root, 'offline/index.html'), newHtml);
writeFileSync(resolve(root, 'music-probe.json'), JSON.stringify({ music: !!musicAsset }));
console.log(`offline/index.html generated (${newHtml.length} bytes)`);
console.log(`music-probe.json: music=${!!musicAsset}`);
console.log('modules:', [...rewritten.keys()].map((p) => p.slice(root.length + 1)));
