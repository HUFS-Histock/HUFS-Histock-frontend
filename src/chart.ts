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
export function geometry(count: number, width: number, single: boolean) {
  const plotWidth = width - 94;
  const centered = single && count === 20;
  return {
    x: (i: number) =>
      22 +
      (centered ? (i + 0.5) / count : count === 1 ? 0.5 : i / (count - 1)) *
        plotWidth,
    barWidth: centered
      ? (plotWidth / count) * 0.7
      : Math.min(15, (plotWidth / count) * 0.5),
  };
}
export function normalized(values: number[]): number[] {
  if (!values.length || !Number.isFinite(values[0]) || values[0] <= 0)
    throw new Error("비교할 가격 데이터가 없습니다.");
  return values.map((v) => (v / values[0]) * 100);
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
