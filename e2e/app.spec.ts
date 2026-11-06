import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

async function openAnalysis(page: Page) {
  await page
    .getByRole("button", { name: /보조지표/, exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "차트에 AI 분석 추가" }).click();
}
async function hoverPlot(page: Page, svg: Locator, horizontal: number, vertical: number) {
  const point = await svg.evaluate((node, position) => {
    const svg = node as SVGSVGElement;
    const { width, height } = svg.viewBox.baseVal;
    const p = new DOMPoint(22.5 + (width - 95) * position.horizontal, 24 + (height - 54) * position.vertical).matrixTransform(svg.getScreenCTM()!);
    return { x: p.x, y: p.y };
  }, { horizontal, vertical });
  await page.mouse.move(point.x, point.y);
}

test('crosshair labels replace the dot, track cursor height and stay inside single/split/mobile charts', async ({ page, request }) => {
  const snapshot = await (await request.get('/snapshot.json')).json();
  const firstDate = snapshot.prices.slice(-120)[0].date;
  await page.goto('/');
  await expect(page.getByTestId('candle')).toHaveCount(120);
  const candleChart = page.getByRole('img', { name: '현재 캔들 차트', exact: true });
  await hoverPlot(page, candleChart, 0, .25);
  await expect(page.getByTestId('crosshair-date')).toHaveText(firstDate);
  const firstQuote = snapshot.prices.slice(-120)[0];
  const previousQuote = snapshot.prices.slice(-121)[0];
  const readout = page.getByTestId('quote-readout');
  const formatPrice = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatChange = (current: number, previous: number) => {
    const delta = current - previous;
    return `${delta > 0 ? '▲' : delta < 0 ? '▼' : '−'} ${formatPrice(Math.abs(delta))} (${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta / previous * 100).toFixed(2)}%)`;
  };
  await expect(readout).toHaveAttribute('data-date', firstDate);
  for (const [label, field] of [['시가', 'open'], ['고가', 'high'], ['저가', 'low'], ['종가', 'close']]) {
    await expect(readout.locator(`[aria-label="${label}"] b`)).toHaveText(formatPrice(firstQuote[field]));
  }
  await expect(readout.locator('[aria-label="거래량"] b')).toHaveText(firstQuote.volume.toLocaleString('en-US'));
  await expect(page.getByTestId('quote-change')).toHaveText(formatChange(firstQuote.close, previousQuote.close));
  await expect(page.locator('.chart circle')).toHaveCount(0);
  const highPrice = Number((await page.getByTestId('crosshair-price').textContent())!.replaceAll(',', ''));
  const ticks = await candleChart.locator(':scope > g > text').allTextContents();
  expect(highPrice).toBeCloseTo(Number(ticks[1]), 2);
  await hoverPlot(page, candleChart, 0, .75);
  const lowPrice = Number((await page.getByTestId('crosshair-price').textContent())!.replaceAll(',', ''));
  expect(lowPrice).toBeLessThan(highPrice);
  await expect(page.getByTestId('crosshair-date')).toHaveText(firstDate);
  const dateBox = (await page.getByTestId('crosshair-date').boundingBox())!;
  const volumeBox = (await page.getByRole('img', { name: '현재 거래량', exact: true }).boundingBox())!;
  expect(dateBox.y).toBeGreaterThanOrEqual(volumeBox.y + volumeBox.height);
  await page.getByRole('button', { name: '선', exact: true }).click();
  await expect(page.getByTestId('crosshair-price')).toHaveCount(0);
  await hoverPlot(page, page.getByRole('img', { name: '현재 선 차트', exact: true }), 1, .5);
  await expect(page.getByTestId('crosshair-date')).toHaveText(snapshot.dataDate);
  await expect(readout).toHaveAttribute('data-date', snapshot.dataDate);
  await expect(page.getByTestId('quote-change')).toHaveClass(/down/);
  await expect(page.getByTestId('quote-change')).toHaveText(formatChange(snapshot.prices.at(-1).close, snapshot.prices.at(-2).close));
  await page.screenshot({ path: 'test-results/crosshair.png', fullPage: true });
  await page.getByRole('link', { name: 'HISTOCK', exact: true }).hover();
  await expect(page.getByTestId('crosshair-date')).toHaveCount(0);
  await expect(page.getByTestId('crosshair-price')).toHaveCount(0);
  await expect(readout).toHaveAttribute('data-date', snapshot.dataDate);
  await openAnalysis(page);
  await page.locator('.case-strip button').first().click();
  const pastChart = page.getByRole('img', { name: '과거 선 차트', exact: true });
  await hoverPlot(page, pastChart, 0, .5);
  await expect(page.getByTestId('quote-change').first()).toHaveText('전일 대비 —');
  await hoverPlot(page, pastChart, 1, .5);
  await expect(page.getByTestId('crosshair-date')).toHaveText(snapshot.analysis.cases[0].date);
  await expect(page.getByTestId('crosshair-price')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await pastChart.scrollIntoViewIfNeeded();
  await hoverPlot(page, pastChart, 1, .5);
  await expect(page.getByTestId('crosshair-date')).toHaveText(snapshot.analysis.cases[0].date);
  const chartBox = (await pastChart.boundingBox())!;
  const priceBox = (await page.getByTestId('crosshair-price').boundingBox())!;
  const mobileDateBox = (await page.getByTestId('crosshair-date').boundingBox())!;
  expect(priceBox.x + priceBox.width).toBeLessThanOrEqual(chartBox.x + chartBox.width + 1);
  expect(mobileDateBox.x + mobileDateBox.width).toBeLessThanOrEqual(chartBox.x + chartBox.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("live API → indicators → every Top 5 hover/split → modes and keyboard restoration", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const health = await (await request.get("/api/v1/analysis/health")).json();
  const actual = await (
    await request.get(
      `/api/v1/analysis/search?date=${health.date_end}&cases=5&method=hybrid&explain=true`,
    )
  ).json();
  await page.goto("/");
  await expect(page.getByTestId("candle")).toHaveCount(120);
  await page.screenshot({ path: "test-results/default.png", fullPage: true });
  await openAnalysis(page);
  await expect(page.getByTestId("volatility")).toHaveText(
    `${(actual.risk.fwd_vol_20d * 100).toFixed(1)}%`,
  );
  await expect(page.locator("tbody tr")).toHaveCount(actual.cases.length);
  await expect(
    page.getByText("분석 기준일 이후 실제 결과:", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".case-strip button")).toHaveCount(actual.cases.length);
  await expect(page.getByTestId("candle")).toHaveCount(20);
  const sidebarBefore = await page.locator(".sidebar").boundingBox();
  const panelBefore = await page.locator(".panel").boundingBox();
  const wide = await page
    .getByTestId("volume-bar")
    .first()
    .getAttribute("width");
  for (let i = 0; i < actual.cases.length; i++) {
    const button = page.getByRole("button", {
      name: `${i + 1}위 ${actual.cases[i].date} 과거 차트 비교`,
    });
    await button.hover();
    await expect(page.getByTestId("comparison-line")).toHaveCount(1);
    expect(
      await page.getByTestId("volume-bar").first().getAttribute("width"),
    ).toBe(wide);
    await page.getByRole("link", { name: "HISTOCK", exact: true }).hover();
    await expect(page.getByTestId("comparison-line")).toHaveCount(0);
    await button.focus();
    await expect(page.getByTestId("comparison-line")).toHaveCount(1);
    await button.press("Enter");
    await expect(page.getByTestId("chart")).toHaveCount(2);
    await expect(page.getByTestId("volume-bar")).toHaveCount(40);
    await expect(page.locator(".sidebar")).toBeVisible();
    const sidebarAfter = await page.locator(".sidebar").boundingBox();
    const panelAfter = await page.locator(".panel").boundingBox();
    expect(sidebarAfter?.x).toBe(sidebarBefore?.x);
    expect(sidebarAfter?.width).toBe(sidebarBefore?.width);
    expect(panelAfter?.x).toBe(panelBefore?.x);
    expect(panelAfter?.width).toBe(panelBefore?.width);
    if (i === 0)
      await page.screenshot({ path: "test-results/split.png", fullPage: true });
    await page.getByRole("button", { name: "선", exact: true }).click();
    await expect(page.getByTestId("candle")).toHaveCount(0);
    await expect(page.getByTestId("price-line")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("chart")).toHaveCount(1);
    await button.hover();
    await expect(page.getByTestId("comparison-line")).toHaveCount(1);
    expect(
      await page.getByTestId("volume-bar").first().getAttribute("width"),
    ).toBe(wide);
    if (i === 0)
      await page.screenshot({
        path: "test-results/hover-line.png",
        fullPage: true,
      });
    await page.getByRole("button", { name: "캔들", exact: true }).click();
  }
  await page.getByRole("link", { name: "HISTOCK", exact: true }).hover();
  await page.getByRole("button", { name: "120거래일", exact: true }).click();
  await expect(page.getByTestId("candle")).toHaveCount(120);
  await page.getByRole("button", { name: "차트 확대", exact: true }).click();
  await expect(page.getByTestId("candle")).toHaveCount(96);
  await openAnalysis(page);
  await expect(page.getByTestId("candle")).toHaveCount(20);
  await expect(page.locator(".case-strip button")).toHaveCount(actual.cases.length);
  await page.screenshot({ path: "test-results/analysis.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("historical live search never reuses unrelated OHLCV; holiday and observed results", async ({
  page,
}) => {
  await page.goto("/");
  await openAnalysis(page);
  await expect(
    page.getByRole("button", { name: "분석하기", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("분석 기준일", { exact: true }).fill("2022-06-18");
  await page.getByRole("button", { name: "분석하기", exact: true }).click();
  await expect(page.getByText(/직전 거래일 2022-06-17 기준/)).toBeVisible();
  await expect(page.getByTestId("candle")).toHaveCount(0);
  await expect(page.getByTestId("volume-bar")).toHaveCount(0);
  await expect(page.getByTestId("price-line")).toHaveCount(1);
  await expect(page.getByText(/분석 기준일 이후 실제 관측:/)).toBeVisible();
  await page.getByLabel("분석 방식", { exact: true }).selectOption("summary");
  await page.getByRole("button", { name: "분석하기", exact: true }).click();
  await expect(page.locator(".result-caption")).toContainText("summary");
});
test("controlled loading, 429 error and retry; empty cases; malformed API rejected", async ({
  page,
  request,
}) => {
  const health = await (await request.get("/api/v1/analysis/health")).json();
  const real = await (
    await request.get(`/api/v1/analysis/search?date=${health.date_end}`)
  ).json();
  let mode = "error";
  await page.route("**/api/v1/analysis/search?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      status: mode === "error" ? 429 : 200,
      json:
        mode === "error"
          ? { message: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }
          : mode === "empty"
            ? { ...real, cases: [] }
            : { ...real, risk: {} },
    });
  });
  await page.goto("/");
  await openAnalysis(page);
  await expect(page.getByRole("status")).toContainText("찾고 있어요");
  await expect(page.getByRole("alert")).toContainText("요청이 많습니다");
  await expect(page.getByTestId("volatility")).toHaveCount(0);
  mode = "empty";
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByText(/비교할 과거 사례가 없습니다/)).toBeVisible();
  mode = "malformed";
  await page.getByRole("button", { name: "분석하기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("응답 형식이 올바르지");
});
test("offline backend can use explicit snapshot; mobile has no page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/analysis/**", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "AI 서버에 연결할 수 없습니다." },
    }),
  );
  await page.goto("/");
  await openAnalysis(page);
  await expect(page.getByRole("alert")).toContainText(
    "AI 서버에 연결할 수 없습니다",
  );
  await expect(
    page.getByRole("button", { name: "분석하기", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "저장된 예시 보기" }).click();
  await expect(
    page.getByText("저장된 예시 분석", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("volatility")).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "차트로 비교하기 →" }).click();
  await page.locator(".case-strip button").first().click();
  await expect(page.getByTestId("chart")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "단일 차트로", exact: false }).click();
  await expect(page.getByTestId("chart")).toHaveCount(1);
});

