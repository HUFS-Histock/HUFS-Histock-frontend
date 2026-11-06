import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAnalysis,
  parseHealth,
  parseMethods,
  parseSnapshot,
  request,
} from "./api.ts";
import {
  dateTicks,
  geometry,
  movingAverage,
  normalized,
  percent,
  windowFor,
  zoomRange,
} from "./chart.ts";

test("date ticks switch at 40/15 days and use the first session of each calendar week", () => {
  const dates: string[] = [];
  for (let day = Date.parse('2026-08-03'); dates.length < 65; day += 86400000) {
    const date = new Date(day);
    const text = date.toISOString().slice(0, 10);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6 && text !== '2026-09-07') dates.push(text);
  }
  assert.deepEqual(dateTicks(dates, 0, 41).map(t => t.text), ['8월', '9월']);
  const weekly = dateTicks(dates, 0, 40);
  assert.ok(weekly.some(t => dates[t.index] === '2026-09-08'));
  assert.ok(weekly.every(t => ['2026-09-08'].includes(dates[t.index]) || new Date(dates[t.index]).getUTCDay() === 1));
  assert.ok(dateTicks(dates, 0, 16).length < 16);
  assert.equal(dateTicks(dates, 0, 15).length, 15);
  const start = dates.indexOf('2026-08-28');
  assert.deepEqual(dateTicks(dates, start, 5).map(t => t.text), ['8/28', '8/31', '9/1', '9/2', '9/3']);
  const midweek = dates.indexOf('2026-09-09');
  assert.equal(dates[midweek + dateTicks(dates, midweek, 20)[0].index], '2026-09-14');
  const year = ['2026-12-31', '2027-01-04', '2027-01-05'];
  assert.deepEqual(dateTicks(year, 0, 41).map(t => t.text), ['12월', '1월']);
});

