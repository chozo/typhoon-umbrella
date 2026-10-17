import { copyFile, cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist', 'typhoon-umbrella');
const files = [
  'index.html',
  'style.css',
  'game.js',
  'character-back-deformed.png',
  'broken-umbrella.png',
  'soaked-character.png'
];

// 古いファイルが残らないよう、毎回空にしてから出力する
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await Promise.all(files.map(file => copyFile(resolve(root, file), resolve(dist, file))));
// public/（favicon.svg と ogp.png）はそのまま公開ルートに置く
const publicFiles = await readdir(resolve(root, 'public'));
await Promise.all(publicFiles.map(file => cp(resolve(root, 'public', file), resolve(dist, file))));
console.log(`Built ${files.length + publicFiles.length} files into dist/typhoon-umbrella/`);
