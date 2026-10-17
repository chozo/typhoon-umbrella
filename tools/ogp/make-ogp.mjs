// SNS共有用の OGP 画像（1200×630）を public/ogp.png に作る。
//   npm run ogp
// 1. ゲームを縦長の画面で開き、時計を止めて1コマずつ進めながら遊ぶ。毎コマ、雨の向きに合わせて画面をドラッグし、
//    傘を風上へ傾けたまま嵐が強くなった場面（SHOT_AT 秒）を撮る。時計と乱数を固定しているので毎回同じ風になる
// 2. 1200×630 の台紙に、撮った画面（背景用にぼかしたものと、くっきりしたもの）・タイトル・遊び方・URL・赤い傘を並べて撮る
// ファイルはサーバーを立てずに、ブラウザの通信を横取りしてこのフォルダから返す（public/ はルートのパスで返す）
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outFile = path.join(root, 'public/ogp.png');
const URL_TEXT = 'game.chozo.net/typhoon-umbrella';
const ORIGIN = 'http://typhoon-umbrella.local';
const SEED = 20261018;
const SHOT_AT = 21.5; // 何秒目を撮るか（20秒を過ぎると雨がいちばん激しい段階の手前になる）
const FRAME_MS = 16;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.route(`${ORIGIN}/**`, (route) => {
  const p = decodeURIComponent(new URL(route.request().url()).pathname).replace(/\/$/, '/index.html');
  const file = [path.join(root, p), path.join(root, 'public', p)].find((f) => f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile());
  return file ? route.fulfill({ path: file }) : route.fulfill({ status: 404 });
});
await page.addInitScript((seed) => {
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}, SEED);
await page.clock.install({ time: 0 });
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.click('#startButton');
await page.clock.runFor(300); // スタート画面が消えるのを待つ

// 画面に降っている雨の向き（ゲームの判定と同じ式）を読み、傘をその向きへ傾ける位置をドラッグする
const box = await page.locator('#game').boundingBox();
const aimX = () =>
  page.evaluate(() => {
    const t = (performance.now() - startedAt) / 1000;
    const storm = stormLevel(t);
    const rainAngle = -Math.atan2(windAt(t) * 175 * 1.25 * storm.slant, (150 + 1.25 * 130) * storm.speed);
    return { t, x: Math.max(-0.9, Math.min(0.9, rainAngle * 1.4)) / 1.8 + 0.5 };
  });
let aim = await aimX();
await page.mouse.move(box.x + aim.x * box.width, box.y + box.height * 0.7);
await page.mouse.down();
while (aim.t < SHOT_AT) {
  await page.mouse.move(box.x + aim.x * box.width, box.y + box.height * 0.7);
  await page.clock.runFor(FRAME_MS);
  aim = await aimX();
}
const state = await page.evaluate(() => ({ t: (performance.now() - startedAt) / 1000, wind, angle, durability: ui.durability.textContent, hint: ui.hint.textContent, gameOver }));
console.log('撮った場面:', JSON.stringify(state));
if (state.gameOver) throw new Error('撮影前に傘が壊れました');
const shot = await page.locator('.game-shell').screenshot({ type: 'png' });

// 2. 台紙に並べて撮る
const card = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const img = `data:image/png;base64,${shot.toString('base64')}`;
const umbrella = fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
await card.setContent(`<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700;900&display=swap">
<style>
  body { margin: 0; }
  #ogp { position: relative; width: 1200px; height: 630px; overflow: hidden; color: #fff;
    font-family: "Zen Kaku Gothic New", "Hiragino Sans", sans-serif; font-weight: 900; background: #070c16; }
  .bg { position: absolute; inset: -40px; background: url(${img}) center 40% / cover; filter: blur(12px) brightness(.8); }
  .tint { position: absolute; inset: 0;
    background: linear-gradient(90deg, rgba(7, 12, 22, .95) 0%, rgba(10, 18, 36, .8) 55%, rgba(10, 18, 36, .2) 100%); }
  .rain { position: absolute; inset: 0; opacity: .35;
    background: repeating-linear-gradient(105deg, transparent 0 22px, rgba(169, 215, 255, .5) 22px 23px, transparent 23px 47px); }
  .shot { position: absolute; left: 830px; top: 24px; width: 330px; border-radius: 22px;
    transform: rotate(4deg); transform-origin: 50% 0;
    box-shadow: 0 0 0 6px #e9f5ff, 0 0 40px rgba(169, 215, 255, .4), 0 22px 44px rgba(0, 0, 0, .6); }
  .text { position: absolute; left: 70px; top: 0; bottom: 0; width: 720px;
    display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }
  .eyebrow { color: #a9d7ff; font-size: 24px; letter-spacing: .2em; }
  .logo { margin-top: 10px; font-size: 92px; line-height: 1.12; letter-spacing: -.06em; white-space: nowrap;
    text-shadow: 0 6px 0 #111d36, 0 14px 30px rgba(0, 0, 0, .5); }
  .lead { margin-top: 26px; font-size: 34px; line-height: 1.5; color: #dcecff; }
  .lead em { font-style: normal; color: #ffdc67; }
  .url { margin-top: 28px; padding: 12px 30px; border-radius: 999px; color: #10213a; font-size: 30px;
    background: #e9f5ff; box-shadow: 0 5px 0 #86a8c6, 0 12px 28px rgba(0, 0, 0, .45); }
  .umbrella { position: absolute; left: 640px; top: 40px; width: 150px; transform: rotate(-22deg);
    filter: drop-shadow(0 10px 16px rgba(0, 0, 0, .5)); }
</style>
<div id="ogp">
  <div class="bg"></div>
  <div class="tint"></div>
  <div class="rain"></div>
  <img class="shot" src="${img}">
  <div class="umbrella">${umbrella}</div>
  <div class="text">
    <div class="eyebrow">TYPHOON UMBRELLA</div>
    <div class="logo">台風の中、<br>傘をさして帰れ！</div>
    <div class="lead">左右にドラッグして、<em>風上へ傘を傾けろ</em>。<br>30秒、傘を壊さず帰宅しよう！</div>
    <div class="url">${URL_TEXT}</div>
  </div>
</div>`);
await card.waitForFunction(() => [...document.images].every((i) => i.complete));
await card.evaluate(() => document.fonts.ready);
await card.screenshot({ path: outFile, clip: { x: 0, y: 0, width: 1200, height: 630 } });

await browser.close();
console.log('OGP画像:', outFile);
