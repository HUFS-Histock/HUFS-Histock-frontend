import type { Candle } from "./api.ts";

export const percent = (v: number | null, signed = false): string =>
  v === null
    ? "—"
    : `${v < 0 ? "−" : signed && v > 0 ? "+" : ""}${Math.abs(v * 100).toFixed(1)}%`;
export const tone = (v: number | null): string =>
  v == null || v === 0 ? "" : v > 0 ? "up" : "down";
export const price = (v: number): string =>
  v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function windowFor(
  prices: Candle[],
  endDate: string,
  count = 20,
): Candle[] | null {
  const end = prices.findIndex((p) => p.date === endDate);
  if (end < count - 1) return null;
  const result = prices.slice(end - count + 1, end + 1);
  // shortcut: the local snapshot contains separate windows; reject gaps until an OHLCV API supplies continuous history.
  if (
    result.some(
      (p, i) =>
        i > 0 &&
        Date.parse(p.date) - Date.parse(result[i - 1].date) > 5 * 86400000,
    )
  )
    return null;
  return result;
}
export function geometry(
  count: number,
  width: number,
  single: boolean,
  zoomed = false,
) {
  const plotWidth = width - 94;
  const centered = (single && count <= 20) || zoomed;
  return {
    x: (i: number) =>
      22 +
      (centered ? (i + 0.5) / count : count === 1 ? 0.5 : i / (count - 1)) *
        plotWidth,
    barWidth: centered
      ? (plotWidth / count) * (single ? 0.7 : 0.5)
      : Math.min(15, (plotWidth / count) * 0.5),
  };
}
export function zoomRange(
  total: number,
  start: number,
  count: number,
  factor: number,
  anchor = 0.5,
) {
  const rounded = Math.round(count * factor);
  const requested = rounded === count ? count + Math.sign(factor - 1) : rounded;
  const nextCount = Math.max(Math.min(5, total), Math.min(total, requested));
  const fraction = Math.max(0, Math.min(1, anchor));
  const point = start + fraction * (count - 1);
  return {
    start: Math.max(
      0,
      Math.min(total - nextCount, Math.round(point - fraction * (nextCount - 1))),
    ),
    count: nextCount,
  };
}
export function normalized(values: number[]): number[] {
  if (!values.length || !Number.isFinite(values[0]) || values[0] <= 0)
    throw new Error("비교할 가격 데이터가 없습니다.");
  return values.map((v) => (v / values[0]) * 100);
}

export function dateTicks(dates: string[], start: number, count: number) {
  const week = (date: string) => {
    const time = Date.parse(date);
    const day = new Date(time).getUTCDay();
    return time - ((day + 6) % 7) * 86400000;
  };
  const ticks: { index: number; text: string }[] = [];
  dates.slice(start, start + count).forEach((date, index) => {
    const previous = dates[start + index - 1];
    const monthChanged = !previous || previous.slice(0, 7) !== date.slice(0, 7);
    const month = Number(date.slice(5, 7));
    const day = Number(date.slice(8));
    if (count <= 15) {
      ticks.push({ index, text: `${month}/${day}` });
    } else if (count <= 40) {
      // A Monday holiday is labeled at that week's first available trading day.
      if (!previous || week(date) !== week(previous)) ticks.push({ index, text: `${month}/${day}` });
    } else if (monthChanged) {
      ticks.push({ index, text: `${month}월` });
    }
  });
  return ticks;
}
export function movingAverage(
  values: number[],
  days: number,
): (number | null)[] {
  return values.map((_, i) =>
    i + 1 < days
      ? null
      : values.slice(i + 1 - days, i + 1).reduce((a, b) => a + b, 0) / days,
  );
}
