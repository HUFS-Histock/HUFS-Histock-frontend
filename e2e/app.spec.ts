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
  await expect(page.getByTestId("candle")).toHaveCount(60);
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