test('chart-local zoom follows the pointer, aligns volume and preserves analysis and page layout', async ({ page, request }) => {
  const snapshot = await (await request.get('/snapshot.json')).json();
  let searches = 0;
  page.on('request', r => { if (r.url().includes('/analysis/search?')) searches++; });
  await page.goto('/');
  const chart = page.getByTestId('chart').first();
  await expect(chart).toHaveAttribute('data-count', '120');
  await expect(page.locator('.source-label')).toHaveCount(0);
  const sidebar = await page.locator('.sidebar').boundingBox();
  const panel = await page.locator('.panel').boundingBox();
  const pricePlot = chart.locator('[data-zoom-plot="price"]');
  await hoverPlot(page, pricePlot, .75, .5);
  const scroll = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -160);
  await expect(chart).toHaveAttribute('data-count', '74');
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1);
  const start = Number(await chart.getAttribute('data-start'));
  expect(Math.abs(start + .75 * 73 - .75 * 119)).toBeLessThanOrEqual(1);
  await expect(chart.getByTestId('volume-bar')).toHaveCount(74);
  const aligned = await chart.evaluate(node => {
    const bars = [...node.querySelectorAll('[data-testid="volume-bar"]')];
    return [...node.querySelectorAll('[data-testid="candle"]')].every((c, i) =>
      c.getAttribute('x') === bars[i].getAttribute('x') && c.getAttribute('width') === bars[i].getAttribute('width'));
  });
  expect(aligned).toBe(true);
  await hoverPlot(page, pricePlot, 0, .5);
  await expect(chart.getByTestId('quote-readout')).toHaveAttribute('data-date', snapshot.prices.slice(-120)[start].date);
  await expect(chart.getByTestId('crosshair-date')).toHaveText(snapshot.prices.slice(-120)[start].date);
  // Check the displayed 120-day average still includes history outside the visible slice.
  const ma = await pricePlot.locator('path[stroke="#ac6eef"]').getAttribute('d');
  const point = ma!.match(/^M[\d.]+ ([\d.]+)/)!;
  const ticks = (await pricePlot.locator(':scope > g > text').allTextContents()).map(Number);
  const inferred = ticks[0] - (Number(point[1]) - 24) / (365 - 54) * (ticks[0] - ticks[4]);
  const historyEnd = snapshot.prices.length - 120 + start;
  const expected = snapshot.prices.slice(historyEnd - 119, historyEnd + 1).reduce((sum: number, p: {close: number}) => sum + p.close, 0) / 120;
  expect(Math.abs(inferred - expected)).toBeLessThan(.02);
  await page.screenshot({ path: 'test-results/chart-zoom.png', fullPage: true });
  await chart.getByRole('button', { name: '차트 배율 초기화' }).click();
  await expect(chart).toHaveAttribute('data-count', '120');
  await page.getByRole('button', { name: '60거래일', exact: true }).click();
  await chart.getByRole('button', { name: '차트 확대', exact: true }).click();
  await expect(chart).toHaveAttribute('data-count', '48');
  await page.getByRole('button', { name: '선', exact: true }).click();
  await expect(chart).toHaveAttribute('data-count', '48');
  await page.getByRole('button', { name: '60거래일', exact: true }).click();
  await expect(chart).toHaveAttribute('data-count', '60');
  await page.getByRole('button', { name: '캔들', exact: true }).click();
  await openAnalysis(page);
  await expect(page.locator('.case-strip button')).toHaveCount(5);
  const risks = await page.locator('.metrics').innerText();
  const requestsBefore = searches;
  await chart.getByRole('button', { name: '차트 확대', exact: true }).click();
  await expect(chart).toHaveAttribute('data-count', '16');
  await hoverPlot(page, chart.locator('[data-zoom-plot="volume"]'), .5, .5);
  await page.mouse.wheel(0, 160);
  await expect(chart).toHaveAttribute('data-count', '20');
  expect(await page.locator('.metrics').innerText()).toBe(risks);
  expect(searches).toBe(requestsBefore);
  await page.locator('.case-strip button').first().click();
  await expect(page.getByTestId('chart')).toHaveCount(2);
  await chart.getByRole('button', { name: '차트 확대', exact: true }).click();
  await expect(chart.getByTestId('candle')).toHaveCount(16);
  await expect(chart.getByTestId('volume-bar')).toHaveCount(16);
  await expect(page.getByTestId('chart').nth(1)).toHaveAttribute('data-count', '20');
  for (const [selector, before] of [['.sidebar', sidebar], ['.panel', panel]] as const) {
    const after = await page.locator(selector).boundingBox();
    expect(after!.width).toBe(before!.width);
    expect(after!.x).toBe(before!.x);
  }
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  for (let i = 0; i < 8; i++) {
    const button = chart.getByRole('button', { name: '차트 확대', exact: true });
    if (await button.isEnabled()) await button.click();
  }
  await expect(chart).toHaveAttribute('data-count', '5');
  await expect(chart.getByRole('button', { name: '차트 확대', exact: true })).toBeDisabled();
  await chart.getByRole('button', { name: '차트 축소', exact: true }).click();
  await expect(chart).toHaveAttribute('data-count', '6');
  await chart.getByRole('button', { name: '차트 배율 초기화' }).click();
  await expect(chart).toHaveAttribute('data-count', '20');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('horizontal pan keeps candle and volume dates aligned and date ticks adapt to zoom', async ({ page, request }) => {
  const snapshot = await (await request.get('/snapshot.json')).json();
  await page.goto('/');
  const chart = page.getByTestId('chart').first();
  await expect(chart).toHaveAttribute('data-count', '120');
  expect(await chart.getByTestId('date-tick').allTextContents()).toEqual(['5월', '6월', '7월', '8월', '9월', '10월', '11월']);
  for (let i = 0; i < 5; i++) await chart.getByRole('button', { name: '차트 확대', exact: true }).click();
  await expect(chart).toHaveAttribute('data-count', '40');
  const weeks = await chart.getByTestId('date-tick').allTextContents();
  expect(weeks.length).toBeGreaterThanOrEqual(7);
  expect(weeks.every(t => /^\d{1,2}\/\d{1,2}$/.test(t))).toBe(true);
  await page.screenshot({ path: 'test-results/weekly-axis.png', fullPage: true });
  const plot = chart.locator('[data-zoom-plot="price"]');
  const before = Number(await chart.getAttribute('data-start'));
  await hoverPlot(page, plot, .5, .5);
  const scroll = await page.evaluate(() => window.scrollY);
  const originalX = Number(await chart.getByTestId('candle').first().getAttribute('x'));
  const originalPosition = Number(await chart.getAttribute('data-position'));
  await page.mouse.wheel(2, 0);
  await expect.poll(async () => Number(await chart.getAttribute('data-position'))).toBeGreaterThan(originalPosition);
  const tinyStep = Number(await chart.getAttribute('data-position')) - originalPosition;
  expect(tinyStep).toBeLessThan(1);
  expect(Number(await chart.getByTestId('candle').first().getAttribute('x'))).toBeLessThan(originalX);
  expect(await chart.getByTestId('volume-bar').first().getAttribute('x')).toBe(await chart.getByTestId('candle').first().getAttribute('x'));
  await page.mouse.wheel(150, 0);
  await expect.poll(async () => Number(await chart.getAttribute('data-start'))).toBeGreaterThan(before);
  await expect(chart).toHaveAttribute('data-count', '40');
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await page.mouse.wheel(-150, 0);
  await expect.poll(async () => Number(await chart.getAttribute('data-start'))).toBeLessThanOrEqual(before + 1);
  await expect(page.getByRole('slider')).toHaveCount(0);
  const navigation = page.getByRole('region', { name: '현재 차트 탐색', exact: true });
  await navigation.focus();
  await navigation.press('Home');
  await expect(chart).toHaveAttribute('data-start', '0');
  await hoverPlot(page, plot, .5, .5);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 150);
  await page.keyboard.up('Shift');
  await expect.poll(async () => Number(await chart.getAttribute('data-start'))).toBeGreaterThan(0);
  await navigation.focus();
  await navigation.press('End');
  await expect(chart).toHaveAttribute('data-start', '80');
  await hoverPlot(page, plot, .5, .5);
  const dragFrom = await chart.getAttribute('data-start');
  await page.mouse.down();
  const box = await plot.boundingBox();
  await page.mouse.move(box!.x + box!.width * .7, box!.y + box!.height * .5, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Number(await chart.getAttribute('data-start'))).toBeLessThan(Number(dragFrom));
  const start = Number(await chart.getAttribute('data-start'));
  await hoverPlot(page, plot, 0, .5);
  const date = snapshot.prices.slice(-120)[start].date;
  await expect(chart.getByTestId('crosshair-date')).toHaveText(date);
  await expect(chart.getByTestId('quote-readout')).toHaveAttribute('data-date', date);
  expect(await chart.getByTestId('volume-bar').count()).toBe(await chart.getByTestId('candle').count());
  const volume = chart.locator('[data-zoom-plot="volume"]');
  await hoverPlot(page, volume, .5, .5);
  await page.mouse.down();
  const vbox = await volume.boundingBox();
  await page.mouse.move(vbox!.x + vbox!.width * .25, vbox!.y + vbox!.height * .5, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Number(await chart.getAttribute('data-start'))).toBeGreaterThan(start);
  for (let i = 0; i < 5; i++) await chart.getByRole('button', { name: '차트 확대', exact: true }).click();
  await expect(chart).toHaveAttribute('data-count', '14');
  await expect(chart.getByTestId('date-tick')).toHaveCount(14);
  await navigation.focus();
  await navigation.press('End');
  await expect(chart).toHaveAttribute('data-start', '106');
  expect(await chart.getByTestId('date-tick').last().textContent()).toBe('11/2');
  await page.screenshot({ path: 'test-results/daily-axis.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(chart.getByTestId('date-tick')).toHaveCount(14);
  await navigation.focus();
  await navigation.press('ArrowLeft');
  await expect(chart).toHaveAttribute('data-start', '105');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/mobile-daily-axis.png', fullPage: true });
});

test('zoom animates intermediate scales, cancels on period changes and respects reduced motion', async ({ page }) => {
  await page.goto('/');
  const chart = page.getByTestId('chart').first();
  await expect(chart).toHaveAttribute('data-count', '120');
  for (const [label, from, to] of [['차트 확대', 120, 96], ['차트 축소', 96, 120]] as const) {
    const frames = await chart.evaluate(async (node, label) => {
      const samples: { count: number; width: number; aligned: boolean }[] = [];
      (node.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement).click();
      const began = performance.now();
      while (performance.now() - began < 300) {
        await new Promise(requestAnimationFrame);
        const candle = node.querySelector('[data-testid="candle"]')!;
        const volume = node.querySelector('[data-testid="volume-bar"]')!;
        samples.push({ count: Number(node.getAttribute('data-count')), width: Number(candle.getAttribute('width')),
          aligned: candle.getAttribute('x') === volume.getAttribute('x') && candle.getAttribute('width') === volume.getAttribute('width') });
      }
      return samples;
    }, label);
    expect(frames.some(f => !Number.isInteger(f.count))).toBe(true);
    expect(new Set(frames.map(f => f.width)).size).toBeGreaterThan(3);
    expect(frames.filter(f => !f.aligned || f.count < Math.min(from, to) || f.count > Math.max(from, to))).toEqual([]);
    for (let i = 1; i < frames.length; i++) expect((frames[i].count - frames[i - 1].count) * Math.sign(to - from)).toBeGreaterThanOrEqual(0);
    await expect(chart).toHaveAttribute('data-count', String(to));
  }
  await chart.getByRole('button', { name: '차트 확대', exact: true }).click();
  await page.getByRole('button', { name: '20거래일', exact: true }).click();
  await expect(chart).toHaveAttribute('data-count', '20');
  // A cancelled callback must not restore the previous 120-day viewport.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
  await expect(chart).toHaveAttribute('data-count', '20');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await chart.getByRole('button', { name: '차트 확대', exact: true }).click();
  await expect(chart).toHaveAttribute('data-count', '16');
  await chart.getByRole('button', { name: '차트 배율 초기화' }).click();
  await expect(chart).toHaveAttribute('data-count', '20');
});
