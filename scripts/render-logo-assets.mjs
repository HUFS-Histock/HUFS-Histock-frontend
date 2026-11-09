/**
 * 로고 SVG → PNG 에셋 렌더링.
 * 사용법: node scripts/render-logo-assets.mjs
 * 생성물: apple-touch-icon.png(180), icon-192.png, icon-512.png,
 *         favicon-32.png, og-image.png(1200x630)
 */
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pub = path.join(root, "public");

const mark = await readFile(path.join(pub, "logo-mark.svg"), "utf8");
const favicon = await readFile(path.join(pub, "favicon.svg"), "utf8");

// PNG 아이콘용: 모서리 각진 타일(운영체제가 직접 라운딩), 테두리 하이라이트 제거
const squareMark = mark
  .replace('rx="116"', 'rx="0"')
  .replace(/<rect x="1\.5"[^>]*>\n?/, "");

function sized(svg, size) {
  return svg.replace(
    "<svg ",
    `<svg width="${size}" height="${size}" `,
  );
}

const browser = await chromium.launch({ channel: "chrome" });

async function renderSvg(svg, size, out) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><style>*{margin:0;padding:0}body{width:${size}px;height:${size}px;overflow:hidden}</style>${sized(svg, size)}`,
  );
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  console.log("wrote", path.relative(root, out));
}

async function renderOg() {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html>
<html><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;800&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    font-family: 'Archivo', 'Arial', 'Apple SD Gothic Neo', sans-serif;
    background: linear-gradient(135deg, #26334a 0%, #0a0e15 64%);
    color: #fff;
    display: flex; align-items: center; gap: 76px; padding: 0 100px;
  }
  .mark { width: 340px; height: 340px; flex: none; filter: drop-shadow(0 24px 60px rgba(0,0,0,.45)); }
  h1 { font-size: 108px; font-weight: 800; letter-spacing: -0.028em; line-height: 1; }
  .sub { margin-top: 26px; font-size: 28px; font-weight: 600; color: #a9b6cb;
         font-family: 'Apple SD Gothic Neo', 'Archivo', sans-serif; letter-spacing: -0.02em; }
  .chip { margin-top: 44px; display: inline-flex; align-items: center; gap: 11px;
          font-family: 'IBM Plex Mono', monospace; font-size: 15px; font-weight: 500;
          letter-spacing: 0.16em; color: #7fe8ae; }
  .chip i { width: 10px; height: 10px; border-radius: 50%; background: #2ee383;
            box-shadow: 0 0 0 4px rgba(46,227,131,.22); }
</style></head>
<body>
  <div class="mark">${mark}</div>
  <div>
    <h1>HISTOCK</h1>
    <div class="sub">과거의 시장에서, 투자의 힌트를 찾다</div>
    <div class="chip"><i></i>SPY · AI MARKET ANALOGS</div>
  </div>
</body></html>`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(pub, "og-image.png"),
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  await page.close();
  console.log("wrote public/og-image.png");
}

await renderSvg(squareMark, 180, path.join(pub, "apple-touch-icon.png"));
await renderSvg(squareMark, 192, path.join(pub, "icon-192.png"));
await renderSvg(squareMark, 512, path.join(pub, "icon-512.png"));
await renderSvg(favicon, 32, path.join(pub, "favicon-32.png"));
await renderOg();

await browser.close();