const outcome = {
  fwd_return_20d: 0.05,
  fwd_vol_20d: 0.2,
  fwd_max_drawdown_20d: -0.06,
  crash: true,
};
function fixture() {
  return {
    query: {
      date: "2026-11-02",
      requested: "2026-11-02",
      path: { spy_cum_return: Array.from({ length: 20 }, (_, i) => i * 0.001) },
    },
    method: "hybrid",
    method_desc: "test",
    cases: [{ date: "2022-05-05", similarity: 0.9, ...outcome }],
    risk: {
      n_neighbors: 10,
      fwd_vol_20d: 0.2 as number | null,
      fwd_vol_model: "HAR-X",
      fwd_vol_20d_cases: 0.15,
      crash_prob: 0.25,
      crash_prob_base_rate: 0.2,
      fwd_return_20d_quantiles: { p10: -0.05, p50: 0, p90: 0.08 },
      fwd_max_drawdown_20d_median: -0.04,
    },
    actual: null,
    disclaimer: "test",
  };
}
test("percent keeps null, zero, signs and decimal-to-percent conversion distinct", () => {
  assert.equal(percent(0.05, true), "+5.0%");
  assert.equal(percent(-0.044), "−4.4%");
  assert.equal(percent(null), "—");
  assert.equal(percent(0), "0.0%");
});
test("response parser accepts latest null outcomes and nullable model volatility", () => {
  const raw = fixture();
  raw.risk.fwd_vol_20d = null;
  assert.equal(parseAnalysis(raw).risk.fwd_vol_20d, null);
  assert.equal(parseAnalysis(raw).actual, null);
});
test("response parser preserves observed outcomes, empty cases and holiday adjustment", () => {
  const raw = {
    ...fixture(),
    actual: outcome,
    cases: [],
    query: { ...fixture().query, requested: "2026-11-03" },
  };
  assert.equal(parseAnalysis(raw).actual?.fwd_return_20d, 0.05);
  assert.equal(parseAnalysis(raw).cases.length, 0);
  assert.notEqual(
    parseAnalysis(raw).query.requested,
    parseAnalysis(raw).query.date,
  );
});
test("malformed nested values, non-finite numbers, probabilities and reversed quantiles fail", () => {
  for (const alter of [
    (v: ReturnType<typeof fixture>) => {
      v.risk.crash_prob = 25;
    },
    (v: ReturnType<typeof fixture>) => {
      v.risk.fwd_vol_20d = NaN;
    },
    (v: ReturnType<typeof fixture>) => {
      v.risk.fwd_return_20d_quantiles.p10 = 0.9;
    },
    (v: ReturnType<typeof fixture>) => {
      v.query.path.spy_cum_return.pop();
    },
    (v: ReturnType<typeof fixture>) => {
      v.query.date = "2026-02-30";
    },
    (v: ReturnType<typeof fixture>) => {
      v.cases[0].date = v.query.date;
    },
  ]) {
    const raw = fixture();
    alter(raw);
    assert.throws(() => parseAnalysis(raw));
  }
  assert.throws(() => parseAnalysis({ ...fixture(), risk: {} }));
});
test("health bounds and methods validate rather than assuming a default", () => {
  assert.throws(() =>
    parseHealth({
      status: "ok",
      date_start: "2026-11-02",
      date_end: "2020-01-01",
      data_date: "2026-11-02",
      stale: false,
      business_days_behind: 0,
    }),
  );
  assert.throws(() =>
    parseMethods({ default: "missing", methods: { hybrid: "test" } }),
  );
});
test("API errors preserve user-facing messages and reject HTML or broken JSON", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "요청이 많습니다." }), {
        status: 429,
      });
    await assert.rejects(request("/test", parseAnalysis), /요청이 많습니다/);
    globalThis.fetch = async () =>
      new Response("<html>proxy error</html>", { status: 502 });
    await assert.rejects(
      request("/test", parseAnalysis),
      /서버 응답을 읽을 수 없습니다/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("20-day candle and volume use aligned, wide geometry; split stays compact", () => {
  const wide = geometry(20, 1080, true),
    split = geometry(20, 650, false);
  assert.equal(wide.barWidth, ((1080 - 94) / 20) * 0.7);
  assert.ok(split.barWidth <= 15);
  assert.ok(wide.x(0) - wide.barWidth / 2 >= 22);
  assert.ok(wide.x(19) + wide.barWidth / 2 <= 1008);
  assert.equal(geometry(120, 1080, true).barWidth, ((1080 - 94) / 120) * 0.5);
});
test("normalized comparison starts at 100 and moving average never uses future values", () => {
  assert.deepEqual(normalized([50, 60, 40]), [100, 120, 80]);
  assert.throws(() => normalized([0, 1]));
  assert.deepEqual(movingAverage([1, 2, 3, 4], 3), [null, null, 2, 3]);
});
test("price lookup requires exact endpoint and rejects discontinuous snapshot windows", () => {
  const prices = Array.from({ length: 20 }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    open: 10,
    high: 12,
    low: 9,
    close: 11,
    volume: 100,
  }));
  assert.equal(windowFor(prices, "2026-10-20")?.length, 20);
  assert.equal(windowFor(prices, "2026-10-21"), null);
  assert.equal(windowFor(prices, "2026-10-19"), null);
  prices[19].date = "2026-11-02";
  assert.equal(windowFor(prices, "2026-11-02"), null);
});
test("invalid OHLC and snapshot date mismatch are rejected", () => {
  const valid = {
    analysis: fixture(),
    dataDate: "2026-11-02",
    source: "test",
    prices: [
      {
        date: "2026-11-02",
        open: 10,
        high: 12,
        low: 9,
        close: 11,
        volume: 100,
      },
    ],
  };
  assert.equal(parseSnapshot(valid).prices.length, 1);
  assert.throws(() => parseSnapshot({ ...valid, dataDate: "2026-11-03" }));
  valid.prices[0].high = 5;
  assert.throws(() => parseSnapshot(valid));
});

test("zoom keeps the pointed date, clamps bounds and fits candle bodies inside the plot", () => {
  assert.equal(zoomRange(20, 7, 5, 1.01).count, 6);
  for (const total of [3, 20, 60, 120]) {
    for (const anchor of [0, .25, .5, 1]) {
      const view = zoomRange(total, 0, total, .8, anchor);
      assert.ok(Math.abs(view.start + anchor * (view.count - 1) - anchor * (total - 1)) <= .5);
      assert.deepEqual(zoomRange(total, view.start, view.count, 100, anchor), { start: 0, count: total });
      const smallest = zoomRange(total, view.start, view.count, .001, anchor);
      assert.equal(smallest.count, Math.min(5, total));
      assert.ok(smallest.start >= 0 && smallest.start + smallest.count <= total);
      for (const single of [true, false]) {
        const g = geometry(smallest.count, 650, single, true);
        assert.ok(g.x(0) - g.barWidth / 2 >= 22);
        assert.ok(g.x(smallest.count - 1) + g.barWidth / 2 <= 578);
      }
    }
  }
});
