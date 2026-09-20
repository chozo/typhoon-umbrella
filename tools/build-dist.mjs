import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist', 'typhoon-umbrella');
const files = [
  'index.html',
  'style.css',
  'game.js',
  'favicon.svg',
  'character-back-deformed.png',
  'broken-umbrella.png',
  'soaked-character.png'
];

await mkdir(dist, { recursive: true });
await Promise.all(files.map(file => copyFile(resolve(root, file), resolve(dist, file))));
console.log(`Built ${files.length} files into dist/typhoon-umbrella/`);
